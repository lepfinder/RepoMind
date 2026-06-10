# 技术栈与项目结构

## 技术栈

| 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | React 19 + TypeScript + Vite 8 | 提供极速的 HMR 开发体验与类型安全的组件渲染 |
| **样式系统** | Tailwind CSS v4 | 使用下一代高性能 CSS 工具构建高保真的现代界面 |
| **Markdown 渲染** | React Markdown + Remark GFM + Rehype Raw | 优雅呈现 AI 生成的项目报告，支持 GitHub 风格表格、代码高亮及原始 HTML |
| **代码高亮** | React Syntax Highlighter (Prism) | 内置代码浏览器中的多语言语法高亮 |
| **图标库** | Lucide React | 轻量级高质量 SVG 图标集 |
| **后端服务** | Express.js v5 | 提供 REST API 及流式 SSE 协议 |
| **本地数据库** | Better-SQLite3 | 嵌入式高性能 SQLite，启用 WAL 模式以实现极致的并发读性能 |
| **AI 引擎 — Hermes** | Hermes API Gateway | 通过 OpenAI 兼容的 Chat Completions 协议调用本地大模型，支持 SSE 流式输出与工具调用进度事件 |
| **AI 引擎 — Claude Code** | Anthropic Claude Code CLI | 通过 spawn 子进程调用 `claude` CLI，解析 `stream-json` 输出，支持 Thinking 推理折叠、tool_use 实时展示（Read/Bash/Grep/Glob 等） |
| **浏览器扩展** | Chrome Extension (Manifest V3) | 在 GitHub 仓库页面注入导入/查看按钮，SSE 流式进度展示 |

---

## 项目结构

```text
RepoMind/
├── scripts/
│   └── scan.mjs                 # 本地 Git 仓库扫描器（生成 SQLite 数据库及 public/projects.json）
├── server/
│   ├── providers/
│   │   ├── hermes.mjs           # Hermes AI Provider（OpenAI 兼容协议，SSE 流式 + 工具进度事件）
│   │   └── claude-code.mjs      # Claude Code AI Provider（spawn CLI，stream-json 解析，Thinking 折叠）
│   ├── db.mjs                   # 数据库初始化、表结构定义、Schema 自动升级及预处理 SQL 语句
│   └── index.mjs                # Express 后端服务（REST API + SSE 流式分析 + 项目导入/删除 + 项目组 + 设置）
├── src/
│   ├── components/
│   │   ├── ProjectCard.tsx      # 项目卡片组件（Stars/Forks、语言标签、同步状态徽章）
│   │   ├── ProjectDetail.tsx    # 项目详情页（三栏布局：文件树 + 代码预览 + AI 问答面板）
│   │   ├── WorkspaceList.tsx    # 项目组列表页（创建/删除项目组，多选项目）
│   │   ├── WorkspaceDetail.tsx  # 项目组详情页（项目列表 + AI 对比对话 + 历史记录）
│   │   └── SettingsModal.tsx    # 设置面板（AI Provider 选择与可用性检测）
│   ├── App.tsx                  # 主页面布局、搜索过滤、导入弹窗、扫描触发
│   ├── types.ts                 # TypeScript 类型定义
│   └── main.tsx                 # 前端应用入口
├── chrome-extension/
│   ├── manifest.json            # Chrome 扩展清单（Manifest V3）
│   ├── content.js               # 内容脚本（GitHub 页面注入导入/查看按钮）
│   └── content.css              # 注入按钮样式
├── public/
│   └── projects.json            # 扫描器生成的项目快照（供前端离线加载）
├── data/
│   ├── data.db                  # 自动生成的 SQLite 数据库文件
│   └── .last-scan               # 扫描时间标记（用于 24 小时节流判断）
└── package.json                 # 运行脚本及依赖配置
```
