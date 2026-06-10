import React, { useState, useEffect, useRef } from 'react'
import { Info, BookOpen, AlertTriangle } from 'lucide-react'
import type { Project, ChatMessage, FileNode } from '../../types'
import { toolIcon, toolVerb, shortLabel } from '../../constants/toolEmoji'
import ProjectHeader from './ProjectHeader'
import FileTreePanel from './FileTreePanel'
import ProjectOverview from './ProjectOverview'
import FilePreviewPanel from './FilePreviewPanel'
import AiChatPanel from './AiChatPanel'
import HistorySidebar from './HistorySidebar'

interface Props {
  project: Project
  onBack: () => void
  langColor: string
  onDeleted?: () => void
  onSync?: () => void
}

const API_BASE = 'http://localhost:3001'

export default function ProjectDetail({
  project: projectProp,
  onBack,
  langColor,
  onDeleted,
  onSync,
}: Props) {
  const [project, setProject] = useState(projectProp)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [activities, setActivities] = useState<{ icon: string; text: string; done?: boolean }[]>([])
  const [inputValue, setInputValue] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 历史问答侧边栏状态
  const [showHistory, setShowHistory] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  // 同步代码状态
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 物理安全删除项目状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // 选项卡状态：'info' (项目概览) | 'code' (包含文件预览与 README 默认页)
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
        throw new Error(`HTTP 错误，状态码: ${res.status}`)
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
        throw new Error(`HTTP 错误，状态码: ${res.status}`)
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
        throw new Error(`HTTP 错误，状态码: ${res.status}`)
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
        throw new Error(`HTTP 错误，状态码: ${res.status}`)
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
    return () => {
      abortRef.current?.abort()
    }
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
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const scrollToMessage = (msgId: string) => {
    setShowHistory(false)
    setTimeout(() => {
      const el = document.getElementById(msgId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightedId(msgId)
        setTimeout(() => setHighlightedId(null), 2000)
      }
    }, 50)
  }

  const dateStr = project.lastCommitDate
    ? new Date(project.lastCommitDate).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown'

  const remoteDateStr = project.remoteCommitDate
    ? new Date(project.remoteCommitDate).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isComplete: false,
      },
    ])

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
                  prev.map(m => (m.id === assistantId ? { ...m, content: accumulated } : m))
                )
              } else if (data.status === 'tool') {
                const tool = data.tool || ''
                const label = data.label || ''
                const icon = toolIcon(tool)
                if (!data.done && label) {
                  setActivities(prev => {
                    const next = [...prev, { icon, text: `${toolVerb(tool)}  ${shortLabel(label)}` }]
                    // thinking 心跳只保留最新的，清除之前的
                    if (tool === 'thinking') {
                      return next.filter((a, i) => i === next.length - 1 || a.icon !== '🤔')
                    }
                    return next
                  })
                }
              } else if (data.status === 'thinking') {
                setActivities(prev => [...prev, { icon: '🤔', text: data.message || 'thinking…' }])
              } else if (data.status === 'error') {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId ? { ...m, content: `分析出错: ${data.message}`, isComplete: true } : m
                  )
                )
              }
            } catch {
              /* skip */
            }
          }
        }
      }
    } catch (error: any) {
      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, content: `请求失败: ${error.message}`, isComplete: true } : m))
      )
    } finally {
      setAnalyzing(false)
      // 标记当前 assistant 消息为已完成
      setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, isComplete: true } : m)))
      setActivities([])
      setInputValue('')
    }
  }

  const handleSyncCode = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/git-pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: project.path, name: project.name }),
      })
      const data = await res.json()
      if (data.success) {
        setSyncMessage({ type: 'success', text: '同步成功' })
        setProject(prev => ({ ...prev, compareStatus: 'identical', aheadBy: 0, behindBy: 0 }))
        onSync?.()
      } else {
        setSyncMessage({ type: 'error', text: data.error || '同步失败' })
      }
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: '请求失败' })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMessage(null), 5000)
    }
  }

  return (
    <div
      className={`min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-955 dark:text-gray-100 transition-colors duration-200 ${
        !clickAllowed ? 'pointer-events-none' : ''
      }`}
    >
      <ProjectHeader
        project={project}
        onBack={onBack}
        syncing={syncing}
        syncMessage={syncMessage}
        onSync={handleSyncCode}
        onDeleteClick={() => setShowDeleteConfirm(true)}
      />

      <main className="w-full px-6 py-6 flex flex-col xl:flex-row gap-5 items-start">
        <FileTreePanel
          fileTree={fileTree}
          loadingFiles={loadingFiles}
          selectedFile={selectedFile}
          expandedPaths={expandedPaths}
          setExpandedPaths={setExpandedPaths}
          onNodeSelect={node => {
            setSelectedFile(node)
            setActiveTab('code')
            fetchFileContent(node.path)
          }}
        />

        {/* 中间栏：项目详情内容 */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl shadow-sm transition-colors duration-200">
            {/* 顶部菜单操作与 Tab 控制栏 */}
            <div className="p-4 pb-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                {project.githubUrl && (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 border border-gray-200/50 dark:border-gray-800"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-600 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    <span>GitHub 仓库</span>
                  </a>
                )}
                <button
                  onClick={openInVSCode}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.77L3.899 12 .326 15.23a1 1 0 0 0 .001 1.51l1.32 1.201a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 9.34L9.98 18.62l2.434-7.563-2.435-7.563 8.024 6.693v1.74z" />
                  </svg>
                  <span>VS Code</span>
                </button>
                <button
                  onClick={openInFinder}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 border border-gray-200/50 dark:border-gray-800 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-gray-600 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Finder</span>
                </button>

                <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 self-center mx-1 hidden sm:block" />

                <a
                  href={`https://codewiki.google/github.com/${project.owner}/${project.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-955/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 border border-indigo-200/50 dark:border-indigo-900/30"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>CodeWiki</span>
                </a>
              </div>

              {/* 页签选择选项卡 */}
              <div className="flex border-t border-gray-150 dark:border-gray-800 pt-3 gap-1">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-200 flex items-center gap-1.5 -mb-4 cursor-pointer ${
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
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-200 flex items-center gap-1.5 -mb-4 cursor-pointer ${
                    activeTab === 'code'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{selectedFile ? `预览: ${selectedFile.name}` : 'README.md'}</span>
                </button>
              </div>
            </div>

            {/* 主体内容渲染区 */}
            <div className="p-4 pt-3 transition-all duration-200">
              {activeTab === 'info' && (
                <ProjectOverview
                  project={project}
                  langColor={langColor}
                  dateStr={dateStr}
                  remoteDateStr={remoteDateStr}
                />
              )}

              {activeTab === 'code' && (
                <FilePreviewPanel
                  project={project}
                  selectedFile={selectedFile}
                  readme={readme}
                  loadingReadme={loadingReadme}
                  selectedFileContent={selectedFileContent}
                  loadingFileContent={loadingFileContent}
                  apiBase={API_BASE}
                />
              )}
            </div>
          </div>
        </div>

        <AiChatPanel
          messages={messages}
          inputValue={inputValue}
          setInputValue={setInputValue}
          analyzing={analyzing}
          activities={activities}
          onSend={analyzeProject}
          onStop={stopAnalysis}
          onClear={() => {
            setMessages([])
            setAnalysisHistory([])
          }}
          chatContainerRef={chatContainerRef}
          highlightedId={highlightedId}
        />
      </main>

      <HistorySidebar
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        messages={messages}
        scrollToMessage={scrollToMessage}
      />

      {/* 物理删除项目高级二次确认对话框 (Premium Confirmation Modal) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 cursor-pointer"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />

          <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl transform scale-100 transition-all duration-300 animate-in zoom-in-95 ease-out transition-colors duration-200">
            <div className="flex items-center gap-2.5 text-red-500 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500 fill-red-500/10" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">高危操作：物理清除项目</h3>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-3 mb-5 leading-relaxed">
              <p>
                您确定要删除项目{' '}
                <strong className="text-gray-900 dark:text-white font-semibold">"{project.name}"</strong> 吗？此操作包含以下破坏性变动：
              </p>

              <ul className="list-disc list-inside space-y-1.5 pl-1 text-gray-500 dark:text-gray-400 bg-red-500/5 dark:bg-red-955/10 p-3 rounded-lg border border-red-200 dark:border-red-900/20">
                <li>
                  将<span className="text-red-600 dark:text-red-400 font-bold">永久物理删除</span>本地文件夹：
                  <code className="block mt-1 p-2 bg-gray-105 dark:bg-gray-955 rounded text-red-600 dark:text-red-300 text-xs overflow-x-auto select-all border border-gray-200 dark:border-gray-800/40">
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

            {deleteError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-500 dark:text-red-400">
                <strong>删除失败：</strong> {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-sm font-medium transition disabled:opacity-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
