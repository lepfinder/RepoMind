import type { Project } from '../types'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useState, useEffect, useRef } from 'react'
import { 
  ArrowLeft, 
  Trash2, 
  Star, 
  GitFork, 
  AlertTriangle, 
  Zap, 
  BookOpen, 
  MessageSquare, 
  Search,
  Info,
  ChevronRight,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText
} from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isComplete?: boolean
}

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface Props {
  project: Project
  onBack: () => void
  langColor: string
  onDeleted?: () => void
}

const API_BASE = 'http://localhost:3001'

const lightMarkdownComponents = {
  code({ className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    const hasNewline = String(children).includes('\n')

    if (match || hasNewline) {
      return (
        <div className="my-3.5 rounded-xl overflow-hidden border border-gray-200" style={{ background: '#f6f8fa' }}>
          <SyntaxHighlighter
            language={match ? match[1] : 'text'}
            style={ghcolors}
            customStyle={{
              margin: 0,
              padding: '1.2rem 1rem',
              background: '#f6f8fa',
              fontSize: '11px',
              lineHeight: '1.65',
            }}
            PreTag={({ children, ...rest }) => <pre {...rest} style={{ ...rest.style, background: '#f6f8fa', margin: 0 }}>{children}</pre>}
            codeTagProps={{
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              }
            }}
            showLineNumbers={false}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      )
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
}

const darkMarkdownComponents = {
  code({ className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    const hasNewline = String(children).includes('\n')

    if (match || hasNewline) {
      return (
        <div className="my-2.5 rounded-lg overflow-hidden">
          <SyntaxHighlighter
            language={match ? match[1] : 'text'}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '0.8rem 0.75rem',
              background: '#1e1e2e',
              fontSize: '11px',
              lineHeight: '1.55',
            }}
            codeTagProps={{
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              }
            }}
            showLineNumbers={false}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      )
    }

    return (
      <code className="bg-gray-700/60 px-1.5 py-0.5 rounded text-purple-300 font-mono text-[11px]" {...props}>
        {children}
      </code>
    )
  }
}

const TOOL_EMOJI: Record<string, string> = {
  // Hermes tools
  read_file: '📖', search_files: '🔍', terminal: '⚡',
  execute_code: '🐍', browser_navigate: '🌐', browser_snapshot: '👁️',
  // Claude Code tools
  Read: '📖', Write: '✏️', Edit: '✏️', Bash: '⚡',
  Glob: '🔍', Grep: '🔍', WebFetch: '🌐', WebSearch: '🔍',
  Agent: '🤖', NotebookEdit: '📓',
}
const TOOL_VERB: Record<string, string> = {
  // Hermes tools
  read_file: 'read', search_files: 'search', terminal: 'run',
  execute_code: 'exec', browser_navigate: 'goto', browser_snapshot: 'snap',
  // Claude Code tools
  Read: 'read', Write: 'write', Edit: 'edit', Bash: 'run',
  Glob: 'search', Grep: 'grep', WebFetch: 'fetch', WebSearch: 'search',
  Agent: 'agent', NotebookEdit: 'edit',
}

function toolIcon(tool: string) { return TOOL_EMOJI[tool] || '🔧' }
function toolVerb(tool: string) { return TOOL_VERB[tool] || tool }
function shortLabel(label: string) {
  // 保留最后两级路径: src/components/ProjectDetail.tsx
  const parts = label.split('/')
  return parts.length > 2 ? parts.slice(-2).join('/') : (parts.pop() || label)
}

export default function ProjectDetail({ project, onBack, langColor, onDeleted }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [activities, setActivities] = useState<{icon: string, text: string, done?: boolean}[]>([])
  const [inputValue, setInputValue] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 历史问答弹窗状态
  const [showHistory, setShowHistory] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null)

  // 物理安全删除项目状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // 选项卡状态：'info' (项目概览) | 'code' (包含文件预览与 README 默认页) | 'ai' (AI 诊断问答)
  const [activeTab, setActiveTab] = useState<'info' | 'code'>('code')
  const [readme, setReadme] = useState<string>('')
  const [loadingReadme, setLoadingReadme] = useState<boolean>(false)

  // 文件目录树相关状态
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [selectedFileContent, setSelectedFileContent] = useState<string>('')
  const [loadingFileContent, setLoadingFileContent] = useState<boolean>(false)
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({})

  // 临时防抖状态，防止在切换至详情页时，鼠标双击连击穿透触发详情页的 GitHub 链接或按钮
  const [clickAllowed, setClickAllowed] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.name}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || '物理删除失败。')
      }
      if (onDeleted) {
        onDeleted()
      }
    } catch (e: any) {
      console.error('Delete project failed:', e)
      setDeleteError(e.message || '执行物理删除或清除数据库索引时发生了未知错误')
    } finally {
      setIsDeleting(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.name}`)
      if (!res.ok) {
        throw new Error(`HTTP 错误，状态码: ${res.status}`);
      }
      const data = await res.json()
      if (data.analysis.length > 0) {
        setAnalysisHistory(data.analysis)
      }
    } catch (e) {
      console.error('Failed to load analysisHistory:', e)
    }
  }

  const fetchReadme = async () => {
    setLoadingReadme(true)
    setReadme('')
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.name}/readme`)
      if (!res.ok) {
        throw new Error(`HTTP 错误，状态码: ${res.status}`);
      }
      const data = await res.json()
      setReadme(data.content || '*此项目暂未包含 README.md 文件。*')
    } catch (e) {
      console.error('Failed to load README:', e)
      setReadme('*读取 README.md 发生错误，可能接口不存在或后端服务未运行。*')
    } finally {
      setLoadingReadme(false)
    }
  }

  const fetchFileTree = async () => {
    setLoadingFiles(true)
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.name}/files`)
      if (!res.ok) {
        throw new Error(`HTTP 错误，状态码: ${res.status}`);
      }
      const data = await res.json()
      setFileTree(data || [])
    } catch (e) {
      console.error('Failed to load file tree:', e)
    } finally {
      setLoadingFiles(false)
    }
  }

  const fetchFileContent = async (filePath: string) => {
    setLoadingFileContent(true)
    setSelectedFileContent('')
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.name}/file?path=${encodeURIComponent(filePath)}`)
      if (!res.ok) {
        throw new Error(`HTTP 错误，状态码: ${res.status}`);
      }
      const data = await res.json()
      setSelectedFileContent(data.content || '')
    } catch (e: any) {
      console.error('Failed to load file content:', e)
      setSelectedFileContent(`*读取文件内容发生错误：${e.message || '文件可能过大或非纯文本格式。'}*`)
    } finally {
      setLoadingFileContent(false)
    }
  }

  // 组件卸载时中止进行中的请求
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  useEffect(() => {
    // 切换项目时重置消息，并拉取对应的历史数据、README 内容与目录树
    setMessages([])
    setActiveTab('code')
    setSelectedFile(null)
    setSelectedFileContent('')
    setExpandedPaths({})
    fetchHistory()
    fetchReadme()
    fetchFileTree()

    // 页面加载后的 350ms 内禁用任何鼠标交互，彻底防止双击/鼠标穿透自动点击到 GitHub 按钮
    setClickAllowed(false)
    const timer = setTimeout(() => {
      setClickAllowed(true)
    }, 350)
    return () => clearTimeout(timer)
  }, [project.name])

  // 加载历史对话记录并转换为聊天消息格式
  useEffect(() => {
    if (analysisHistory.length > 0 && messages.length === 0) {
      const chatMessages: ChatMessage[] = analysisHistory.flatMap((item: any) => {
        const msgs: ChatMessage[] = []
        // 始终显示用户消息，空 question 用默认提示文本兜底
        msgs.push({
          id: `history-q-${item.id}`,
          role: 'user',
          content: item.question || '请帮我对这个项目做一个初始分析报告。',
          timestamp: item.created_at,
        })
        msgs.push({
          id: `analysisHistory-a-${item.id}`,
          role: 'assistant',
          content: item.answer,
          timestamp: item.created_at,
        })
        return msgs
      })
      setMessages(chatMessages)
    }
  }, [analysisHistory])

  // 自动滚动到最新消息（只滚 AI 聊天容器，不影响主页面）
  useEffect(() => {
    const el = chatContainerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, activities])

  // 快捷键 "?" 打开历史问答弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        setShowHistory(prev => !prev)
      }
      if (e.key === 'Escape') {
        setShowHistory(false)
        setSelectedQuestion(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const dateStr = project.lastCommitDate
    ? new Date(project.lastCommitDate).toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'Unknown'

  const remoteDateStr = project.remoteCommitDate
    ? new Date(project.remoteCommitDate).toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : null

  const openInFinder = async () => {
    try {
      await fetch(`${API_BASE}/api/open-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: project.path }),
      })
    } catch (e) {
      console.error('Failed to open Finder:', e)
    }
  }

  const openInVSCode = () => {
    window.open(`vscode://file/${project.path}`, '_blank')
  }

  const stopAnalysis = async () => {
    abortRef.current?.abort()
    try {
      await fetch(`${API_BASE}/api/analyze/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: project.name }),
      })
    } catch {}
    setAnalyzing(false)
    setActivities([])
  }

  const analyzeProject = async (question?: string) => {
    const userMsg = question || '请帮我对这个项目做一个初始分析报告。'

    // 添加用户消息到聊天
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMsg,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])

    // 添加一个占位的 assistant 消息用于流式更新
    const assistantId = `msg-${Date.now()}-a`
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isComplete: false,
    }])

    setAnalyzing(true)

    const abortController = new AbortController()
    abortRef.current = abortController
    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.name,
          path: project.path,
          question: userMsg,
        }),
        signal: abortController.signal,
      })

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.status === 'chunk' && data.content) {
                accumulated += data.content
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
                )
              } else if (data.status === 'tool') {
                const tool = data.tool || ''
                const label = data.label || ''
                const icon = toolIcon(tool)
                if (!data.done && label) {
                  setActivities(prev => [...prev, { icon, text: `${toolVerb(tool)}  ${shortLabel(label)}` }])
                }
              } else if (data.status === 'thinking') {
                setActivities(prev => [...prev, { icon: '🤔', text: data.message || 'thinking…' }])
              } else if (data.status === 'error') {
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: `分析出错: ${data.message}`, isComplete: true } : m)
                )
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (error: any) {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `请求失败: ${error.message}`, isComplete: true } : m)
      )
    } finally {
      setAnalyzing(false)
      // 标记当前 assistant 消息为已完成
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isComplete: true } : m))
      setActivities([])
      setInputValue('')
    }
  }

  const isMarkdownFile = (filename: string) => {
    return filename.toLowerCase().endsWith('.md')
  }

  const isImageFile = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext)
  }

  const getLanguageFromFilename = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const mapping: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      go: 'go',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'cpp',
      hpp: 'cpp',
      cs: 'csharp',
      html: 'markup',
      css: 'css',
      json: 'json',
      md: 'markdown',
      sh: 'bash',
      bash: 'bash',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'markup',
      sql: 'sql',
      rs: 'rust',
      toml: 'toml',
      mjs: 'javascript',
      cjs: 'javascript'
    }
    return mapping[ext] || 'text'
  }

  // 递归渲染文件树
  const renderFileNode = (node: FileNode, depth = 0) => {
    const isDir = node.type === 'directory'
    const isExpanded = !!expandedPaths[node.path]
    const isSelected = selectedFile?.path === node.path

    const toggleDir = (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpandedPaths(prev => ({
        ...prev,
        [node.path]: !prev[node.path]
      }))
    }

    const handleNodeClick = () => {
      if (isDir) {
        setExpandedPaths(prev => ({
          ...prev,
          [node.path]: !prev[node.path]
        }))
      } else {
        setSelectedFile(node)
        setActiveTab('code')
        fetchFileContent(node.path)
      }
    }

    return (
      <div key={node.path} className="select-none mt-1">
        <div
          onClick={handleNodeClick}
          className={`flex items-center gap-2 py-1 px-2 rounded-lg text-xs cursor-pointer transition-all duration-150 ${
            isSelected
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/40'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {isDir ? (
            <>
              <span onClick={toggleDir} className="shrink-0 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700/80 rounded transition">
                <ChevronRight className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
              </span>
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
              ) : (
                <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
              )}
            </>
          ) : (
            <>
              <span className="w-3.5 shrink-0" /> {/* 占位对齐 */}
              {isMarkdownFile(node.name) ? (
                <FileText className="w-3.5 h-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
              ) : (
                <File className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
              )}
            </>
          )}
          <span className="truncate flex-1 font-medium">{node.name}</span>
        </div>

        {isDir && isExpanded && node.children && (
          <div className="mt-0.5">
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-955 dark:text-gray-100 transition-colors duration-200 ${!clickAllowed ? 'pointer-events-none' : ''}`}>
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 dark:border-gray-800 dark:bg-gray-900/50 backdrop-blur sticky top-0 z-10 transition-colors duration-200">
        <div className="w-full px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="ml-auto px-3 py-1.5 bg-red-500/10 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 hover:bg-red-500/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
            <span>物理清除</span>
          </button>
        </div>
      </header>

      <main className="w-full px-6 py-6 flex flex-col xl:flex-row gap-5 items-start">
        {/* 左侧栏：本地文件树 */}
        <div className="hidden xl:flex w-60 shrink-0 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 shadow-sm transition-colors duration-200 self-stretch xl:max-h-[calc(100vh-8rem)] xl:sticky xl:top-20 flex-col">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2.5 mb-3 select-none shrink-0">
            <FolderOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">本地文件树</h3>
            {fileTree.length > 0 && (
              <span className="ml-auto px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[9px] font-bold">
                {fileTree.length} 项
              </span>
            )}
          </div>

          <div className="overflow-y-auto flex-1 pr-1 max-h-[300px] xl:max-h-none xl:min-h-0 custom-scrollbar">
            {loadingFiles ? (
              <div className="text-center py-8">
                <div className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-[10px] mt-2">读取文件树中...</p>
              </div>
            ) : fileTree.length > 0 ? (
              <div className="space-y-0.5">
                {fileTree.map(node => renderFileNode(node))}
              </div>
            ) : (
              <p className="text-center text-gray-400 dark:text-gray-500 text-[10px] py-10">未扫描到本地文件</p>
            )}
          </div>
        </div>

        {/* 中间栏：项目详情内容 */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl shadow-sm transition-colors duration-200">
            {/* 顶部菜单操作与 Tab 控制栏 */}
            <div className="p-4 pb-0 space-y-4">
            {/* 常用外部快捷入口 */}
            <div className="flex flex-wrap gap-2">
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 border border-gray-200/50 dark:border-gray-800"
                >
                  <svg className="w-3.5 h-3.5 text-gray-600 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>GitHub 仓库</span>
                </a>
              )}
              <button
                onClick={openInVSCode}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.77L3.899 12 .326 15.23a1 1 0 0 0 .001 1.51l1.32 1.201a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 9.34L9.98 18.62l2.434-7.563-2.435-7.563 8.024 6.693v1.74z"/>
                </svg>
                <span>VS Code</span>
              </button>
              <button
                onClick={openInFinder}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 border border-gray-200/50 dark:border-gray-800"
              >
                <svg className="w-3.5 h-3.5 text-gray-600 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span>Finder</span>
              </button>

              <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 self-center mx-1 hidden sm:block" />



              {/* CodeWiki 跳转按钮 */}
              <a
                href={`https://codewiki.google/github.com/${project.owner}/${project.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 border border-indigo-200/50 dark:border-indigo-900/30"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>CodeWiki</span>
              </a>
            </div>

            {/* 页签选择选项卡 */}
            <div className="flex border-t border-gray-150 dark:border-gray-800 pt-3 gap-1">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-200 flex items-center gap-1.5 -mb-4 ${
                  activeTab === 'info'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>项目概览</span>
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-200 flex items-center gap-1.5 -mb-4 ${
                  activeTab === 'code'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>
                  {selectedFile 
                    ? `预览: ${selectedFile.name}` 
                    : 'README.md'}
                </span>
              </button>

            </div>

            </div>

            {/* 主体内容渲染区 */}
            <div className="p-4 pt-3 transition-all duration-200">
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 左侧主 Bento 卡片 (占据 2 列) */}
                <div className="lg:col-span-2 space-y-5">
                  {/* 基本信息面板 */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-colors duration-200">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3.5 flex items-center gap-2 select-none">
                      <Info className="w-4 h-4 text-blue-500" />
                      <span>项目基本信息</span>
                    </h3>
                    
                    {project.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed mb-4 bg-gray-50 dark:bg-gray-955 p-3 rounded-lg border border-gray-150 dark:border-gray-800/40">
                        {project.description}
                      </p>
                    )}

                    {project.topics && project.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {project.topics.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px] font-semibold border border-blue-500/10 transition hover:bg-blue-500/10">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs border-t border-gray-100 dark:border-gray-850 pt-5">
                      <div>
                        <span className="text-gray-400 dark:text-gray-500 font-semibold block text-[10px] uppercase tracking-wider">开发语言</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${langColor}`} />
                          <span className="text-gray-950 dark:text-gray-150 font-bold">{project.language || '未知'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-gray-400 dark:text-gray-500 font-semibold block text-[10px] uppercase tracking-wider">作者 / 归属组</span>
                        <p className="text-gray-950 dark:text-gray-155 font-bold mt-1">{project.owner || '本地专属目录'}</p>
                      </div>

                      <div>
                        <span className="text-gray-400 dark:text-gray-500 font-semibold block text-[10px] uppercase tracking-wider">本地最后提交</span>
                        <p className="text-gray-950 dark:text-gray-155 font-semibold mt-1">{dateStr}</p>
                      </div>

                      <div>
                        <span className="text-gray-400 dark:text-gray-500 font-semibold block text-[10px] uppercase tracking-wider">Commit SHA</span>
                        <p className="text-gray-950 dark:text-gray-155 font-mono text-[10px] truncate select-all bg-gray-50 dark:bg-gray-955 px-2 py-0.5 rounded border border-gray-200/50 dark:border-gray-800/40 mt-1 select-all">{project.lastCommitHash || '无 Commit 信息'}</p>
                      </div>
                    </div>
                  </div>

                  {/* 物理路径与 Commit 消息面板 */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-colors duration-200">
                    <h3 className="text-xs font-semibold text-gray-450 dark:text-gray-500 block uppercase tracking-wider mb-2">本地最后提交消息</h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-xs italic bg-gray-50 dark:bg-gray-955 p-3.5 rounded-lg border border-gray-150 dark:border-gray-800/40 font-medium">
                      "{project.lastCommitMessage || '无提交日志'}"
                    </p>

                    <div className="mt-5">
                      <h3 className="text-xs font-semibold text-gray-450 dark:text-gray-500 block uppercase tracking-wider mb-2">本地项目物理绝对路径</h3>
                      <code className="block p-3 bg-gray-50 dark:bg-gray-955 text-gray-600 dark:text-gray-400 rounded-lg font-mono text-[10px] break-all select-all border border-gray-200/50 dark:border-gray-800/40 shadow-inner">
                        {project.path}
                      </code>
                    </div>
                  </div>
                </div>

                {/* 右侧 GitHub 状态与指标面板 (占据 1 列) */}
                <div className="lg:col-span-1">
                  {project.owner ? (
                    <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-colors duration-200 space-y-4">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 select-none">
                        <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span>GitHub 指标与同步</span>
                      </h3>

                      {/* Stars & Forks 卡片组 */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 rounded-xl p-2.5 text-center">
                          <div className="text-lg font-black text-amber-500 flex items-center justify-center gap-1">
                            <Star className="w-4 h-4 fill-amber-500" />
                            <span>{project.stars}</span>
                          </div>
                          <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 font-bold uppercase tracking-wider">Stars</div>
                        </div>
                        <div className="bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20 dark:border-cyan-500/30 rounded-xl p-2.5 text-center">
                          <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 flex items-center justify-center gap-1">
                            <GitFork className="w-4 h-4" />
                            <span>{project.forks}</span>
                          </div>
                          <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 font-bold uppercase tracking-wider">Forks</div>
                        </div>
                      </div>

                      {/* 同步状态 */}
                      <div className="bg-gray-50/60 dark:bg-gray-955/60 border border-gray-150 dark:border-gray-800/80 rounded-xl p-4 text-xs space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/40 pb-2">
                          <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">版本同步对比</span>
                          {project.compareStatus === 'identical' && (
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-[9px] font-bold">已同步</span>
                          )}
                          {project.compareStatus === 'ahead' && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[9px] font-bold">落后远程</span>
                          )}
                          {project.compareStatus === 'behind' && (
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[9px] font-bold">领先远程</span>
                          )}
                          {project.compareStatus === 'diverged' && (
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded text-[9px] font-bold">分支分叉</span>
                          )}
                          {(project.compareStatus === '' || project.compareStatus.startsWith('unknown')) && (
                            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[9px]">未配 Token</span>
                          )}
                        </div>

                        <div className="leading-relaxed">
                          {project.compareStatus === 'identical' && (
                            <p className="text-green-600 dark:text-green-400/90 font-medium">本地仓库分支与 GitHub 远程完全一致，保持最新同步状态。</p>
                          )}
                          {project.compareStatus === 'ahead' && (
                            <p className="text-amber-600 dark:text-amber-400/90 font-medium flex items-start gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-500 fill-amber-500/10 shrink-0 mt-0.5" />
                              <span>落后远程 {project.aheadBy} 个提交，本地可能缺失了重要的更新更改。</span>
                            </p>
                          )}
                          {project.compareStatus === 'behind' && (
                            <p className="text-blue-600 dark:text-blue-400/90 font-medium">本地领先远程 {project.behindBy} 个提交，存在尚未推送的本地修改。</p>
                          )}
                          {project.compareStatus === 'diverged' && (
                            <p className="text-rose-600 dark:text-rose-400/90 font-medium">本地与远端分支已经分叉（超前 {project.behindBy}，落后 {project.aheadBy} 个提交）。</p>
                          )}
                          {(project.compareStatus === '' || project.compareStatus.startsWith('unknown')) && (
                            <p className="text-gray-400 dark:text-gray-500 leading-normal">未检测到 GITHUB_TOKEN 环境变量。配置有效的 Token 即可自动激活此处的版本差异比对看板。</p>
                          )}
                        </div>

                        {remoteDateStr && (
                          <div className="pt-3 border-t border-gray-100 dark:border-gray-800/40 text-[9px] text-gray-400 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <span>本地最后提交：<strong className="text-gray-600 dark:text-gray-300 font-medium">{dateStr}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>远端最后推送：<strong className="text-gray-600 dark:text-gray-300 font-medium">{remoteDateStr}</strong></span>
                            </div>
                          </div>
                        )}
                      </div>

                      {project.compareStatus === 'ahead' && (
                        <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-3 text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500 fill-amber-500/10 shrink-0 mt-0.5" />
                          <span>本地版本偏旧，建议您打开终端，在项目根目录中执行 <code>git pull</code>。</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-colors duration-200 text-center py-12 flex flex-col justify-center items-center h-full">
                      <div className="w-12 h-12 bg-gray-50 dark:bg-gray-955 rounded-full flex items-center justify-center border border-gray-200/50 dark:border-gray-800/40 mb-3 text-gray-400 dark:text-gray-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-1">本地专有仓库</h4>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 max-w-[200px] leading-relaxed select-none">此项目纯属本地专属存储库，没有配置任何 GitHub 远程上游源。</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'code' && (
              selectedFile ? (
                // 1. 文件预览区
                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-colors duration-200">
                  {loadingFileContent ? (
                    <div className="text-center py-20">
                      <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-400 text-xs mt-3">读取文件内容中...</p>
                    </div>
                  ) : isImageFile(selectedFile.name) ? (
                    // 图片预览
                    <div className="text-center">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-gray-600 dark:text-gray-400 text-[10px] font-semibold tracking-wide truncate max-w-[250px] sm:max-w-[400px]">
                            {selectedFile.path}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedFile(null)
                            setSelectedFileContent('')
                          }}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[9px] transition font-sans border border-gray-200 dark:border-gray-700 active:scale-95"
                        >
                          返回 README
                        </button>
                      </div>
                      <img
                        src={`data:image/${selectedFile.name.split('.').pop()};base64,${selectedFileContent}`}
                        alt={selectedFile.name}
                        className="max-w-full max-h-[500px] mx-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                      />
                    </div>
                  ) : isMarkdownFile(selectedFile.name) ? (
                    // Markdown 渲染
                    <div className="prose prose-slate dark:prose-invert prose-sm max-w-none 
                      [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 dark:[&_h1]:text-white [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-gray-150 dark:[&_h1]:border-gray-800 [&_h1]:pb-1.5
                      [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-850 dark:[&_h2]:text-gray-100 [&_h2]:mt-4 [&_h2]:mb-2.5
                      [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-gray-800 dark:[&_h3]:text-gray-200 [&_h3]:mt-3.5 [&_h3]:mb-2
                      [&_p]:text-gray-700 dark:[&_p]:text-gray-300 [&_p]:my-2.5 [&_p]:leading-relaxed
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2.5
                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2.5
                      [&_li]:text-gray-700 dark:[&_li]:text-gray-300 [&_li]:my-1
                      [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-blue-600 dark:[&_code]:text-blue-400 [&_code]:font-mono [&_code]:text-xs
                      [&_pre]:bg-gray-950 dark:[&_pre]:bg-gray-955 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-gray-200 dark:[&_pre]:border-gray-800
                      [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-gray-250 [&_pre_code]:text-xs
                      [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:text-gray-500 dark:[&_blockquote]:text-gray-400 [&_blockquote]:my-2.5 [&_blockquote]:italic
                      [&_table]:w-full [&_table]:my-3.5 [&_table]:border-collapse
                      [&_th]:bg-gray-50 dark:[&_th]:bg-gray-850 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-gray-900 dark:[&_th]:text-white [&_th]:border [&_th]:border-gray-200 dark:[&_th]:border-gray-800 [&_th]:text-xs
                      [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-gray-850 [&_td]:text-gray-700 dark:[&_td]:text-gray-350 [&_td]:text-xs
                      [&_hr]:border-gray-150 dark:[&_hr]:border-gray-800 [&_hr]:my-4
                      [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline
                      [&_strong]:text-gray-900 dark:[&_strong]:text-white
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={lightMarkdownComponents}>
                        {selectedFileContent}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    // 其他代码渲染
                    <div className="font-mono text-xs text-slate-100 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-200">
                      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 select-none bg-slate-950 shrink-0">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-slate-400 text-[10px] font-semibold tracking-wide truncate max-w-[250px] sm:max-w-[400px]">
                            {selectedFile.path}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedFile(null)
                              setSelectedFileContent('')
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[9px] transition font-sans border border-slate-700/50 active:scale-95"
                          >
                            返回 README
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedFileContent)
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-semibold transition font-sans active:scale-95 shadow-sm"
                          >
                            复制代码
                          </button>
                        </div>
                      </div>
                      <div className="overflow-auto max-h-[550px] custom-scrollbar bg-slate-900 select-text">
                        <SyntaxHighlighter
                          language={getLanguageFromFilename(selectedFile.name)}
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1.2rem 1rem',
                            background: 'transparent',
                            fontSize: '11px',
                            lineHeight: '1.65',
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            }
                          }}
                          showLineNumbers={true}
                          lineNumberStyle={{
                            color: '#5a5a5a',
                            minWidth: '2.2em',
                            paddingRight: '1em',
                            textAlign: 'right',
                            userSelect: 'none',
                          }}
                        >
                          {selectedFileContent}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  )
                }
              </div>
              ) : (
                // 2. 默认 README 展示区
                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-colors duration-200">
                  {loadingReadme ? (
                    <div className="text-center py-20">
                      <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-400 text-xs mt-3">读取 README.md 中...</p>
                    </div>
                  ) : (
                  <div className="prose prose-slate dark:prose-invert prose-sm max-w-none 
                    [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 dark:[&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-4 [&_h1]:border-b [&_h1]:border-gray-150 dark:[&_h1]:border-gray-800 [&_h1]:pb-2
                    [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-850 dark:[&_h2]:text-gray-100 [&_h2]:mt-5 [&_h2]:mb-3
                    [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-gray-800 dark:[&_h3]:text-gray-200 [&_h3]:mt-4 [&_h3]:mb-2
                    [&_p]:text-gray-700 dark:[&_p]:text-gray-300 [&_p]:my-3 [&_p]:leading-relaxed
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3
                    [&_li]:text-gray-700 dark:[&_li]:text-gray-300 [&_li]:my-1.5
                    [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-blue-600 dark:[&_code]:text-blue-400 [&_code]:font-mono [&_code]:text-xs
                    [&_pre]:bg-gray-950 dark:[&_pre]:bg-gray-955 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-gray-200 dark:[&_pre]:border-gray-800
                    [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-gray-250 [&_pre_code]:text-xs
                    [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:text-gray-500 dark:[&_blockquote]:text-gray-400 [&_blockquote]:my-3 [&_blockquote]:italic
                    [&_table]:w-full [&_table]:my-4 [&_table]:border-collapse
                    [&_th]:bg-gray-50 dark:[&_th]:bg-gray-850 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-gray-900 dark:[&_th]:text-white [&_th]:border [&_th]:border-gray-200 dark:[&_th]:border-gray-800 [&_th]:text-xs
                    [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-gray-850 [&_td]:text-gray-700 dark:[&_td]:text-gray-350 [&_td]:text-xs
                    [&_hr]:border-gray-150 dark:[&_hr]:border-gray-800 [&_hr]:my-5
                    [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline
                    [&_strong]:text-gray-900 dark:[&_strong]:text-white
                  ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={lightMarkdownComponents}>
                      {readme}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )
          )}
          </div>
        </div>
      </div>

        {/* 右侧栏：AI 分析 */}
        <div className="hidden xl:flex w-[40%] shrink-0 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl shadow-sm transition-colors duration-200 self-stretch xl:max-h-[calc(100vh-8rem)] xl:sticky xl:top-20 flex-col overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3 shrink-0 select-none">
            <Zap className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">AI 分析</h3>
            {analysisHistory.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-[9px] font-bold">
                {analysisHistory.length}
              </span>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setAnalysisHistory([]) }}
                className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
                title="清空对话"
              >
                清空
              </button>
            )}
          </div>

          {/* 消息列表 */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="w-8 h-8 text-purple-400 dark:text-purple-500 mb-2" />
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">AI 项目诊断</h4>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 max-w-[200px] leading-relaxed mb-3">
                  点击开始，Hermes 会自行查看项目文件进行分析。
                </p>
                <button
                  onClick={() => analyzeProject()}
                  disabled={analyzing}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:text-purple-300 rounded-lg text-[11px] font-semibold text-white transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <Zap className="w-3 h-3 text-white" />
                  {analyzing ? '分析中...' : '开始深度分析'}
                </button>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] rounded-xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white text-xs leading-relaxed rounded-br-md'
                        : 'bg-gray-50 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 text-xs leading-relaxed rounded-bl-md border border-gray-100 dark:border-gray-700/50'
                    }`}>
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : msg.isComplete === false && !msg.content && (activities.length > 0 || analyzing) ? (
                        activities.length > 0 ? (
                          <div className="space-y-0.5 py-0.5 font-mono text-[11px]">
                            {activities.map((a, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                                <span className="text-gray-300 dark:text-gray-600 select-none">┊</span>
                                <span>{a.icon}</span>
                                {a.done ? (
                                  <span className="text-gray-500 dark:text-gray-400">{a.text}</span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500 animate-pulse">{a.text}</span>
                                )}
                              </div>
                            ))}
                            <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                              <span className="text-gray-300 dark:text-gray-600 select-none">┊</span>
                              <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                              <span className="animate-pulse">working…</span>
                              <button
                                onClick={stopAnalysis}
                                className="ml-2 px-2 py-0.5 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition cursor-pointer"
                              >
                                停止
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 py-1">
                            <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] text-gray-400">思考中...</span>
                          </div>
                        )
                      ) : msg.content?.startsWith('分析出错:') || msg.content?.startsWith('请求失败:') ? (
                        <div className="text-xs text-red-500 dark:text-red-400">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ) : msg.content ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none
                          [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-gray-900 dark:[&_h1]:text-white
                          [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1.5 [&_h2]:text-gray-800 dark:[&_h2]:text-gray-100
                          [&_h3]:text-[12px] [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-gray-700 dark:[&_h3]:text-gray-200
                          [&_p]:text-[12px] [&_p]:my-1.5 [&_p]:leading-relaxed [&_p]:text-gray-700 dark:[&_p]:text-gray-300
                          [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1.5 [&_ul]:text-[12px]
                          [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1.5 [&_ol]:text-[12px]
                          [&_li]:text-[12px] [&_li]:my-0.5 [&_li]:text-gray-700 dark:[&_li]:text-gray-300
                          [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:font-mono [&_code]:text-purple-600 dark:[&_code]:text-purple-300
                          [&_pre]:bg-gray-900 dark:[&_pre]:bg-gray-950 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:my-2.5 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-gray-800 dark:[&_pre]:border-gray-700
                          [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-gray-200 [&_pre_code]:text-[11px] [&_pre_code]:font-mono
                          [&_blockquote]:border-l-2 [&_blockquote]:border-purple-500 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-[12px] [&_blockquote]:text-gray-500 dark:[&_blockquote]:text-gray-400 [&_blockquote]:italic
                          [&_table]:w-full [&_table]:my-2 [&_table]:border-collapse
                          [&_th]:bg-gray-50 dark:[&_th]:bg-gray-800 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:border [&_th]:border-gray-200 dark:[&_th]:border-gray-700
                          [&_td]:px-2 [&_td]:py-1.5 [&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-gray-700 [&_td]:text-[11px]
                          [&_hr]:border-gray-200 dark:[&_hr]:border-gray-700 [&_hr]:my-3
                          [&_strong]:text-gray-900 dark:[&_strong]:text-white [&_strong]:font-semibold
                          [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2
                        ">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={darkMarkdownComponents}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                          ) : (
                            <div className="flex items-center gap-2 py-1">
                              <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                              <span className="text-[10px] text-gray-400">思考中...</span>
                            </div>
                          )}
                    </div>
                  </div>
                ))}
                  </>
                )}
          </div>

          {/* 底部输入栏 */}
          {messages.length > 0 && (
            <div className="border-t border-gray-150 dark:border-gray-800 p-3 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="继续提问..."
                  disabled={analyzing}
                  className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-50"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && inputValue.trim() && !analyzing) {
                      analyzeProject(inputValue)
                    }
                  }}
                />
                <button
                  onClick={() => inputValue.trim() && analyzeProject(inputValue)}
                  disabled={!inputValue.trim() || analyzing}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 rounded-lg text-[11px] font-semibold text-white transition active:scale-95"
                >
                  发送
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 历史问答弹窗 */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowHistory(false); setSelectedQuestion(null) }} />
          <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">历史问答记录</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">按 <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono border border-gray-200 dark:border-gray-700">?</kbd> 切换</span>
                <button onClick={() => { setShowHistory(false); setSelectedQuestion(null) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {messages.filter(m => m.role === 'user').length === 0 ? (
                <p className="text-center text-gray-400 py-8">暂无问答记录</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg, idx) => {
                    if (msg.role !== 'user') return null
                    const answer = messages[idx + 1]?.role === 'assistant' ? messages[idx + 1] : null
                    const isSelected = selectedQuestion === idx
                    return (
                      <div key={msg.id}>
                        <button
                          onClick={() => setSelectedQuestion(isSelected ? null : idx)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                              : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-blue-500 mt-0.5 shrink-0">Q</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white line-clamp-2">{msg.content}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleString('zh-CN')}</p>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                          </div>
                        </button>
                        {isSelected && answer && (
                          <div className="mt-1 ml-7 mr-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{answer.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 物理删除项目高级二次确认对话框 (Premium Confirmation Modal) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 磨砂玻璃背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />
          
          {/* 主体卡片 */}
          <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl transform scale-100 transition-all duration-300 animate-in zoom-in-95 ease-out transition-colors duration-200">
            <div className="flex items-center gap-2.5 text-red-500 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500 fill-red-500/10" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">高危操作：物理清除项目</h3>
            </div>
            
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300 mb-6">
              <p>
                您确定要删除项目 <strong className="text-gray-900 dark:text-white font-semibold">"{project.name}"</strong> 吗？此操作包含以下破坏性变动：
              </p>
              
              <ul className="list-disc list-inside space-y-1.5 pl-1 text-gray-500 dark:text-gray-400 bg-red-500/5 dark:bg-red-950/10 p-3 rounded-lg border border-red-200 dark:border-red-900/20">
                <li>
                  将<span className="text-red-600 dark:text-red-400 font-bold">永久物理删除</span>本地文件夹：
                  <code className="block mt-1 p-2 bg-gray-100 dark:bg-gray-955 rounded text-red-600 dark:text-red-300 text-xs overflow-x-auto select-all border border-gray-200 dark:border-gray-800/40">
                    {project.path}
                  </code>
                </li>
                <li>
                  清除数据库中关于此项目的<span className="text-red-600 dark:text-red-400 font-bold">所有 AI 分析历史与索引记录</span>。
                </li>
              </ul>
              
              <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                * 请确保您已备份重要代码。此操作一旦执行，不可撤销！
              </p>
            </div>

            {/* 错误提示横幅 */}
            {deleteError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-500 dark:text-red-400">
                <strong>删除失败：</strong> {deleteError}
              </div>
            )}

            {/* 动作按钮区 */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    正在删除...
                  </>
                ) : (
                  '确认安全物理删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
