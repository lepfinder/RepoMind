# Chrome 浏览器扩展

Chrome 扩展会在 GitHub 仓库页面自动注入操作按钮，让用户无需离开浏览器即可一键导入项目或直达本地详情。

---

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」开关
3. 点击「加载已解压的扩展程序」，选择本项目的 `chrome-extension/` 目录
4. 确保 RepoMind 后端服务已启动（`npm run dev`，运行在 `http://localhost:3001`）

---

## 功能

| 场景 | 注入按钮 | 行为 |
| :--- | :--- | :--- |
| 浏览**未导入**的仓库 | 「导入到 RepoMind」 | 点击后调用 `POST /api/import`，通过 SSE 流式展示解析→克隆→扫描→同步四步进度。已存在的项目自动识别为「已导入」状态 |
| 浏览**已导入**的仓库 | 「在 RepoMind 查看」 | 点击后新标签页打开 `http://localhost:3000?project={repo}`，直达项目详情页 |

> 扩展仅在 `https://github.com/*/*` 仓库页面生效，需要 RepoMind 后端服务运行在 `http://localhost:3001`。

---

## 技术细节

- **Manifest V3**：使用 `content_scripts` 注入，匹配 `https://github.com/*/*` 仓库页面
- **权限范围**：仅申请 `activeTab` 权限和 `http://localhost:3001/*` 的 host_permissions
- **GitHub SPA 兼容**：通过 `MutationObserver` 监听 URL 变化，自动重新注入按钮
- **按钮注入位置**：自动探测 GitHub 页面头部的 `pagehead-actions` 或 `HeaderActions` 容器
- **错误处理**：后端未启动时显示「服务器未启动」提示，导入失败时 3 秒后自动恢复按钮状态
