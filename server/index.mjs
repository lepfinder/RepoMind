import express from 'express';
import cors from 'cors';
import { exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  db,
  upsertProject,
  getAllProjects,
  getProjectByName,
  deleteProjectByName,
  insertAnalysis,
  getAnalysisByProjectId,
} from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 进行中的分析请求，用于取消
const activeAnalyses = new Map();

// POST /api/open-folder - Open a local folder in macOS Finder
app.post('/api/open-folder', (req, res) => {
  const { path: folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: 'path is required' });

  exec(`open ${JSON.stringify(folderPath)}`, (error) => {
    if (error) {
      console.error('[Open Folder] Failed:', error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
  });
});

// GET /api/projects - list all projects
app.get('/api/projects', (req, res) => {
  try {
    const projects = getAllProjects.all().map(p => ({
      ...p,
      topics: JSON.parse(p.topics),
    }));
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:name - get single project + analysis history
app.get('/api/projects/:name', (req, res) => {
  try {
    const project = getProjectByName.get(req.params.name);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    project.topics = JSON.parse(project.topics);

    // Get analysis history
    const analysis = getAnalysisByProjectId.all(project.id);
    res.json({ project, analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:name/readme - 读取并获取项目的完整 README.md 内容
app.get('/api/projects/:name/readme', (req, res) => {
  try {
    const project = getProjectByName.get(req.params.name);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const localPath = project.local_path;
    let readmePath = path.join(localPath, 'README.md');
    if (!fs.existsSync(readmePath)) {
      readmePath = path.join(localPath, 'readme.md');
    }

    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      res.json({ content });
    } else {
      res.json({ content: '*此项目暂未包含 README.md 文件。*' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:name/files - 递归扫描并读取项目本地非 node_modules 干扰的文件树结构
app.get('/api/projects/:name/files', (req, res) => {
  try {
    const project = getProjectByName.get(req.params.name);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const localPath = project.local_path;
    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Local folder not found' });
    }

    const excludeDirs = new Set([
      '.git', 'node_modules', 'dist', 'build', '.gemini', '.vite', 
      '.output', 'temp', 'tmp', '.DS_Store', 'package-lock.json',
      'pnpm-lock.yaml', 'yarn.lock'
    ]);

    function buildTree(dirPath, relativeDir = '') {
      const items = [];
      const files = fs.readdirSync(dirPath, { withFileTypes: true });

      // 排序：目录优先在前面，之后字母表排序
      files.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const file of files) {
        if (excludeDirs.has(file.name)) continue;

        const relPath = relativeDir ? path.join(relativeDir, file.name) : file.name;
        const fullPath = path.join(dirPath, file.name);

        if (file.isDirectory()) {
          items.push({
            name: file.name,
            path: relPath,
            type: 'directory',
            children: buildTree(fullPath, relPath)
          });
        } else {
          items.push({
            name: file.name,
            path: relPath,
            type: 'file'
          });
        }
      }
      return items;
    }

    const fileTree = buildTree(localPath);
    res.json(fileTree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:name/file - 安全防穿越读取本地指定文件的纯文本内容，用于文件浏览器代码预览
app.get('/api/projects/:name/file', (req, res) => {
  try {
    const project = getProjectByName.get(req.params.name);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: 'Path parameter is required' });

    const localPath = project.local_path;
    const targetPath = path.resolve(localPath, relPath);

    // 🔴 严格的安全红线：强力拦截任何路径穿越企图！
    if (!targetPath.startsWith(localPath)) {
      return res.status(403).json({ error: 'Access denied: Path traversal detected' });
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Specified path is a directory' });
    }

    // 1MB 内存防线限制，防止读取二进制大文件崩溃
    if (stat.size > 1024 * 1024) {
      return res.status(400).json({ error: 'File is too large to display (limit 1MB)' });
    }

    const content = fs.readFileSync(targetPath, 'utf-8');
    res.json({ content, size: stat.size });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// DELETE /api/projects/:name - 安全删除项目（物理清除本地 Git 文件 + 数据库索引级联删除）
app.delete('/api/projects/:name', (req, res) => {
  const { name } = req.params;
  try {
    const project = getProjectByName.get(name);
    if (!project) {
      return res.status(404).json({ error: '项目未找到' });
    }

    const projectPath = project.local_path;
    const userHome = process.env.HOME || '/Users/xiyangxie';
    const allowedRoot = path.resolve(userHome, 'workspace/github');

    // 🔴 严格的安全红线：强制防御路径穿越，保证只物理删除允许工作区下的目录！
    if (!projectPath || !projectPath.startsWith(allowedRoot) || projectPath === allowedRoot) {
      return res.status(400).json({
        error: `安全边界校验失败：项目物理路径 "${projectPath}" 超出了允许的删除工作区 "${allowedRoot}"，或该路径不合法。`
      });
    }

    // 1. 物理删除本地整个 Git 目录
    if (fs.existsSync(projectPath)) {
      console.log(`[Safety Check] Attempting to physically delete folder: ${projectPath}`);
      fs.rmSync(projectPath, { recursive: true, force: true });
      console.log(`[Safety Check] Folder successfully deleted: ${projectPath}`);
    }

    // 2. 从 SQLite 中级联删除项目记录
    deleteProjectByName.run(name);
    console.log(`[DB] Successfully removed project index from SQLite: ${name}`);

    // 3. 重新同步并写入 public/projects.json 文件以确保强一致
    const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
    const projects = getAllProjects.all();
    const publicJsonPath = path.resolve(PUBLIC_DIR, 'projects.json');
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.writeFileSync(publicJsonPath, JSON.stringify(projects.map(p => ({
      ...p,
      topics: JSON.parse(p.topics),
    })), null, 2));

    res.json({ success: true, message: `项目 "${name}" 及其本地目录已成功被安全物理清除。` });
  } catch (error) {
    console.error('Delete project failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to parse the local API server key from ~/.hermes/.env
function getHermesApiKey() {
  try {
    const userHome = process.env.HOME || '/Users/xiyangxie';
    const envPath = path.join(userHome, '.hermes', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/API_SERVER_KEY\s*=\s*(.+)/);
      if (match) {
        return match[1].trim().replace(/['"]/g, '');
      }
    }
  } catch (e) {
    console.error('Failed to parse ~/.hermes/.env for API key:', e);
  }
  return 'change-me-local-dev';
}

// POST /api/analyze - analyze project via Hermes API Server with session continuity
app.post('/api/analyze', async (req, res) => {
  const { name, question } = req.body;

  const project = getProjectByName.get(name);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // AbortController 用于取消进行中的 gateway 请求
  const ac = new AbortController();
  const sessionId = `github-index-${name}`;
  activeAnalyses.set(sessionId, ac);

  // 只给基本信息，让 Hermes 自己决定看哪些文件
  const systemPrompt = `你是项目分析助手，负责解答关于项目 "${name}" 的代码咨询。

项目本地路径: ${project.local_path}

你有文件读取和终端访问权限，请自行查看项目文件后给出分析。请始终用中文回答，保持简洁专业。`;

  // 当前提问
  const currentPrompt = question || '请帮我对这个项目做一个初始分析报告。';

  // 3. session_id 已在上方生成，复用 sessionId

  // 4. 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ status: 'analyzing', message: '正在唤醒 Hermes API 网关...' })}\n\n`);

  try {
    const apiKey = getHermesApiKey();

    // 不再手动拼装历史消息，只发送系统提示词 + 当前提问
    // 历史对话由 Gateway 通过 X-Hermes-Session-Id 从 state.db 自动加载
    const payload = {
      model: 'hermes-agent',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: currentPrompt },
      ],
      stream: true
    };

    console.log(`[Hermes API] Sending streaming request for project: ${name}, session: ${sessionId}`);

    const response = await fetch('http://127.0.0.1:8642/v1/chat/completions', {
      signal: ac.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Hermes-Session-Id': sessionId,  // 关键：让 Gateway 加载/续传会话历史
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      res.write(`data: ${JSON.stringify({ status: 'error', message: `网关响应错误: ${errText}` })}\n\n`);
      res.end();
      return;
    }

    let buffer = '';
    let currentContent = '';
    let lastContentTime = Date.now();
    let currentEventType = '';

    // 使用异步迭代器优雅且无阻塞地流式拉取网关 SSE
    for await (const chunk of response.body) {
      const chunkStr = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      buffer += chunkStr;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 解析 Hermes 自定义工具进度事件
        // 格式: event: hermes.tool.progress\ndata: {...}
        if (trimmed.startsWith('event: ')) {
          currentEventType = trimmed.slice(7).trim();
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            // 工具进度事件
            if (currentEventType === 'hermes.tool.progress') {
              const toolData = JSON.parse(dataStr);
              console.log('[Tool]', toolData.status, toolData.tool, toolData.label || '');
              if (toolData.status === 'running' && toolData.label) {
                res.write(`data: ${JSON.stringify({ status: 'tool', tool: toolData.tool, message: toolData.label })}\n\n`);
              } else if (toolData.status === 'completed' && toolData.tool) {
                res.write(`data: ${JSON.stringify({ status: 'tool', tool: toolData.tool, message: toolData.tool, done: true })}\n\n`);
              }
              currentEventType = '';
              continue;
            }

            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              currentContent += content;
              lastContentTime = Date.now();
              // 只推送新到达的 token，避免 payload 膨胀导致前端卡顿
              res.write(`data: ${JSON.stringify({ status: 'chunk', content })}\n\n`);
            }
          } catch (e) {
            // 忽略非 JSON 段落或格式不符数据
          }
          currentEventType = '';
        }
      }
    }

    // 处理边缘残余数据
    if (buffer.trim().startsWith('data: ')) {
      const dataStr = buffer.trim().slice(6).trim();
      if (dataStr !== '[DONE]') {
        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            currentContent += content;
            res.write(`data: ${JSON.stringify({ status: 'chunk', content })}\n\n`);
          }
        } catch (e) {}
      }
    }

    activeAnalyses.delete(sessionId);

    // 5. 将这轮问答对存入本地 SQLite（保证 question 始终有值，加载历史时能正确显示用户提问）
    insertAnalysis.run(project.id, question || '请帮我对这个项目做一个初始分析报告。', currentContent, 'system: minimal context');

    // 6. 发送最终确认并优雅挂断
    try {
      res.write(`data: ${JSON.stringify({ status: 'done' })}\n\n`);
      res.end();
    } catch {}

  } catch (error) {
    activeAnalyses.delete(sessionId);
    console.error('[Hermes API] Streaming request failed:', error.message);
    // 无论成功失败，都把已收到的内容存入数据库（防止客户端断开导致结果丢失）
    if (currentContent) {
      try {
        insertAnalysis.run(project.id, question || '请帮我对这个项目做一个初始分析报告。', currentContent, 'system: minimal context');
        console.log('[Hermes API] Saved partial content to DB on error');
      } catch (dbErr) {
        console.error('[Hermes API] Failed to save to DB:', dbErr.message);
      }
    }
    // 客户端可能已断开，安全写入
    try {
      res.write(`data: ${JSON.stringify({ status: 'error', message: `分析中断: ${error.message}` })}\n\n`);
      res.end();
    } catch {}
  }
});

// POST /api/import - Import project from GitHub, clone locally, and sync index
app.post('/api/import', async (req, res) => {
  const { githubUrl } = req.body;
  if (!githubUrl) {
    return res.status(400).json({ error: 'GitHub 仓库地址不能为空' });
  }

  // 1. 设置标准的 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ status: 'analyzing', message: '正在解析 GitHub 链接与地址...' })}\n\n`);

  // 2. 正则安全提取 owner 和 repo 字段
  let owner = '';
  let repo = '';
  try {
    const cleaned = githubUrl.trim().replace(/\.git$/, '');
    const match = cleaned.match(/(?:github\.com[:/])?([^/]+)\/([^/]+)$/) || cleaned.match(/^([^/]+)\/([^/]+)$/);
    if (!match) {
      res.write(`data: ${JSON.stringify({ status: 'error', message: '无效的 GitHub 仓库地址。请使用格式 "owner/repo" 或完整的 GitHub 链接。' })}\n\n`);
      res.end();
      return;
    }
    owner = match[1];
    repo = match[2];
  } catch (e) {
    res.write(`data: ${JSON.stringify({ status: 'error', message: '解析链接失败，请检查格式是否正确。' })}\n\n`);
    res.end();
    return;
  }

  const GITHUB_DIR = '/Users/xiyangxie/workspace/github';
  const targetPath = path.join(GITHUB_DIR, repo);

  // 3. 安全防物理覆盖机制
  if (fs.existsSync(targetPath)) {
    res.write(`data: ${JSON.stringify({ status: 'error', message: `物理冲突：本地路径 ~/workspace/github/${repo} 已存在该项目文件夹，无法重复导入。` })}\n\n`);
    res.end();
    return;
  }

  // 4. 发起 Git Clone 流式任务
  res.write(`data: ${JSON.stringify({ status: 'cloning', message: `正在克隆仓库 ${owner}/${repo} 到本地 ~/workspace/github/${repo}...` })}\n\n`);
  
  const cloneCmd = `git clone https://github.com/${owner}/${repo}.git "${targetPath}"`;
  
  exec(cloneCmd, { timeout: 300000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('[Import API] Git clone failed:', error);
      res.write(`data: ${JSON.stringify({ status: 'error', message: `克隆失败。请检查该仓库是否为私有仓库，或当前网络是否顺畅。底层错误: ${stderr || error.message}` })}\n\n`);
      res.end();
      return;
    }

    // 5. 克隆成功，进入元数据自省提取 (Metadata Extraction)
    res.write(`data: ${JSON.stringify({ status: 'scanning', message: '克隆成功，正在提取本地元数据与文件...' })}\n\n`);

    try {
      // 提取 Git 提交日志
      let lastCommitHash = '';
      let lastCommitMessage = '';
      let lastCommitDate = '';
      try {
        const gitLog = execSync('git log -1 --format="%H%n%s%n%ci"', { cwd: targetPath }).toString().trim().split('\n');
        lastCommitHash = gitLog[0] || '';
        lastCommitMessage = gitLog[1] || '';
        lastCommitDate = gitLog[2] || '';
      } catch (gitErr) {
        console.warn('[Import API] Get commit info failed:', gitErr.message);
      }

      // 智能探测语言
      let language = 'Other';
      if (fs.existsSync(path.join(targetPath, 'package.json'))) language = 'TypeScript';
      else if (fs.existsSync(path.join(targetPath, 'requirements.txt')) || fs.existsSync(path.join(targetPath, 'pyproject.toml'))) language = 'Python';
      else if (fs.existsSync(path.join(targetPath, 'go.mod'))) language = 'Go';
      else if (fs.existsSync(path.join(targetPath, 'Cargo.toml'))) language = 'Rust';
      else if (fs.existsSync(path.join(targetPath, 'pom.xml'))) language = 'Java';
      else if (fs.existsSync(path.join(targetPath, 'CMakeLists.txt'))) language = 'C/C++';
      else if (fs.existsSync(path.join(targetPath, 'Makefile'))) language = 'Makefile';

      // 提取项目描述
      let description = `${repo} — local repository`;
      const readmePath = path.join(targetPath, 'README.md');
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        const noHtml = readmeContent.replace(/<[^>]+>/g, '');
        const noMd = noHtml
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/^#+\s*/gm, '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1');
        const firstLine = noMd.split('\n').find(l => {
          const t = l.trim();
          return t && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('===') && t.length > 3;
        });
        if (firstLine) description = firstLine.trim().slice(0, 150);
      }

      // 6. 联网同步远端 GitHub Stars/Forks/Topics 等统计
      res.write(`data: ${JSON.stringify({ status: 'syncing', message: '正在同步 GitHub Repository 远端星标与分叉数据...' })}\n\n`);

      const token = process.env.GITHUB_TOKEN;
      const headers = ['-H "User-Agent: github-index"'];
      if (token) headers.push(`-H "Authorization: token ${token}"`);
      const headersStr = headers.join(' ');

      let topics = [];
      let stars = 0;
      let forks = 0;
      let remote_commit_hash = '';
      let remote_commit_date = '';
      let compare_status = 'unknown';
      let ahead_by = 0;
      let behind_by = 0;

      try {
        const resp = execSync(`curl -s -m 5 ${headersStr} "https://api.github.com/repos/${owner}/${repo}"`).toString();
        const data = JSON.parse(resp);
        
        if (data.stargazers_count !== undefined) {
          topics = data.topics || [];
          stars = data.stargazers_count || 0;
          forks = data.forks_count || 0;
          remote_commit_date = data.pushed_at || '';
          
          if (lastCommitHash && token) {
            try {
              const defaultBranch = data.default_branch || 'main';
              const compareResp = execSync(`curl -s -m 5 ${headersStr} "https://api.github.com/repos/${owner}/${repo}/compare/${lastCommitHash}...${defaultBranch}"`).toString();
              const compareData = JSON.parse(compareResp);
              if (compareData.status) {
                compare_status = compareData.status;
                ahead_by = compareData.ahead_by || 0;
                behind_by = compareData.behind_by || 0;
                if (compareData.commits && compareData.commits.length > 0) {
                  const lastCommit = compareData.commits[compareData.commits.length - 1];
                  remote_commit_hash = lastCommit.sha || '';
                  if (lastCommit.commit && lastCommit.commit.committer) {
                    remote_commit_date = lastCommit.commit.committer.date || remote_commit_date;
                  }
                } else if (compareData.status === 'identical') {
                  remote_commit_hash = lastCommitHash;
                  remote_commit_date = lastCommitDate;
                }
              }
            } catch (err) {}
          }
        }
      } catch (apiErr) {
        console.warn('[Import API] Sync GitHub stats failed:', apiErr.message);
      }

      // 7. 全自动写入 SQLite 数据库（使用 db.mjs 导出的预编译语句）
      upsertProject.run({
        name: repo,
        owner,
        repo,
        description,
        remote_url: `https://github.com/${owner}/${repo}.git`,
        github_url: `https://github.com/${owner}/${repo}`,
        language,
        topics: JSON.stringify(topics),
        last_commit_hash: lastCommitHash,
        last_commit_message: lastCommitMessage,
        last_commit_date: lastCommitDate,
        local_path: targetPath,
        scanned_at: new Date().toISOString(),
        stars,
        forks,
        remote_commit_hash,
        remote_commit_date,
        compare_status,
        ahead_by,
        behind_by
      });

      // 8. 重新生成并写入 public/projects.json 静态文件 (保持前后端状态高度一致)
      const projects = db.prepare('SELECT * FROM projects ORDER BY last_commit_date DESC').all();
      const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
      const publicJsonPath = path.resolve(PUBLIC_DIR, 'projects.json');
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
      fs.writeFileSync(publicJsonPath, JSON.stringify(projects.map(p => ({
        ...p,
        topics: JSON.parse(p.topics),
      })), null, 2));

      // 9. 完成，发送结束通知并挂断
      res.write(`data: ${JSON.stringify({ status: 'done', message: '项目导入及索引同步完全就绪！' })}\n\n`);
      res.end();

    } catch (scanErr) {
      console.error('[Import API] Scan failed:', scanErr);
      res.write(`data: ${JSON.stringify({ status: 'error', message: `提取扫描元数据同步失败。错误: ${scanErr.message}` })}\n\n`);
      res.end();
    }
  });
});

// POST /api/scan - Trigger a full rescan of ~/workspace/github and sync to SQLite
app.post('/api/scan', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const scanPath = path.resolve(__dirname, '..', 'scripts', 'scan.mjs');

  res.write(`data: ${JSON.stringify({ status: 'scanning', message: '正在唤醒扫描引擎...' })}\n\n`);

  const child = exec(`node ${scanPath}`, {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env }
  });

  let buffer = '';
  let scannedCount = 0;

  child.stdout?.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('Scanning:')) {
        const projectName = trimmed.replace('Scanning:', '').trim();
        scannedCount++;
        res.write(`data: ${JSON.stringify({ status: 'scanning', message: `扫描中: ${projectName} (${scannedCount})` })}\n\n`);
      } else if (trimmed.startsWith('Done!')) {
        const match = trimmed.match(/Indexed (\d+) projects/);
        const total = match ? match[1] : scannedCount;
        res.write(`data: ${JSON.stringify({ status: 'done', message: `扫描完成！共入库 ${total} 个项目。`, count: total })}\n\n`);
        res.end();
      }
    }
  });

  child.stderr?.on('data', (chunk) => {
    // Forward warnings to console but don't break the stream
    console.log('[Scan stderr]', chunk.toString().trim());
  });

  child.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ status: 'error', message: `扫描进程启动失败: ${err.message}` })}\n\n`);
    res.end();
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      res.write(`data: ${JSON.stringify({ status: 'error', message: `扫描异常退出 (code: ${code})` })}\n\n`);
      res.end();
    }
  });
});

// POST /api/analyze/stop - 取消进行中的分析
app.post('/api/analyze/stop', (req, res) => {
  const { name } = req.body;
  const sessionId = `github-index-${name}`;
  const ac = activeAnalyses.get(sessionId);
  if (ac) {
    ac.abort();
    activeAnalyses.delete(sessionId);
    console.log(`[Hermes API] Aborted analysis for: ${name}`);
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'No active analysis found' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Analysis API running on http://localhost:${PORT}`);
});
