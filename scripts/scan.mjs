#!/usr/bin/env node
/**
 * Scan configured GitHub directory for git repos and save to SQLite
 * Default: ~/workspace/github (override with REPO_MIND_DIR env var)
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { upsertProject, db } from '../server/db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const REPO_MIND_DIR = process.env.REPO_MIND_DIR || path.resolve(process.env.HOME, 'workspace/github');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const SCAN_MARKER = path.resolve(ROOT_DIR, 'data', '.last-scan');

// 24 小时全量扫描节流：如果上次扫描在 24 小时内，跳过本次
try {
  if (fs.existsSync(SCAN_MARKER)) {
    const lastScan = fs.statSync(SCAN_MARKER).mtimeMs;
    const hoursSince = (Date.now() - lastScan) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      console.log(`⏭️ 距上次扫描仅 ${hoursSince.toFixed(1)}h (<24h)，跳过本次全量扫描。`);
      console.log(`   如需强制扫描，删除 data/.last-scan 文件后重新运行。`);
      process.exit(0);
    }
  }
} catch { /* marker 读取失败，继续扫描 */ }

function parseGitConfig(dir) {
  const configPath = path.join(dir, '.git', 'config');
  if (!fs.existsSync(configPath)) return null;
  const content = fs.readFileSync(configPath, 'utf-8');
  const urlMatch = content.match(/url\s*=\s*(.+)/);
  if (!urlMatch) return null;
  return urlMatch[1].trim();
}

function getGitInfo(dir) {
  try {
    const result = execSync(
      'git log -1 --format="%H%n%s%n%ci"',
      { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim().split('\n');
    return {
      lastCommitHash: result[0] || '',
      lastCommitMessage: result[1] || '',
      lastCommitDate: result[2] || '',
    };
  } catch {
    return { lastCommitHash: '', lastCommitMessage: '', lastCommitDate: '' };
  }
}

function detectLanguage(dir) {
  if (fs.existsSync(path.join(dir, 'package.json'))) return 'TypeScript';
  if (fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'Python';
  if (fs.existsSync(path.join(dir, 'go.mod'))) return 'Go';
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) return 'Rust';
  if (fs.existsSync(path.join(dir, 'pom.xml'))) return 'Java';
  if (fs.existsSync(path.join(dir, 'CMakeLists.txt'))) return 'C/C++';
  if (fs.existsSync(path.join(dir, 'Makefile'))) return 'Makefile';
  return 'Other';
}

function getDescription(dir, repoName) {
  const readmePath = path.join(dir, 'README.md');
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, 'utf-8');
    const noHtml = content.replace(/<[^>]+>/g, '');
    const noMd = noHtml
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1');
    const lines = noMd.split('\n');
    const firstLine = lines.find(l => {
      const t = l.trim();
      return t && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('===') && t.length > 3;
    });
    if (firstLine) return firstLine.trim().slice(0, 150);
  }
  return `${repoName} — local repository`;
}

function getGitHubRepoInfo(owner, repo, localCommitHash, localCommitDate) {
  const token = process.env.GITHUB_TOKEN;
  const headers = ['-H "User-Agent: repo-mind"'];
  if (token) {
    headers.push(`-H "Authorization: token ${token}"`);
  }
  const headersStr = headers.join(' ');

  const result = {
    topics: [],
    stars: 0,
    forks: 0,
    remote_commit_hash: '',
    remote_commit_date: '',
    compare_status: 'unknown',
    ahead_by: 0,
    behind_by: 0,
  };

  try {
    // 1. 获取 Repository 详情
    console.log(`  Fetching GitHub repo metadata for ${owner}/${repo}...`);
    const resp = execSync(
      `curl -s -m 5 ${headersStr} "https://api.github.com/repos/${owner}/${repo}"`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString();
    const data = JSON.parse(resp);

    if (data.message && data.message.includes('API rate limit')) {
      console.warn(`  ⚠️ GitHub API Rate Limit exceeded. Please set GITHUB_TOKEN.`);
      return result;
    }

    result.topics = data.topics || [];
    result.stars = data.stargazers_count || 0;
    result.forks = data.forks_count || 0;
    result.remote_commit_date = data.pushed_at || ''; // 默认使用 pushed_at 作为远端最后推送时间
    const defaultBranch = data.default_branch || 'main';

    // 2. 比较本地与远端的提交差异 (Compare Commits)
    if (localCommitHash) {
      if (token) {
        try {
          console.log(`  Comparing commits for ${owner}/${repo} (${localCommitHash.slice(0, 7)} vs ${defaultBranch})...`);
          const compareResp = execSync(
            `curl -s -m 5 ${headersStr} "https://api.github.com/repos/${owner}/${repo}/compare/${localCommitHash}...${defaultBranch}"`,
            { stdio: ['pipe', 'pipe', 'pipe'] }
          ).toString();
          const compareData = JSON.parse(compareResp);

          if (compareData.status) {
            result.compare_status = compareData.status; // identical, ahead, behind, diverged
            result.ahead_by = compareData.ahead_by || 0;
            result.behind_by = compareData.behind_by || 0;

            // 如果有 commits 差异，我们可以拿到真正的远端最新提交的哈希和时间
            if (compareData.commits && compareData.commits.length > 0) {
              const lastCommit = compareData.commits[compareData.commits.length - 1];
              result.remote_commit_hash = lastCommit.sha || '';
              if (lastCommit.commit && lastCommit.commit.committer) {
                result.remote_commit_date = lastCommit.commit.committer.date || result.remote_commit_date;
              }
            } else if (compareData.status === 'identical') {
              result.remote_commit_hash = localCommitHash;
              result.remote_commit_date = localCommitDate;
            }
          }
        } catch (err) {
          console.warn(`  ⚠️ Failed to compare commits: ${err.message}`);
        }
      } else {
        result.compare_status = 'unknown (set GITHUB_TOKEN to compare)';
      }
    }
  } catch (e) {
    console.warn(`  ⚠️ Failed to fetch GitHub data for ${owner}/${repo}: ${e.message}`);
  }

  return result;
}

const entries = fs.readdirSync(REPO_MIND_DIR, { withFileTypes: true });
let count = 0;

db.prepare('BEGIN').run();

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(REPO_MIND_DIR, entry.name);
  const gitConfig = parseGitConfig(dir);
  if (!gitConfig) continue;

  console.log(`Scanning: ${entry.name}`);
  const remoteUrl = gitConfig;
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  const owner = match ? match[1] : '';
  const repo = match ? match[2] : entry.name;

  const gitInfo = getGitInfo(dir);
  const language = detectLanguage(dir);
  const description = getDescription(dir, entry.name);

  // 1. 尝试从数据库加载已有的项目记录，以判断是否使用 24 小时缓存免网络拉取
  const existingProject = db.prepare('SELECT * FROM projects WHERE name = ?').get(entry.name);
  
  let needGitHubSync = true;
  let cachedAtStr = '';
  
  if (existingProject && existingProject.scanned_at) {
    const lastScanned = new Date(existingProject.scanned_at).getTime();
    const now = Date.now();
    const interval = now - lastScanned;
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    // 如果上一次扫描成功时间距离现在在 24 小时之内，且数据库中已有完好的比对结果
    // 【防空防限流残留脏数据保护】：如果库中存的 stars 恰好是 0，说明上一次很可能是因为限流 Rate Limit 失败残留的脏数据。
    // 此时自动打破 24 小时缓存锁，强行去重新联网拉取！一旦有了真实的数据存盘，下一次就会完美锁住。
    if (interval < twentyFourHours && existingProject.compare_status && existingProject.stars > 0) {
      needGitHubSync = false;
      cachedAtStr = new Date(existingProject.scanned_at).toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit'
      });
    }
  }

  let githubData = {
    topics: [],
    stars: 0,
    forks: 0,
    remote_commit_hash: '',
    remote_commit_date: '',
    compare_status: '',
    ahead_by: 0,
    behind_by: 0,
  };

  if (owner && repo) {
    if (needGitHubSync) {
      const freshData = getGitHubRepoInfo(owner, repo, gitInfo.lastCommitHash, gitInfo.lastCommitDate);
      
      // 【断网/限流防覆盖降级锁】：如果本次联网抓取因为 API 限流或网络超时失败了（stars为0且compare_status中带有error或limit字样）
      // 并且我们数据库中原本已经存有有价值的历史数据，则完美继承历史，拒绝被 0 脏值无情抹杀覆盖！
      if ((freshData.stars === 0 || freshData.compare_status.includes('error') || freshData.compare_status.includes('limit')) && existingProject) {
        githubData = {
          topics: freshData.topics.length > 0 ? freshData.topics : (typeof existingProject.topics === 'string' ? JSON.parse(existingProject.topics) : (existingProject.topics || [])),
          stars: existingProject.stars || 0,
          forks: existingProject.forks || 0,
          remote_commit_hash: existingProject.remote_commit_hash || '',
          remote_commit_date: existingProject.remote_commit_date || '',
          compare_status: existingProject.compare_status || '',
          ahead_by: existingProject.ahead_by || 0,
          behind_by: existingProject.behind_by || 0,
        };
      } else {
        githubData = freshData;
      }
    } else {
      // 完美沿用缓存数据
      githubData = {
        topics: typeof existingProject.topics === 'string' ? JSON.parse(existingProject.topics) : (existingProject.topics || []),
        stars: existingProject.stars || 0,
        forks: existingProject.forks || 0,
        remote_commit_hash: existingProject.remote_commit_hash || '',
        remote_commit_date: existingProject.remote_commit_date || '',
        compare_status: existingProject.compare_status || '',
        ahead_by: existingProject.ahead_by || 0,
        behind_by: existingProject.behind_by || 0,
      };
    }
  }

  upsertProject.run({
    name: entry.name,
    owner,
    repo,
    description,
    remote_url: remoteUrl,
    github_url: match ? `https://github.com/${owner}/${repo}` : '',
    language,
    topics: JSON.stringify(githubData.topics),
    last_commit_hash: gitInfo.lastCommitHash,
    last_commit_message: gitInfo.lastCommitMessage,
    last_commit_date: gitInfo.lastCommitDate,
    local_path: dir,
    scanned_at: needGitHubSync ? new Date().toISOString() : (existingProject ? existingProject.scanned_at : new Date().toISOString()),
    stars: githubData.stars,
    forks: githubData.forks,
    remote_commit_hash: githubData.remote_commit_hash,
    remote_commit_date: githubData.remote_commit_date,
    compare_status: githubData.compare_status,
    ahead_by: githubData.ahead_by,
    behind_by: githubData.behind_by,
  });

  // 格式化输出本地与远程分支比对状态
  let statusStr = '❔ 状态未知 (未配置 GITHUB_TOKEN)';
  if (githubData.compare_status) {
    if (githubData.compare_status === 'identical') {
      statusStr = '✅ 与远程完全同步';
    } else if (githubData.compare_status === 'ahead') {
      statusStr = `⚠️ 落后远程 ${githubData.ahead_by} 个版本 (落后提交)`;
      // 自动拉取最新代码
      try {
        const gitStatus = execSync('git status --porcelain', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
        if (!gitStatus) {
          console.log(`   ├─ 🔄 正在拉取最新代码...`);
          execSync('git pull --ff-only', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
          statusStr = '✅ 已拉取最新代码，与远程同步';
          githubData.compare_status = 'identical';
          githubData.ahead_by = 0;
          // 重新获取本地 commit 信息
          const newInfo = getGitInfo(dir);
          if (newInfo.lastCommitHash) {
            githubData.lastCommitHash = newInfo.lastCommitHash;
            githubData.lastCommitDate = newInfo.lastCommitDate;
          }
        } else {
          console.log(`   ├─ ⚠️ 有未提交的更改，跳过自动拉取`);
          statusStr += ' (有未提交更改，跳过拉取)';
        }
      } catch (pullErr) {
        console.log(`   ├─ ❌ 拉取失败: ${pullErr.message}`);
        statusStr += ' (拉取失败)';
      }
    } else if (githubData.compare_status === 'behind') {
      statusStr = `🔵 本地领先 ${githubData.behind_by} 个提交 (待推送)`;
    } else if (githubData.compare_status === 'diverged') {
      statusStr = `❌ 分支分叉 (+${githubData.behind_by}/-${githubData.ahead_by})`;
    } else if (githubData.compare_status.startsWith('unknown')) {
      statusStr = '❔ 状态未知 (未配置 GITHUB_TOKEN)';
    }
  }

  // 如果起用了缓存，在状态末尾打上高光标签
  if (!needGitHubSync && cachedAtStr) {
    statusStr += ` ⚡ [24h 缓存保护，上次同步: ${cachedAtStr}]`;
  }

  console.log(`✨ [${entry.name}] 本地分析就绪:`);
  console.log(`   ├─ 开发语言: ${language}`);
  if (owner && repo) {
    console.log(`   ├─ 远端统计: ⭐️ Stars: ${githubData.stars} | ⑂ Forks: ${githubData.forks}`);
    console.log(`   └─ 比对状态: ${statusStr}`);
  } else {
    console.log(`   └─ 本地专有 (无 GitHub 远程配置)`);
  }
  console.log(''); // 空行分隔，使输出清爽极简

  count++;
}

db.prepare('COMMIT').run();

// Also generate public/projects.json for the frontend
const projects = db.prepare('SELECT * FROM projects ORDER BY last_commit_date DESC').all();
const publicJsonPath = path.resolve(PUBLIC_DIR, 'projects.json');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(publicJsonPath, JSON.stringify(projects.map(p => ({
  ...p,
  topics: JSON.parse(p.topics),
})), null, 2));

db.close();
console.log(`\nDone! Indexed ${count} projects to data/data.db`);

// 写入扫描时间标记文件，供下次启动时判断是否跳过
try {
  fs.writeFileSync(SCAN_MARKER, new Date().toISOString());
} catch { /* 写失败也无所谓 */ }
