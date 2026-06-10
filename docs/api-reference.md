# API 接口与开发指南

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
