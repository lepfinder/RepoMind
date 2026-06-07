import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Layers, FolderOpen, Plus, Trash2, Zap, Search, ChevronDown, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

const API_BASE = 'http://localhost:3001'

const TOOL_EMOJI: Record<string, string> = {
  read_file: '📖', search_files: '🔍', terminal: '⚡',
  execute_code: '🐍', browser_navigate: '🌐', browser_snapshot: '👁️',
}

const TOOL_VERB: Record<string, string> = {
  read_file: 'read', search_files: 'search', terminal: 'run',
  execute_code: 'exec', browser_navigate: 'goto', browser_snapshot: 'snap',
}

function toolIcon(tool: string) { return TOOL_EMOJI[tool] || '🔧' }
function toolVerb(tool: string) { return TOOL_VERB[tool] || tool }
function shortLabel(label: string) {
  const parts = label.split('/')
  return parts.length > 2 ? parts.slice(-2).join('/') : (parts.pop() || label)
}

interface Project {
  id: number
  name: string
  language: string
  local_path: string
  stars: number
}

interface Workspace {
  id: number
  name: string
  description: string
  projects: Project[]
}

interface AnalysisDetail {
  project_id: number
  project_name?: string
  answer: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isComplete?: boolean
  sessionId?: number
  analyses?: AnalysisDetail[]
}

interface Props {
  workspaceId: number
  onBack: () => void
}

export default function WorkspaceDetail({ workspaceId, onBack }: Props) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activities, setActivities] = useState<{ icon: string, text: string, done?: boolean }[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showAddProject, setShowAddProject] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedSessions, setExpandedSessions] = useState<Record<number, boolean>>({})
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadWorkspace = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workspaces`)
      const data = await res.json()
      const ws = data.find((w: Workspace) => w.id === workspaceId)
      if (ws) setWorkspace(ws)
    } catch (e) {
      console.error('Failed to load workspace:', e)
    }
  }

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/sessions`)
      const sessions = await res.json()
      if (sessions.length > 0 && messages.length === 0) {
        const chatMessages: ChatMessage[] = []
        for (const s of sessions.reverse()) {
          // 获取项目名称映射
          const analysesWithNames = s.analyses?.map((a: any) => {
            const proj = allProjects.find(p => p.id === a.project_id)
            return { ...a, project_name: proj?.name || `项目#${a.project_id}` }
          }) || []

          chatMessages.push({
            id: `session-q-${s.id}`,
            role: 'user',
            content: s.question,
            timestamp: s.created_at,
            isComplete: true,
          })
          chatMessages.push({
            id: `session-a-${s.id}`,
            role: 'assistant',
            content: s.summary || '',
            timestamp: s.created_at,
            isComplete: true,
            sessionId: s.id,
            analyses: analysesWithNames,
          })
        }
        setMessages(chatMessages)
      }
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  }

  const loadAllProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`)
      setAllProjects(await res.json())
    } catch {}
  }

  useEffect(() => {
    loadWorkspace()
    loadHistory()
    loadAllProjects()
  }, [workspaceId])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  useEffect(() => {
    const el = chatContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, activities])

  const handleAddProject = async (projectId: number) => {
    try {
      await fetch(`${API_BASE}/api/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      loadWorkspace()
    } catch {}
  }

  const handleRemoveProject = async (projectId: number) => {
    try {
      await fetch(`${API_BASE}/api/workspaces/${workspaceId}/projects/${projectId}`, { method: 'DELETE' })
      loadWorkspace()
    } catch {}
  }

  const stopAnalysis = async () => {
    abortRef.current?.abort()
    setAnalyzing(false)
    setActivities([])
  }

  const analyzeWorkspace = async (question?: string) => {
    if (!workspace) return
    const userMsg = question || '请对比分析这些项目的核心设计和实现差异'

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMsg,
      timestamp: new Date().toISOString(),
      isComplete: true,
    }
    setMessages(prev => [...prev, userMessage])

    const assistantId = `msg-${Date.now()}-a`
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString(), isComplete: false,
    }])

    setAnalyzing(true)
    setActivities([])

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg }),
        signal: ac.signal,
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
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.status === 'chunk' && data.content) {
              accumulated += data.content
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m))
            } else if (data.status === 'phase') {
              setActivities(prev => [...prev, { icon: '🔄', text: data.message }])
            } else if (data.status === 'project_done') {
              const icon = data.error ? '❌' : '✅'
              setActivities(prev => [...prev, { icon, text: `${data.project} ${data.error ? '失败' : '完成'}` }])
            } else if (data.status === 'tool') {
              const tool = data.tool || ''
              const label = data.message || ''
              if (!data.done && label && label !== tool) {
                setActivities(prev => [...prev, { icon: toolIcon(tool), text: `${toolVerb(tool)}  ${shortLabel(label)}` }])
              }
            } else if (data.status === 'error') {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `分析出错: ${data.message}` } : m))
            }
          } catch {}
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `请求失败: ${error.message}` } : m))
      }
    } finally {
      setAnalyzing(false)
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isComplete: true } : m))
      setActivities([])
    }
  }

  const filteredProjects = allProjects.filter(p =>
    workspace && !workspace.projects.find(wp => wp.id === p.id) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  )

  if (!workspace) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-200">
      <header className="border-b border-gray-200 bg-white/80 dark:border-gray-800 dark:bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="w-full px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer">
            <ArrowLeft className="w-4 h-4" /><span>返回</span>
          </button>
          <Layers className="w-5 h-5 text-purple-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{workspace.name}</h1>
          <span className="text-sm text-gray-500">{workspace.projects.length} 个项目</span>
        </div>
      </header>

      <main className="w-full px-6 py-6 flex flex-col lg:flex-row gap-5 items-start">
        {/* 左侧：项目列表 */}
        <div className="w-full lg:w-64 shrink-0 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 shadow-sm self-stretch lg:max-h-[calc(100vh-8rem)] lg:sticky lg:top-20 flex flex-col">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2.5 mb-3 select-none shrink-0">
            <FolderOpen className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">项目列表</h3>
            <button onClick={() => setShowAddProject(!showAddProject)} className="ml-auto text-gray-400 hover:text-purple-500 transition cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {showAddProject && (
            <div className="mb-3 space-y-2">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索项目..." className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {filteredProjects.map(p => (
                  <button key={p.id} onClick={() => { handleAddProject(p.id); setSearch('') }} className="w-full text-left px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition cursor-pointer">
                    + {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-y-auto flex-1 space-y-1">
            {workspace.projects.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40 group">
                <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="flex-1 truncate font-medium">{p.name}</span>
                <button onClick={() => handleRemoveProject(p.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition cursor-pointer">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：AI 对话 */}
        <div className="flex-1 min-w-0 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl shadow-sm flex flex-col overflow-hidden lg:max-h-[calc(100vh-8rem)] lg:sticky lg:top-20">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3 shrink-0 select-none">
            <Zap className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">对比分析</h3>
          </div>

          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="w-8 h-8 text-purple-400 dark:text-purple-500 mb-2" />
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">跨项目对比分析</h4>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 max-w-[200px] leading-relaxed mb-3">
                  AI 将并行分析工作空间内的所有项目，对比设计和实现差异。
                </p>
                <button onClick={() => analyzeWorkspace()} disabled={analyzing || workspace.projects.length === 0} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:text-purple-300 rounded-lg text-[11px] font-semibold text-white transition flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer">
                  <Zap className="w-3 h-3" />
                  {workspace.projects.length === 0 ? '请先添加项目' : '开始对比分析'}
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
                      ) : msg.isComplete === false && !msg.content && activities.length > 0 ? (
                        <div className="space-y-0.5 py-0.5 font-mono text-[11px]">
                          {activities.map((a, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                              <span className="text-gray-300 dark:text-gray-600 select-none">┊</span>
                              <span>{a.icon}</span>
                              <span className={a.done ? 'text-gray-500 dark:text-gray-400' : 'animate-pulse'}>{a.text}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                            <span className="text-gray-300 dark:text-gray-600 select-none">┊</span>
                            <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <span className="animate-pulse">working…</span>
                            <button onClick={stopAnalysis} className="ml-2 px-2 py-0.5 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition cursor-pointer">停止</button>
                          </div>
                        </div>
                      ) : msg.isComplete === false && !msg.content ? (
                        <div className="flex items-center gap-2 py-1">
                          <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] text-gray-400">思考中...</span>
                        </div>
                      ) : msg.content ? (
                        <div>
                          {/* 汇总内容 */}
                          <div className="prose prose-sm dark:prose-invert max-w-none
                            [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-gray-900 dark:[&_h1]:text-white
                            [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1.5 [&_h2]:text-gray-800 dark:[&_h2]:text-gray-100
                            [&_p]:text-[12px] [&_p]:my-1.5 [&_p]:leading-relaxed [&_p]:text-gray-700 dark:[&_p]:text-gray-300
                            [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1.5 [&_ul]:text-[12px]
                            [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1.5 [&_ol]:text-[12px]
                            [&_li]:text-[12px] [&_li]:my-0.5
                            [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:font-mono
                            [&_pre]:bg-gray-900 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:my-2.5 [&_pre]:overflow-x-auto
                            [&_pre_code]:bg-transparent [&_pre_code]:text-gray-200
                            [&_table]:w-full [&_table]:my-2 [&_table]:border-collapse
                            [&_th]:bg-gray-50 dark:[&_th]:bg-gray-800 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:border [&_th]:border-gray-200 dark:[&_th]:border-gray-700
                            [&_td]:px-2 [&_td]:py-1.5 [&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-gray-700 [&_td]:text-[11px]
                            [&_blockquote]:border-l-2 [&_blockquote]:border-purple-500 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-[12px] [&_blockquote]:text-gray-500 [&_blockquote]:italic
                          ">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>

                          {/* 各项目独立分析详情 */}
                          {msg.analyses && msg.analyses.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <button
                                onClick={() => setExpandedSessions(prev => ({ ...prev, [msg.sessionId!]: !prev[msg.sessionId!] }))}
                                className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer"
                              >
                                {expandedSessions[msg.sessionId!] ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                                <span>查看各项目独立分析 ({msg.analyses.length})</span>
                              </button>

                              {expandedSessions[msg.sessionId!] && (
                                <div className="mt-2 space-y-2">
                                  {msg.analyses.map((analysis, idx) => (
                                    <details key={idx} className="group">
                                      <summary className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg cursor-pointer text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition">
                                        <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                                        <span>{analysis.project_name}</span>
                                      </summary>
                                      <div className="mt-2 px-3 py-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-[11px]
                                          [&_h1]:text-xs [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1
                                          [&_h2]:text-[11px] [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1
                                          [&_p]:text-[11px] [&_p]:my-1 [&_p]:leading-relaxed
                                          [&_ul]:list-disc [&_ul]:pl-3 [&_ul]:my-1 [&_ul]:text-[11px]
                                          [&_ol]:list-decimal [&_ol]:pl-3 [&_ol]:my-1 [&_ol]:text-[11px]
                                          [&_li]:text-[11px] [&_li]:my-0.5
                                          [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px]
                                          [&_pre]:bg-gray-900 [&_pre]:p-2 [&_pre]:rounded [&_pre]:my-2 [&_pre]:text-[10px]
                                          [&_table]:text-[10px] [&_th]:px-1.5 [&_th]:py-1 [&_td]:px-1.5 [&_td]:py-1
                                        ">
                                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                            {analysis.answer}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    </details>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
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

          {messages.length > 0 && (
            <div className="border-t border-gray-150 dark:border-gray-800 p-3 shrink-0">
              <div className="flex gap-2">
                <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="输入对比问题..." disabled={analyzing}
                  className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] placeholder:text-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  onKeyDown={e => { if (e.key === 'Enter' && inputValue.trim() && !analyzing) { analyzeWorkspace(inputValue); setInputValue('') } }}
                />
                <button onClick={() => { if (inputValue.trim()) { analyzeWorkspace(inputValue); setInputValue('') } }} disabled={!inputValue.trim() || analyzing}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 rounded-lg text-[11px] font-semibold text-white transition active:scale-95 cursor-pointer">
                  发送
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
