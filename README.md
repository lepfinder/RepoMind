# ⚡ GitHub Index — 本地 GitHub 项目知识索引与 AI 助理

GitHub Index 是一款专为开发者打造的**本地 Git 仓库智能检索与 AI 问答助理**。它能够自动扫描本地指定目录下的所有 Git 仓库，智能解析项目的依赖及 README 信息，并将元数据持久化在本地 SQLite 数据库中。结合本地 AI 大模型（基于 `hermes` 命令行工具），开发者可以对任意项目进行一键智能分析和深度交互式提问，甚至可以直接在网页端一键使用 VS Code 或 Finder 快速拉起本地项目。

---

## ✨ 核心特性

- 🔍 **自动化仓库扫描与丰富元数据索引**：一键递归扫描本地 `~/workspace/github` 目录下的所有 Git 仓库，不仅能智能检测其开发语言、抓取最新提交记录（Hash、Message、Date），更能实时同步 GitHub 远端的 **Stars ⭐️ 数、Forks 🍴 数**。
- 🔄 **本地与远程版本精确比对（Compare）**：
  - 自动检测并显示本地分支与 GitHub 远端默认分支的**版本领先/落后提交数**（Behind/Ahead），并在本地代码落后远端时予以醒目的高亮警示，友好提示 `git pull` 保持同步。
  - 并排横向对比**本地最后提交时间**与**远端最后推送时间**，时间线变化一目了然。
- 🤖 **深度本地 AI 智能分析**：
  - **自动上下文构建**：自动读取项目的 `README.md` 前 30 行、`package.json`（依赖与脚本）、`requirements.txt` 或 `go.mod` 并形成提示词上下文。
  - **一键项目报告**：利用本地部署的 `hermes` 大模型 CLI，秒级生成包含项目一句话概述、技术栈构成、结构亮点及值得关注点的分析报告。
  - **交互式项目问答**：支持对特定本地项目输入自定义问题进行交互问答，分析结果与问答记录自动持久化到本地。
- 💻 **无缝的本地开发流集成**：
  - 🛠️ **一键拉起 VS Code**：在网页端直接点击按钮，即可通过 VS Code 在本地瞬间打开选中的项目目录。
  - 📂 **Finder 快速定位**：直接在系统 Finder 中打开该项目物理路径。
  - 🌐 **GitHub 远程直达**：如果项目有关联的 GitHub 远程源，支持一键直达其网页端仓库。
- 🎨 **极致美观的暗黑系界面**：基于 React 19 和 Tailwind CSS 打造的现代玻璃拟物态（Glassmorphism）暗黑美学界面，支持实时多条件模糊搜索和语言标签筛选。

---

## 🛠️ 技术栈

| 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | React 19 + TypeScript + Vite 8 | 提供极速的 HMR 开发体验与类型安全的组件渲染。 |
| **样式系统** | Tailwind CSS v4 | 使用下一代高性能 CSS 工具构建高保真的现代界面。 |
| **Markdown 渲染** | React Markdown + Remark GFM | 优雅呈现 AI 生成的项目报告，支持 GitHub 风格的表格、代码高亮等。 |
| **后端服务** | Express.js v5 | 提供轻量级的流式 SSE 协议及数据查询 API。 |
| **本地数据库** | Better-SQLite3 | 嵌入式高性能 SQLite，启用 WAL（预写日志）模式以实现极致的并发读性能。 |
| **AI 引擎** | Hermes CLI | 调用本地命令行大语言模型助理进行极速安全的离线推理与项目分析。 |

---

## 📂 项目结构

```text
github-index/
├── scripts/
│   └── scan.mjs          # 本地 Git 仓库扫描器（生成 SQLite 数据库及 public/projects.json）
├── server/
│   ├── db.mjs            # 数据库初始化、数据表结构定义及预处理 SQL 语句
│   └── index.mjs         # Express 后端服务（处理 API 请求与调用 Hermes 大模型进行流式分析）
├── src/
│   ├── components/
│   │   ├── ProjectCard.tsx    # 项目卡片组件
│   │   └── ProjectDetail.tsx  # 项目详情、本地联动操作及 AI 分析问答交互面板
│   ├── App.tsx           # 主页面布局与筛选过滤逻辑
│   ├── types.ts          # TypeScript 类型定义
│   └── main.tsx          # 前端应用入口
├── data/
│   └── data.db           # 自动生成的本地 SQLite 3 数据库文件
└── package.json          # 运行脚本及依赖配置
```

---

## 🚀 快速上手

### 1. 前置准备

在运行本项目前，请确保满足以下条件：
- **Node.js** 环境（建议 v18+）。
- 本地配置并安装了 **Hermes CLI** 大模型聊天工具（命令行中 `hermes` 可用）。
- 您的本地 Git 项目统一存放于 `~/workspace/github` 路径下（如果存放于其他路径，可自行修改 `scripts/scan.mjs` 中的 `GITHUB_DIR` 路径）。

### 2. 安装依赖

在项目根目录下执行以下命令安装前端与后端的所有依赖：

```bash
npm install
```

### 3. 一键启动开发环境

执行以下命令，该命令会**自动进行本地项目扫描**，然后**同时启动**前端开发服务器与后端服务：

```bash
npm run dev
```

> [!TIP]
> 前端开发页面将运行于 **`http://localhost:3000`**，后端 AI API 服务将运行于 **`http://localhost:3001`**。

---

## ⚙️ 核心命令详解

| 运行命令 | 对应脚本 / 动作 | 详细说明 |
| :--- | :--- | :--- |
| `npm run scan` | `node scripts/scan.mjs` | **索引扫描器**：遍历本地的 `~/workspace/github` 并读取各个仓库的最后一次提交、解析描述与语言分类，保存至 SQLite 中并为前端生成快照 `projects.json`。 |
| `npm run server` | `node server/index.mjs` | **API 服务**：启动本地的 Express 后端，对外暴露项目列表查询与大模型 AI 分析 API。 |
| `npm run dev` | `npm run scan && concurrently ...` | **联调启动**：首先执行扫描动作，随后同时以监控热更新模式拉起 React 前端与 Express 后端。 |
| `npm run build` | `npm run scan && tsc -b && vite build` | **生产构建**：扫描后编译 TypeScript 并在 `dist` 中打包出极致优化的小体积生产包。 |

---

## 💡 AI 分析的运作原理

1. **信息聚合**：在发起分析时，后端会自动检索所选项目在本地盘的实际路径。
2. **提取上下文**：智能调阅该项目的 README、依赖描述文件（`package.json`/`requirements.txt`/`go.mod`）等。
3. **Hermes 离线推理**：后端组装 Prompt 并调用本地命令行接口：
   ```bash
   hermes chat -q '<提示词与项目上下文>' -Q
   ```
4. **历史存档**：分析得到的结果不仅会流式返回至前端的 Markdown 渲染器，更会随问题一同落库至 SQLite 数据库的 `analysis` 表中，以便后续快速调阅。

> [!NOTE]
> 这是一个完全运行于**本地**的工具，绝不上传您的任何本地代码和文件，保证了您本地商业项目及私有资产的绝对代码隐私和安全性。

---

## 🤝 贡献与自定义

- **自定义语言检测**：若要让项目检测支持更多开发语言，可以修改 [scripts/scan.mjs](file:///Users/xiyangxie/workspace/github/github-index/scripts/scan.mjs) 中的 `detectLanguage` 函数。
- **扩展 AI 分析上下文**：您可以编辑 [server/index.mjs](file:///Users/xiyangxie/workspace/github/github-index/server/index.mjs) 中的 `getProjectContext` 以收集如 `.env.example` 或 `docker-compose.yml` 等更多有助于项目分析的配置文件。

