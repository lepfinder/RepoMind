# RepoMind — 本地 GitHub 项目深度研究助理

RepoMind 是一款专为开发者打造的**本地 Git 仓库深度研究助理**。它能够自动扫描本地指定目录下的所有 Git 仓库，智能解析项目的依赖及 README 信息，并将元数据持久化在本地 SQLite 数据库中。内置**双 AI 引擎**（Hermes API Gateway + Claude Code CLI），开发者可以对任意项目进行一键智能分析和深度交互式提问，还能将多个同类项目打包为「项目组」进行跨项目批量对比分析。此外，配套的 Chrome 浏览器扩展支持在 GitHub 页面一键导入项目或直达本地详情。

---

## 核心特性

- **自动化仓库扫描与丰富元数据索引**：一键递归扫描本地 GitHub 项目目录下的所有 Git 仓库，智能检测其开发语言、抓取最新提交记录（Hash、Message、Date），实时同步 GitHub 远端的 Stars、Forks 数及 Topics 标签。
- **本地与远程版本精确比对**：自动检测并显示本地分支与 GitHub 远端默认分支的版本领先/落后提交数（Behind/Ahead），在本地代码落后远端时予以醒目的高亮警示。并排横向对比本地最后提交时间与远端最后推送时间。
- **GitHub 仓库一键导入**：在网页端输入 GitHub 链接或 `owner/repo`，自动克隆至本地工作区，提取元数据并同步远端统计信息，全程 SSE 流式进度展示。
- **双 AI 引擎深度分析**：支持两种可热切换的 AI Provider，在设置面板中一键选择：
  - **Hermes**：通过 OpenAI 兼容协议调用本地部署的 Hermes API Gateway，支持 SSE 流式输出、工具调用进度实时展示、会话连续性（多轮追问）。
  - **Claude Code**：调用 Anthropic Claude Code CLI，支持文件读写、代码搜索、终端命令等丰富工具调用，实时展示 AI 正在读取的文件和执行的操作，支持 Thinking 推理过程折叠展示。
- **项目组跨项目对比分析**：将多个同类项目打包为一个逻辑「项目组」，AI 并行分析每个项目后自动生成对比总结表格，包含设计差异、亮点提炼和方案推荐。各项目独立分析结果可展开查看，历史问答记录支持随时回顾。
- **内置代码浏览器**：项目详情页采用三栏布局（文件树 + 代码预览 + AI 分析面板），支持目录展开/折叠，点击文件即可预览内容。Markdown 文件自动渲染，其他文件使用语法高亮（支持 20+ 语言），支持图片文件预览，附带一键复制代码功能。
- **Chrome 浏览器扩展**：在 GitHub 仓库页面自动注入「导入到 RepoMind」或「在 RepoMind 查看」按钮，支持 SSE 流式导入进度展示，无缝衔接浏览器与本地工具链。
- **无缝的本地开发流集成**：
  - 一键拉起 VS Code 打开项目目录
  - Finder 快速定位项目物理路径
  - GitHub 远程直达仓库页面
  - 一键 `git pull` 同步最新代码
- **项目物理清除**：支持安全删除本地项目文件及数据库索引，带二次确认弹窗和路径安全校验。
- **亮色/暗色主题切换**：基于 React 19 和 Tailwind CSS v4 打造的现代界面，支持亮色与暗色主题一键切换并自动记忆偏好。支持实时多条件模糊搜索、语言标签筛选和多维度排序。

---

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

---

## 快速上手

### 1. 前置准备

- **Node.js** 环境（建议 v18+）。
- **AI 引擎**（至少配置其一）：
  - **Hermes**：本地运行 Hermes API Gateway（默认监听 `http://127.0.0.1:8642`），并确保 API Key 配置在 `~/.hermes/.env` 中的 `API_SERVER_KEY` 字段。
  - **Claude Code**：安装 Anthropic Claude Code CLI（`claude` 命令可用即可），支持文件读写、代码搜索等工具调用。
- （可选）设置 `GITHUB_TOKEN` 环境变量以启用 GitHub API 同步（Stars/Forks/Topics 及本地与远端提交比对）。
- （可选）安装 Chrome 扩展以获得 GitHub 页面一键导入体验。

### 2. 配置扫描目录

默认扫描目录为 `~/workspace/github`。如果你的 GitHub 项目存放在其他路径，请设置环境变量：

```bash
# 在 .zshrc / .bashrc 中添加：
export REPO_MIND_DIR="/your/custom/path/to/github/projects"
```

或在启动命令时传入：

```bash
REPO_MIND_DIR="/your/custom/path" npm run dev
```

### 3. 安装依赖

```bash
npm install
```

### 4. 一键启动开发环境

```bash
npm run dev
```

> 前端开发页面运行于 **`http://localhost:3000`**，后端 API 服务运行于 **`http://localhost:3001`**。

---

## 核心命令

| 命令 | 说明 |
| :--- | :--- |
| `npm run scan` | **索引扫描器**：遍历 `REPO_MIND_DIR`（默认 `~/workspace/github`），读取各仓库的提交记录、解析描述与语言分类，同步 GitHub 远端数据，保存至 SQLite 并生成 `public/projects.json` 快照。 |
| `npm run server` | **API 服务**：启动 Express 后端，对外暴露项目查询、AI 分析、导入、删除等 API。 |
| `npm run dev` | **联调启动**：先执行扫描，然后同时以热更新模式拉起 React 前端与 Express 后端。 |
| `npm run build` | **生产构建**：扫描后编译 TypeScript 并在 `dist` 中打包生产包。 |

---

## AI 分析的运作原理

项目支持两种 AI Provider，可在右上角设置面板中热切换：

### Hermes 引擎

1. **发起请求**：前端将项目名称和用户问题发送至 `POST /api/analyze`。
2. **构建系统提示词**：后端组装包含项目名称和本地路径的系统提示词，由 Hermes Agent 自主决定读取哪些项目文件。
3. **Hermes API Gateway 流式推理**：后端通过 OpenAI 兼容的 Chat Completions 协议向本地 Hermes Gateway 发起 SSE 流式请求，并通过 `X-Hermes-Session-Id` 请求头保持会话连续性。
4. **实时流式输出**：前端通过 SSE 接收逐 Token 的流式响应及工具调用进度事件（如读取文件、执行命令），实时渲染 Markdown 内容与代码高亮。
5. **历史存档**：每轮问答自动落库至 SQLite 的 `analysis` 表，下次打开项目时自动加载历史对话。

### Claude Code 引擎

1. **发起请求**：同样通过 `POST /api/analyze` 触发，后端选择当前激活的 Claude Code Provider。
2. **Spawn CLI 进程**：后端通过 `child_process.spawn` 启动 `claude` CLI，传入 `--output-format stream-json --verbose` 等参数，在项目目录下执行。
3. **流式 JSON 解析**：实时解析 CLI 输出的 `stream_event`（content_block_start/delta/stop）和 `assistant` 事件，提取文本内容、Thinking 推理过程和工具调用信息。
4. **丰富的工具展示**：AI 调用 Read/Bash/Grep/Glob 等工具时，前端实时展示正在读取的文件路径、执行的命令等操作，Thinking 推理过程以可折叠的 `<details>` 块呈现。
5. **历史存档**：与 Hermes 引擎共享同一套 `analysis` 表，分析结果统一持久化。

---

## API 接口一览

### 项目

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/projects` | 获取全部项目列表 |
| `GET` | `/api/projects/:name` | 获取单个项目详情及分析历史 |
| `GET` | `/api/projects/:name/readme` | 读取项目的 README.md 内容 |
| `GET` | `/api/projects/:name/files` | 获取项目的递归文件树结构 |
| `GET` | `/api/projects/:name/file?path=` | 读取指定文件内容（带路径穿越防护） |
| `DELETE` | `/api/projects/:name` | 安全删除项目（物理文件 + 数据库记录） |

### AI 分析

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `POST` | `/api/analyze` | SSE 流式 AI 分析（支持多轮追问，自动选择当前激活的 Provider） |
| `POST` | `/api/analyze/stop` | 取消进行中的分析请求 |
| `GET` | `/api/ai-status` | 检测各 AI Provider 的可用性状态 |

### 项目组

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/workspaces` | 获取所有项目组列表 |
| `POST` | `/api/workspaces` | 创建项目组（可附带初始项目） |
| `DELETE` | `/api/workspaces/:id` | 删除项目组 |
| `POST` | `/api/workspaces/:id/projects` | 向项目组添加项目 |
| `DELETE` | `/api/workspaces/:id/projects/:pid` | 从项目组移除项目 |
| `GET` | `/api/workspaces/:id/sessions` | 获取项目组的分析历史会话 |
| `POST` | `/api/workspaces/:id/analyze` | SSE 流式批量对比分析（并行 + 汇总） |

### 工具与设置

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `POST` | `/api/import` | SSE 流式导入 GitHub 仓库 |
| `POST` | `/api/scan` | SSE 流式触发全量扫描 |
| `POST` | `/api/git-pull` | 一键拉取远程最新代码 |
| `POST` | `/api/open-folder` | 在 macOS Finder 中打开项目目录 |
| `GET` | `/api/settings` | 获取所有设置项 |
| `PUT` | `/api/settings` | 更新设置项（如切换 AI Provider） |

---

## 安全设计

- **路径穿越防护**：文件读取接口严格校验目标路径，防止通过 `../` 访问项目目录外的文件。
- **删除安全边界**：项目删除操作限定在 `REPO_MIND_DIR` 配置的目录下，拒绝删除该范围外的任何路径。
- **文件大小限制**：文件预览接口限制 1MB，防止读取二进制大文件导致服务崩溃。
- **GitHub API 降级保护**：扫描器在 GitHub API 限流或网络异常时，保留数据库中的历史数据，不会用空值覆盖。

---

## 贡献与自定义

- **自定义语言检测**：修改 `scripts/scan.mjs` 中的 `detectLanguage` 函数以支持更多开发语言。
- **自定义排除规则**：修改 `server/index.mjs` 中 `/api/projects/:name/files` 端点的 `excludeDirs` 集合以调整文件浏览器的过滤规则。
- **调整 AI 行为**：修改 `server/index.mjs` 中 `/api/analyze` 端点的 `systemPrompt` 以定制 AI 分析助手的角色与指令。
- **添加新的 AI Provider**：在 `server/providers/` 下新建 Provider 文件，实现 `name`、`displayName`、`isAvailable()`、`analyze()` 接口，然后在 `server/index.mjs` 的 `providers` 对象中注册即可。
- **安装 Chrome 扩展**：在 Chrome 浏览器中加载 `chrome-extension/` 目录作为「开发者模式」扩展，即可在 GitHub 仓库页面获得一键导入和查看按钮。

> 这是一个完全运行于**本地**的工具，绝不上传您的任何本地代码和文件，保证了您本地商业项目及私有资产的绝对代码隐私和安全性。
