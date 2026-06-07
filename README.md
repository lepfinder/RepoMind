# GitHub Index — 本地 GitHub 项目知识索引与 AI 助理

GitHub Index 是一款专为开发者打造的**本地 Git 仓库智能检索与 AI 问答助理**。它能够自动扫描本地指定目录下的所有 Git 仓库，智能解析项目的依赖及 README 信息，并将元数据持久化在本地 SQLite 数据库中。结合本地 AI 大模型（基于 Hermes API Gateway），开发者可以对任意项目进行一键智能分析和深度交互式提问，甚至可以直接在网页端一键使用 VS Code 或 Finder 快速拉起本地项目。

---

## 核心特性

- **自动化仓库扫描与丰富元数据索引**：一键递归扫描本地 `~/workspace/github` 目录下的所有 Git 仓库，智能检测其开发语言、抓取最新提交记录（Hash、Message、Date），实时同步 GitHub 远端的 Stars、Forks 数及 Topics 标签。
- **本地与远程版本精确比对**：自动检测并显示本地分支与 GitHub 远端默认分支的版本领先/落后提交数（Behind/Ahead），在本地代码落后远端时予以醒目的高亮警示。并排横向对比本地最后提交时间与远端最后推送时间。
- **GitHub 仓库一键导入**：在网页端输入 GitHub 链接或 `owner/repo`，自动克隆至本地工作区，提取元数据并同步远端统计信息，全程 SSE 流式进度展示。
- **深度本地 AI 智能分析**：通过 Hermes API Gateway（OpenAI 兼容协议）调用本地大模型，自动读取项目文件并生成分析报告。支持 SSE 流式输出、工具调用进度实时展示、会话连续性（多轮追问），分析结果自动持久化到本地数据库。
- **内置代码浏览器**：项目详情页内置递归文件树，支持目录展开/折叠，点击文件即可预览内容。Markdown 文件自动渲染，其他文件使用 Prism 语法高亮（支持 20+ 语言），附带一键复制代码功能。
- **无缝的本地开发流集成**：
  - 一键拉起 VS Code 打开项目目录
  - Finder 快速定位项目物理路径
  - GitHub 远程直达仓库页面
  - CodeWiki 一键跳转查看项目文档
- **项目物理清除**：支持安全删除本地项目文件及数据库索引，带二次确认弹窗和路径安全校验。
- **亮色/暗色主题切换**：基于 React 19 和 Tailwind CSS v4 打造的现代界面，支持亮色与暗色主题一键切换并自动记忆偏好。支持实时多条件模糊搜索和语言标签筛选。

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
| **AI 引擎** | Hermes API Gateway | 通过 OpenAI 兼容的 Chat Completions 协议调用本地大模型，支持 SSE 流式输出与工具调用 |

---

## 项目结构

```text
github-index/
├── scripts/
│   └── scan.mjs              # 本地 Git 仓库扫描器（生成 SQLite 数据库及 public/projects.json）
├── server/
│   ├── db.mjs                # 数据库初始化、表结构定义、Schema 自动升级及预处理 SQL 语句
│   └── index.mjs             # Express 后端服务（REST API + SSE 流式分析 + 项目导入/删除）
├── src/
│   ├── components/
│   │   ├── ProjectCard.tsx    # 项目卡片组件（Stars/Forks、语言标签、同步状态徽章）
│   │   └── ProjectDetail.tsx  # 项目详情页（文件浏览器、README 渲染、AI 问答面板、操作按钮）
│   ├── App.tsx               # 主页面布局、搜索过滤、导入弹窗、扫描触发
│   ├── types.ts              # TypeScript 类型定义
│   └── main.tsx              # 前端应用入口
├── public/
│   └── projects.json         # 扫描器生成的项目快照（供前端离线加载）
├── data/
│   ├── data.db               # 自动生成的 SQLite 数据库文件
│   └── .last-scan            # 扫描时间标记（用于 24 小时节流判断）
└── package.json              # 运行脚本及依赖配置
```

---

## 快速上手

### 1. 前置准备

- **Node.js** 环境（建议 v18+）。
- 本地运行 **Hermes API Gateway**（默认监听 `http://127.0.0.1:8642`），并确保 API Key 配置在 `~/.hermes/.env` 中的 `API_SERVER_KEY` 字段。
- 您的本地 Git 项目统一存放于 `~/workspace/github` 路径下（可自行修改 `scripts/scan.mjs` 中的 `GITHUB_DIR` 路径）。
- （可选）设置 `GITHUB_TOKEN` 环境变量以启用 GitHub API 同步（Stars/Forks/Topics 及本地与远端提交比对）。

### 2. 安装依赖

```bash
npm install
```

### 3. 一键启动开发环境

```bash
npm run dev
```

> 前端开发页面运行于 **`http://localhost:3000`**，后端 API 服务运行于 **`http://localhost:3001`**。

---

## 核心命令

| 命令 | 说明 |
| :--- | :--- |
| `npm run scan` | **索引扫描器**：遍历 `~/workspace/github`，读取各仓库的提交记录、解析描述与语言分类，同步 GitHub 远端数据，保存至 SQLite 并生成 `public/projects.json` 快照。 |
| `npm run server` | **API 服务**：启动 Express 后端，对外暴露项目查询、AI 分析、导入、删除等 API。 |
| `npm run dev` | **联调启动**：先执行扫描，然后同时以热更新模式拉起 React 前端与 Express 后端。 |
| `npm run build` | **生产构建**：扫描后编译 TypeScript 并在 `dist` 中打包生产包。 |

---

## AI 分析的运作原理

1. **发起请求**：前端将项目名称和用户问题发送至 `POST /api/analyze`。
2. **构建系统提示词**：后端组装包含项目名称和本地路径的系统提示词，由 Hermes Agent 自主决定读取哪些项目文件。
3. **Hermes API Gateway 流式推理**：后端通过 OpenAI 兼容的 Chat Completions 协议向本地 Hermes Gateway 发起 SSE 流式请求，并通过 `X-Hermes-Session-Id` 请求头保持会话连续性。
4. **实时流式输出**：前端通过 SSE 接收逐 Token 的流式响应及工具调用进度事件（如读取文件、执行命令），实时渲染 Markdown 内容与代码高亮。
5. **历史存档**：每轮问答自动落库至 SQLite 的 `analysis` 表，下次打开项目时自动加载历史对话。

---

## API 接口一览

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/projects` | 获取全部项目列表 |
| `GET` | `/api/projects/:name` | 获取单个项目详情及分析历史 |
| `GET` | `/api/projects/:name/readme` | 读取项目的 README.md 内容 |
| `GET` | `/api/projects/:name/files` | 获取项目的递归文件树结构 |
| `GET` | `/api/projects/:name/file?path=` | 读取指定文件内容（带路径穿越防护） |
| `POST` | `/api/analyze` | SSE 流式 AI 分析（支持多轮追问） |
| `POST` | `/api/analyze/stop` | 取消进行中的分析请求 |
| `POST` | `/api/import` | SSE 流式导入 GitHub 仓库 |
| `POST` | `/api/scan` | SSE 流式触发全量扫描 |
| `POST` | `/api/open-folder` | 在 macOS Finder 中打开项目目录 |
| `DELETE` | `/api/projects/:name` | 安全删除项目（物理文件 + 数据库记录） |

---

## 安全设计

- **路径穿越防护**：文件读取接口严格校验目标路径，防止通过 `../` 访问项目目录外的文件。
- **删除安全边界**：项目删除操作限定在 `~/workspace/github` 工作区内，拒绝删除工作区外的任何路径。
- **文件大小限制**：文件预览接口限制 1MB，防止读取二进制大文件导致服务崩溃。
- **GitHub API 降级保护**：扫描器在 GitHub API 限流或网络异常时，保留数据库中的历史数据，不会用空值覆盖。

---

## 贡献与自定义

- **自定义语言检测**：修改 `scripts/scan.mjs` 中的 `detectLanguage` 函数以支持更多开发语言。
- **扩展扫描目录**：修改 `scripts/scan.mjs` 中的 `GITHUB_DIR` 常量指向您的本地项目目录。
- **自定义排除规则**：修改 `server/index.mjs` 中 `/api/projects/:name/files` 端点的 `excludeDirs` 集合以调整文件浏览器的过滤规则。
- **调整 AI 行为**：修改 `server/index.mjs` 中 `/api/analyze` 端点的 `systemPrompt` 以定制 AI 分析助手的角色与指令。

> 这是一个完全运行于**本地**的工具，绝不上传您的任何本地代码和文件，保证了您本地商业项目及私有资产的绝对代码隐私和安全性。
