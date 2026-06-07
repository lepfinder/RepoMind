import { useState, useEffect, useMemo } from 'react'
import { Sun, Moon, FolderPlus, Loader2, Check, AlertCircle, RefreshCw, Layers, Settings, ChevronRight } from 'lucide-react'
import type { Project } from './types'
import ProjectCard from './components/ProjectCard'
import ProjectDetail from './components/ProjectDetail'
import WorkspaceList from './components/WorkspaceList'
import WorkspaceDetail from './components/WorkspaceDetail'
import SettingsModal from './components/SettingsModal'

const API_BASE = 'http://localhost:3001'

const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-500',
  Python: 'bg-green-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-600',
  Java: 'bg-red-500',
  'C/C++': 'bg-purple-500',
  Vue: 'bg-emerald-500',
  HTML: 'bg-orange-500',
  CSS: 'bg-pink-500',
  Shell: 'bg-gray-500',
  Makefile: 'bg-gray-600',
  Other: 'bg-gray-400',
}

function getLangColor(lang: string): string {
  return LANG_COLORS[lang] || 'bg-gray-400'
}

function parseProject(p: any): Project {
  return {
    name: p.name,
    owner: p.owner,
    repo: p.repo,
    description: p.description,
    remoteUrl: p.remote_url || '',
    githubUrl: p.github_url || '',
    language: p.language || 'Other',
    topics: typeof p.topics === 'string' ? JSON.parse(p.topics) : (p.topics || []),
    lastCommitHash: p.last_commit_hash || '',
    lastCommitMessage: p.last_commit_message || '',
    lastCommitDate: p.last_commit_date || '',
    path: p.local_path || '',
    scannedAt: p.scanned_at || '',
    createdAt: p.created_at || '',
    stars: p.stars || 0,
    forks: p.forks || 0,
    remoteCommitHash: p.remote_commit_hash || '',
    remoteCommitDate: p.remote_commit_date || '',
    compareStatus: p.compare_status || '',
    aheadBy: p.ahead_by || 0,
    behindBy: p.behind_by || 0,
  }
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [filterLang, setFilterLang] = useState('')
  const [sortBy, setSortBy] = useState<'commit' | 'created'>('created')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [view, setView] = useState<'home' | 'workspaces' | 'workspace-detail'>('home')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')

  // 工作空间状态
  const [workspaces, setWorkspaces] = useState<{ id: number; name: string; description: string; projects: any[]; created_at: string }[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)

  // 导入 GitHub 状态管理
  const [showSettings, setShowSettings] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importStatus, setImportStatus] = useState<'analyzing' | 'cloning' | 'scanning' | 'syncing' | 'done' | 'error' | ''>('')
  const [importMessage, setImportMessage] = useState('')

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importUrl.trim()) return

    setImportLoading(true)
    setImportStatus('analyzing')
    setImportMessage('正在解析 GitHub 链接与地址...')

    try {
      const response = await fetch(`${API_BASE}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: importUrl }),
      })

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('未成功建立服务端进度流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

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
              if (data.status === 'error') {
                setImportStatus('error')
                setImportMessage(data.message || '导入遇到阻碍')
                setImportLoading(false)
                return
              } else {
                setImportStatus(data.status)
                setImportMessage(data.message || '')
                if (data.status === 'done') {
                  setImportLoading(false)
                  // 1.5 秒延迟自动刷新首页列表并关闭，提供令人愉悦的动画过渡
                  setTimeout(() => {
                    loadProjects()
                    setShowImportModal(false)
                    setImportUrl('')
                    setImportStatus('')
                    setImportMessage('')
                  }, 1500)
                }
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: any) {
      setImportStatus('error')
      setImportMessage(`连接超时或网络异常: ${err.message}`)
      setImportLoading(false)
    }
  }

  // 浅色/深色主题控制状态与 localStorage 自动记忆机制
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  const loadProjects = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/projects`)
      const data = await res.json()
      setProjects(data.map(parseProject))
      setLoaded(true)
    } catch (e) {
      console.error('Failed to load projects:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadWorkspaces = async () => {
    setLoadingWorkspaces(true)
    try {
      const res = await fetch(`${API_BASE}/api/workspaces`)
      const data = await res.json()
      setWorkspaces(data)
    } catch (e) {
      console.error('Failed to load workspaces:', e)
    } finally {
      setLoadingWorkspaces(false)
    }
  }

  const triggerScan = async () => {
    setScanning(true)
    setScanProgress('正在唤醒扫描引擎...')
    try {
      const response = await fetch(`${API_BASE}/api/scan`, { method: 'POST' })
      const reader = response.body?.getReader()
      if (!reader) throw new Error('未成功建立扫描进度流')

      const decoder = new TextDecoder()
      let buffer = ''

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
              setScanProgress(data.message || '')
              if (data.status === 'done' || data.status === 'error') {
                setScanning(false)
                setTimeout(() => {
                  setScanProgress('')
                  loadProjects()
                }, 1200)
                return
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: any) {
      setScanProgress(`扫描异常: ${err.message}`)
      setScanning(false)
      setTimeout(() => {
        setScanProgress('')
        loadProjects()
      }, 2000)
    }
  }

  // Auto-load on mount
  useEffect(() => {
    loadProjects()
    loadWorkspaces()
  }, [])

  // URL 参数自动跳转: ?project=xxx
  useEffect(() => {
    if (!loaded || projects.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const projectName = params.get('project')
    if (projectName) {
      const target = projects.find(p => p.name === projectName)
      if (target) {
        setSelectedProject(target)
        // 清除 URL 参数避免刷新后重复跳转
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [loaded, projects])

  const languages = useMemo(() => {
    const set = new Set(projects.map(p => p.language))
    return Array.from(set).sort()
  }, [projects])

  const filtered = useMemo(() => {
    const filtered = projects.filter(p => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.owner.toLowerCase().includes(search.toLowerCase())
      const matchLang = !filterLang || p.language === filterLang
      return matchSearch && matchLang
    })
    // 排序
    return [...filtered].sort((a, b) => {
      if (sortBy === 'created') {
        return (b.createdAt || '').localeCompare(a.createdAt || '')
      }
      return (b.lastCommitDate || '').localeCompare(a.lastCommitDate || '')
    })
  }, [projects, search, filterLang, sortBy])

  if (view === 'workspaces') {
    return (
      <WorkspaceList
        onBack={() => setView('home')}
        onOpenWorkspace={(id) => { setSelectedWorkspaceId(id); setView('workspace-detail') }}
      />
    )
  }

  if (view === 'workspace-detail' && selectedWorkspaceId) {
    return (
      <WorkspaceDetail
        workspaceId={selectedWorkspaceId}
        onBack={() => { setView('home'); setSelectedWorkspaceId(null) }}
      />
    )
  }

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        langColor={getLangColor(selectedProject.language)}
        onDeleted={() => {
          setSelectedProject(null)
          loadProjects()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-200">
      <header className="border-b border-gray-200 bg-white/80 dark:border-gray-800 dark:bg-gray-900/50 backdrop-blur sticky top-0 z-10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GitHub Index</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loaded ? `${projects.length} projects` : 'Local project index'}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setView('workspaces')}
                className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center shadow-sm active:scale-95 border border-gray-200/50 dark:border-gray-700/50 cursor-pointer"
                title="项目组 - 跨项目对比分析"
              >
                <Layers className="w-4 h-4 mr-1.5" />
                项目组
              </button>
              <a
                href="https://github.com/trending"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center shadow-sm active:scale-95 border border-gray-200/50 dark:border-gray-700/50 cursor-pointer"
                title="GitHub Trending 趋势榜"
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.75 8a.75.75 0 0 1 .75-.75h5.69L5.22 5.28a.75.75 0 1 1 1.06-1.06l3.25 3.25a.75.75 0 0 1 0 1.06L6.28 11.78a.75.75 0 0 1-1.06-1.06l1.97-1.97H1.5A.75.75 0 0 1 .75 8Z" />
                  <path d="M15.25 8a.75.75 0 0 1-.75.75H8.81l1.97 1.97a.75.75 0 1 1-1.06 1.06L6.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 1 1 1.06 1.06L8.81 7.25h5.69a.75.75 0 0 1 .75.75Z" />
                </svg>
                Trending
              </a>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-2 bg-blue-50/80 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center shadow-sm active:scale-95 border border-blue-100/50 dark:border-blue-900/30 cursor-pointer"
                title="导入 GitHub 仓库项目并创建本地索引"
              >
                <FolderPlus className="w-4 h-4 mr-1.5" />
                导入项目
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition-all duration-200 hover:scale-105 flex items-center justify-center cursor-pointer"
                title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition-all duration-200 hover:scale-105 flex items-center justify-center cursor-pointer"
                title="设置"
              >
                <Settings className="w-4 h-4" />
              </button>
              <div className="relative">
                {scanning && (
                  <div className="absolute bottom-full right-0 mb-1.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap select-none">
                    {scanProgress}
                  </div>
                )}
                <button
                  onClick={triggerScan}
                  disabled={scanning}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95 shadow-sm flex items-center justify-center gap-1.5 ${
                    scanning
                      ? 'bg-blue-600/50 text-white/70 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                  }`}
                >
                  {scanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      扫描中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'Loading...' : loaded ? 'Refresh' : 'Load Index'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-colors duration-200"
            />
            <select
              value={filterLang}
              onChange={e => setFilterLang(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-colors duration-200"
            >
              <option value="">All Languages</option>
              {languages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'commit' | 'created')}
              className="px-4 py-2 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-colors duration-200"
            >
              <option value="commit">按提交时间</option>
              <option value="created">按入库时间</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* 工作空间区域 */}
        {workspaces.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">项目组</h2>
              </div>
              <button
                onClick={() => setView('workspaces')}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
              >
                查看全部
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {workspaces.slice(0, 4).map(ws => (
                <div
                  key={ws.id}
                  onClick={() => { setSelectedWorkspaceId(ws.id); setView('workspace-detail') }}
                  className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-950/50 transition-colors">
                      <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{ws.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{ws.projects.length} 个项目</p>
                    </div>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{ws.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>创建于 {new Date(ws.created_at).toLocaleDateString('zh-CN')}</span>
                    <ChevronRight className="w-4 h-4 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 项目列表区域 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">项目列表</h2>
              {loaded && <span className="text-sm text-gray-500 dark:text-gray-400">({filtered.length})</span>}
            </div>
          </div>

          {!loaded && !loading && (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">Run `npm run scan` to generate the index</p>
            </div>
          )}

        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 mt-4">Loading projects...</p>
          </div>
        )}

        {loaded && filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No projects found</p>
          </div>
        )}

        {loaded && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(project => (
              <ProjectCard
                key={project.name}
                project={project}
                langColor={getLangColor(project.language)}
                onClick={() => setSelectedProject(project)}
              />
            ))}
          </div>
        )}
        </div>
      </main>
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl max-w-md w-full shadow-2xl p-6 relative overflow-hidden transition-all duration-300">
            
            {/* 头部标题与取消按钮 */}
            <div className="flex items-center justify-between mb-4 select-none">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-500" />
                导入 GitHub 仓库
              </h3>
              {!importLoading && (
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportUrl('')
                    setImportStatus('')
                    setImportMessage('')
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* 状态展现与进度面板 */}
            {importStatus ? (
              <div className="text-center py-6">
                {importStatus === 'error' ? (
                  <div className="animate-fade-in">
                    <AlertCircle className="w-12 h-12 text-rose-500 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-full mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-2">导入遇到问题</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-h-32 overflow-y-auto px-2 leading-relaxed">
                      {importMessage}
                    </p>
                    <button
                      onClick={() => {
                        setImportStatus('')
                        setImportMessage('')
                      }}
                      className="mt-4 px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      重新尝试
                    </button>
                  </div>
                ) : importStatus === 'done' ? (
                  <div className="animate-fade-in">
                    <Check className="w-12 h-12 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-full mx-auto mb-3 animate-bounce" />
                    <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">同步就绪</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {importMessage}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                    
                    {/* 物理步骤展示条 */}
                    <div className="flex justify-center items-center gap-1 text-[10px] text-gray-400 dark:text-gray-600 mb-2 select-none">
                      <span className={`px-2 py-0.5 rounded-full border ${importStatus === 'analyzing' ? 'text-blue-500 border-blue-500 font-bold bg-blue-50/20' : 'border-gray-200 dark:border-gray-800'}`}>解析</span>
                      <span>&rarr;</span>
                      <span className={`px-2 py-0.5 rounded-full border ${importStatus === 'cloning' ? 'text-blue-500 border-blue-500 font-bold bg-blue-50/20' : 'border-gray-200 dark:border-gray-800'}`}>克隆</span>
                      <span>&rarr;</span>
                      <span className={`px-2 py-0.5 rounded-full border ${importStatus === 'scanning' ? 'text-blue-500 border-blue-500 font-bold bg-blue-50/20' : 'border-gray-200 dark:border-gray-800'}`}>扫描</span>
                      <span>&rarr;</span>
                      <span className={`px-2 py-0.5 rounded-full border ${importStatus === 'syncing' ? 'text-blue-500 border-blue-500 font-bold bg-blue-50/20' : 'border-gray-200 dark:border-gray-800'}`}>同步</span>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 px-4 select-none animate-pulse leading-relaxed">
                      {importMessage}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleImport}>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                  输入 GitHub 链接或 <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[10px] font-mono">owner/repo</code>。仓库将自动克隆至 <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[10px] font-mono text-blue-500">~/workspace/github</code>，并在本地库建立全套元指标索引。
                </p>
                <input
                  type="text"
                  required
                  placeholder="例如 https://github.com/owner/repo"
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 mb-4"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false)
                      setImportUrl('')
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition shadow-md active:scale-95 cursor-pointer"
                  >
                    确定导入
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
