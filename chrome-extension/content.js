const API_BASE = 'http://localhost:3001';
const BUTTON_ID = 'github-index-import-btn';

function getRepoInfo() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1], fullName: `${parts[0]}/${parts[1]}` };
}

function isRepoPage() {
  const info = getRepoInfo();
  if (!info) return false;
  // 排除非仓库子页面（settings、actions 等顶层 tab 仍算仓库页）
  return true;
}

function createButton() {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.className = 'gi-btn';
  btn.innerHTML = `
    <svg class="gi-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
    <span class="gi-text">导入到 github-index</span>
  `;
  btn.title = '导入到本地 github-index';
  return btn;
}

function setBtnState(btn, state, message) {
  btn.classList.remove('gi-loading', 'gi-success', 'gi-error');
  const textEl = btn.querySelector('.gi-text');

  switch (state) {
    case 'loading':
      btn.classList.add('gi-loading');
      btn.disabled = true;
      textEl.textContent = message || '导入中...';
      break;
    case 'success':
      btn.classList.add('gi-success');
      btn.disabled = true;
      textEl.textContent = '✓ 已导入';
      break;
    case 'error':
      btn.classList.add('gi-error');
      btn.disabled = false;
      textEl.textContent = message || '失败，点击重试';
      setTimeout(() => {
        btn.classList.remove('gi-error');
        textEl.textContent = '导入到 github-index';
      }, 3000);
      break;
    default:
      btn.disabled = false;
      textEl.textContent = '导入到 github-index';
  }
}

async function handleImport(btn) {
  const info = getRepoInfo();
  if (!info) return;

  setBtnState(btn, 'loading', '解析中...');

  try {
    const response = await fetch(`${API_BASE}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubUrl: info.fullName }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setBtnState(btn, 'error', err.error || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const statusMap = {
      analyzing: '解析中...',
      cloning: '克隆中...',
      scanning: '扫描中...',
      syncing: '同步中...',
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.status === 'done') {
            setBtnState(btn, 'success');
            return;
          } else if (data.status === 'error') {
            // 已存在的项目显示为"已导入"而非错误
            if (data.message && data.message.includes('已存在')) {
              setBtnState(btn, 'success');
            } else {
              setBtnState(btn, 'error', data.message);
            }
            return;
          } else {
            setBtnState(btn, 'loading', statusMap[data.status] || data.message || '处理中...');
          }
        } catch {}
      }
    }
    // 如果流正常结束但没收到 done
    setBtnState(btn, 'success');
  } catch (err) {
    setBtnState(btn, 'error', '服务器未启动');
  }
}

function injectButton() {
  // 避免重复注入
  if (document.getElementById(BUTTON_ID)) return;
  if (!isRepoPage()) return;

  // GitHub 仓库页面的 Star/Fork 按钮区域
  // 尝试多种选择器以兼容 GitHub 不同布局
  const selectors = [
    'ul.pagehead-actions',           // 经典布局
    '.pagehead-actions',             // 备选
    '[class*="HeaderActions"]',      // 新版布局
  ];

  let container = null;
  for (const sel of selectors) {
    container = document.querySelector(sel);
    if (container) break;
  }

  // 如果找不到 action 区域，放在 repo name 旁边
  if (!container) {
    const repoName = document.querySelector('[itemprop="name"]')?.closest('div');
    if (repoName) {
      container = repoName.parentElement;
    }
  }

  if (!container) return;

  const btn = createButton();
  btn.addEventListener('click', () => handleImport(btn));

  // 插入到容器末尾
  const li = document.createElement('li');
  li.className = 'gi-btn-wrapper';
  li.appendChild(btn);
  container.appendChild(li);
}

// GitHub 是 SPA，需要监听 URL 变化
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    // URL 变化时重新注入
    setTimeout(injectButton, 500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// 初始注入
injectButton();
// 延迟再试一次（GitHub 页面可能还没完全加载）
setTimeout(injectButton, 1000);
setTimeout(injectButton, 3000);
