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
  insertWorkspace,
  getAllWorkspaces,
  getWorkspaceById,
  deleteWorkspace,
  updateWorkspaceTimestamp,
  addProjectToWorkspace,
  removeProjectFromWorkspace,
  getWorkspaceProjects,
  getWorkspaceProjectIds,
  insertWorkspaceSession,
  insertWorkspaceAnalysis,
  getWorkspaceSessions,
  getWorkspaceAnalyses,
  getSetting,
  setSetting,
  getAllSettings,
} from './db.mjs';
import * as hermesProvider from './providers/hermes.mjs';
import * as claudeCodeProvider from './providers/claude-code.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 进行中的分析请求，用于取消
const activeAnalyses = new Map();

// AI Provider registry
const providers = {
  hermes: hermesProvider,
  'claude-code': claudeCodeProvider,
};

function getActiveProvider() {
  try {
    const row = getSetting.get('ai_provider');
    const key = row?.value || 'hermes';
    return providers[key] || providers.hermes;
  } catch {
    return providers.hermes;
  }
}

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

    // 检查是否为图片文件
    const ext = path.extname(targetPath).toLowerCase();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'];
    if (imageExts.includes(ext)) {
      // 读取为 base64
      const content = fs.readFileSync(targetPath);
      const base64 = content.toString('base64');
      res.json({ content: base64, size: stat.size, isImage: true });
    } else {
      const content = fs.readFileSync(targetPath, 'utf-8');
      res.json({ content, size: stat.size });
    }
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

// GET /api/settings - 获取所有设置
app.get('/api/settings', (req, res) => {
  try {
    const rows = getAllSettings.all();
    const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings - 更新设置
app.put('/api/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });
    setSetting.run(key, value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai-status - 检测各 AI Provider 的可用性
app.get('/api/ai-status', async (req, res) => {
  const status = {};
  for (const [key, provider] of Object.entries(providers)) {
    try {
      status[key] = await provider.isAvailable();
    } catch {
      status[key] = false;
    }
  }
  res.json(status);
});

// POST /api/analyze - analyze project via active AI provider
app.post('/api/analyze', async (req, res) => {
  const { name, question } = req.body;

  const project = getProjectByName.get(name);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const provider = getActiveProvider();
  const ac = new AbortController();
  const sessionId = `github-index-${name}`;
  activeAnalyses.set(sessionId, ac);

  const systemPrompt = `你是项目分析助手，负责解答关于项目 "${name}" 的代码咨询。

项目本地路径: ${project.local_path}

你有文件读取和终端访问权限，请自行查看项目文件后给出分析。请始终用中文回答，保持简洁专业。`;

  const currentPrompt = question || '请帮我对这个项目做一个初始分析报告。';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ status: 'analyzing', message: `正在唤醒 ${provider.displayName}...` })}\n\n`);

  let currentContent = '';

  try {
    await provider.analyze({
      projectPath: project.local_path,
      projectName: name,
      systemPrompt,
      userMessage: currentPrompt,
      sessionId,
      abortSignal: ac.signal,
      onChunk: (text) => {
        currentContent += text;
        try { res.write(`data: ${JSON.stringify({ status: 'chunk', content: text })}\n\n`); } catch {}
      },
      onTool: (toolInfo) => {
        try { res.write(`data: ${JSON.stringify({ status: 'tool', ...toolInfo })}\n\n`); } catch {}
      },
      onError: (message) => {
        try { res.write(`data: ${JSON.stringify({ status: 'error', message })}\n\n`); } catch {}
      },
      onDone: () => {},
    });

    activeAnalyses.delete(sessionId);
    insertAnalysis.run(project.id, currentPrompt, currentContent, `provider: ${provider.name}`);

    try {
      res.write(`data: ${JSON.stringify({ status: 'done' })}\n\n`);
      res.end();
    } catch {}

  } catch (error) {
    activeAnalyses.delete(sessionId);
    console.error(`[${provider.displayName}] Analysis failed:`, error.message);

    if (currentContent) {
      try {
        insertAnalysis.run(project.id, currentPrompt, currentContent, `provider: ${provider.name}`);
      } catch (dbErr) {
        console.error('Failed to save to DB:', dbErr.message);
      }
    }

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

// ============ Workspace API ============

// GET /api/workspaces - 列出所有工作空间
app.get('/api/workspaces', (req, res) => {
  try {
    const workspaces = getAllWorkspaces.all();
    const result = workspaces.map(w => {
      const projects = getWorkspaceProjects.all(w.id);
      return { ...w, projects: projects.map(p => ({ ...p, topics: JSON.parse(p.topics || '[]') })) };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workspaces - 创建工作空间
app.post('/api/workspaces', (req, res) => {
  try {
    const { name, description, projectIds } = req.body;
    if (!name) return res.status(400).json({ error: '名称不能为空' });

    const result = insertWorkspace.run(name, description || '');
    const workspaceId = result.lastInsertRowid;

    if (projectIds && projectIds.length > 0) {
      for (const pid of projectIds) {
        addProjectToWorkspace.run(workspaceId, pid);
      }
    }

    const workspace = getWorkspaceById.get(workspaceId);
    const projects = getWorkspaceProjects.all(workspaceId);
    res.json({ ...workspace, projects: projects.map(p => ({ ...p, topics: JSON.parse(p.topics || '[]') })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/workspaces/:id - 删除工作空间
app.delete('/api/workspaces/:id', (req, res) => {
  try {
    deleteWorkspace.run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workspaces/:id/projects - 添加项目到工作空间
app.post('/api/workspaces/:id/projects', (req, res) => {
  try {
    const { projectId } = req.body;
    addProjectToWorkspace.run(req.params.id, projectId);
    updateWorkspaceTimestamp.run(req.params.id);
    const projects = getWorkspaceProjects.all(req.params.id);
    res.json(projects.map(p => ({ ...p, topics: JSON.parse(p.topics || '[]') })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/workspaces/:id/projects/:projectId - 从工作空间移除项目
app.delete('/api/workspaces/:id/projects/:projectId', (req, res) => {
  try {
    removeProjectFromWorkspace.run(req.params.id, req.params.projectId);
    updateWorkspaceTimestamp.run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workspaces/:id/sessions - 获取工作空间的分析历史
app.get('/api/workspaces/:id/sessions', (req, res) => {
  try {
    const sessions = getWorkspaceSessions.all(req.params.id);
    const result = sessions.map(s => ({
      ...s,
      analyses: getWorkspaceAnalyses.all(s.id),
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workspaces/:id/analyze - 对工作空间内所有项目进行对比分析
app.post('/api/workspaces/:id/analyze', async (req, res) => {
  const { question } = req.body;
  const workspaceId = req.params.id;

  const workspace = getWorkspaceById.get(workspaceId);
  if (!workspace) return res.status(404).json({ error: '工作空间不存在' });

  const projects = getWorkspaceProjects.all(workspaceId);
  if (projects.length === 0) return res.status(400).json({ error: '工作空间内没有项目' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const provider = getActiveProvider();
  const ac = new AbortController();

  try {
    res.write(`data: ${JSON.stringify({ status: 'phase', phase: 'analyzing', message: `正在用 ${provider.displayName} 并行分析 ${projects.length} 个项目...` })}\n\n`);

    const analysisPrompt = `你是项目分析专家。请针对项目 "${'${name}'}" 回答以下问题：

问题：${question || '请分析这个项目的核心设计和实现'}

要求：
1. 只回答与本项目相关的部分
2. 重点提取：设计思路、核心实现、关键代码位置
3. 输出结构化的分析摘要，不超过 500 字
4. 标注具体的文件路径和代码位置
5. 用中文回答`;

    const analyzeProject = async (project) => {
      // 统一使用项目详情页的 sessionId，保持上下文关联
      const sessionId = `github-index-${project.name}`;
      const sysPrompt = `你是项目分析助手。项目: ${project.name}，路径: ${project.local_path}。你有文件读取权限。`;
      const userMessage = analysisPrompt.replace('${name}', project.name);
      let content = '';

      try {
        await provider.analyze({
          projectPath: project.local_path,
          projectName: project.name,
          systemPrompt: sysPrompt,
          userMessage,
          sessionId,
          abortSignal: ac.signal,
          onChunk: (text) => { content += text; },
          onTool: (toolInfo) => {
            try {
              const label = toolInfo.label ? `[${project.name}] ${toolInfo.label}` : `[${project.name}] ${toolInfo.tool}`;
              res.write(`data: ${JSON.stringify({ status: 'tool', ...toolInfo, label })}\n\n`);
            } catch {}
          },
          onError: () => {},
          onDone: () => {},
        });
        // 同步写入项目的 analysis 表，这样项目详情页也能看到
        insertAnalysis.run(project.id, `[工作空间] ${question || '对比分析'}`, content, `provider: ${provider.name}`);
        return { project: project.name, projectId: project.id, content, error: null };
      } catch (err) {
        return { project: project.name, projectId: project.id, content: '', error: err.message };
      }
    };

    const results = [];
    const batchSize = 3;
    for (let i = 0; i < projects.length; i += batchSize) {
      const batch = projects.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(analyzeProject));
      for (const r of batchResults) {
        results.push(r);
        res.write(`data: ${JSON.stringify({ status: 'project_done', project: r.project, error: r.error })}\n\n`);
      }
    }

    // 阶段 2：汇总对比
    res.write(`data: ${JSON.stringify({ status: 'phase', phase: 'summarizing', message: '正在生成对比总结...' })}\n\n`);

    const summaries = results.map(r =>
      `## 项目: ${r.project}${r.error ? ' (分析失败: ' + r.error + ')' : ''}\n${r.content || '无内容'}`
    ).join('\n\n---\n\n');

    const summaryPrompt = `你是技术架构对比分析专家。以下是 ${projects.length} 个同类项目针对同一问题的分析结果：

问题：${question || '请分析这个项目的核心设计和实现'}

${summaries}

请输出：
1. **总结**：一句话概括整体趋势或共性
2. **对比表**：用 markdown 表格列出各项目在关键维度上的差异
3. **亮点**：每个项目最值得借鉴的设计
4. **建议**：如果你要实现类似功能，推荐参考哪个项目的方案

用中文回答。`;

    let summaryContent = '';
    await provider.analyze({
      projectPath: projects[0].local_path,
      projectName: workspace.name,
      systemPrompt: '你是技术架构对比分析专家，擅长总结和对比不同项目的设计差异。',
      userMessage: summaryPrompt,
      sessionId: `github-index-${workspace.name}`,
      abortSignal: ac.signal,
      onChunk: (text) => {
        summaryContent += text;
        try { res.write(`data: ${JSON.stringify({ status: 'chunk', content: text })}\n\n`); } catch {}
      },
      onTool: (toolInfo) => {
        try { res.write(`data: ${JSON.stringify({ status: 'tool', ...toolInfo })}\n\n`); } catch {}
      },
      onError: () => {},
      onDone: () => {},
    });

    const sessionResult = insertWorkspaceSession.run(workspaceId, question || '', summaryContent);
    const sessionId2 = sessionResult.lastInsertRowid;
    for (const r of results) {
      insertWorkspaceAnalysis.run(sessionId2, r.projectId, r.content);
    }

    res.write(`data: ${JSON.stringify({ status: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('[Workspace Analyze] Failed:', error.message);
    try {
      res.write(`data: ${JSON.stringify({ status: 'error', message: error.message })}\n\n`);
      res.end();
    } catch {}
  }
});

// POST /api/analyze/stop - 取消进行中的分析
app.post('/api/analyze/stop', (req, res) => {
  const { name } = req.body;
  const sessionId = `github-index-${name}`;
  const ac = activeAnalyses.get(sessionId);
  if (ac) {
    ac.abort();
    activeAnalyses.delete(sessionId);
    console.log(`[AI] Aborted analysis for: ${name}`);
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'No active analysis found' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Analysis API running on http://localhost:${PORT}`);
});
