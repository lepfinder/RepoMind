import { useState, useEffect } from 'react'
import { Layers, Plus, Trash2, FolderOpen, ArrowLeft, ChevronRight } from 'lucide-react'

const API_BASE = 'http://localhost:3001'

import type { Workspace, WorkspaceProject } from '../types'

interface Props {
  onBack: () => void
  onOpenWorkspace: (id: number) => void
}

export default function WorkspaceList({ onBack, onOpenWorkspace }: Props) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [allProjects, setAllProjects] = useState<WorkspaceProject[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const loadWorkspaces = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workspaces`)
      const data = await res.json()
      setWorkspaces(data)
    } catch (e) {
      console.error('Failed to load workspaces:', e)
    }
  }

  const loadProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`)
      const data = await res.json()
      setAllProjects(data)
    } catch (e) {
      console.error('Failed to load projects:', e)
    }
  }

  useEffect(() => {
    loadWorkspaces()
    loadProjects()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc, projectIds: selectedIds }),
      })
      if (res.ok) {
        setShowCreate(false)
        setNewName('')
        setNewDesc('')
        setSelectedIds([])
        loadWorkspaces()
      }
    } catch (e) {
      console.error('Failed to create workspace:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除这个项目组？')) return
    try {
      await fetch(`${API_BASE}/api/workspaces/${id}`, { method: 'DELETE' })
      loadWorkspaces()
    } catch (e) {
      console.error('Failed to delete workspace:', e)
    }
  }

  const filteredProjects = allProjects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (d: string) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-200">
      <header className="border-b border-gray-200 bg-white/80 dark:border-gray-800 dark:bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
          <Layers className="w-5 h-5 text-purple-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">项目组</h1>
          <span className="text-sm text-gray-500">{workspaces.length} 个项目组</span>
          <button onClick={() => setShowCreate(true)} className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            创建项目组
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {workspaces.length === 0 ? (
          <div className="text-center py-20">
            <Layers className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-lg mb-2">还没有项目组</p>
            <p className="text-gray-400 text-sm mb-4">创建项目组，将多个同类项目组合进行对比分析</p>
            <button onClick={() => setShowCreate(true)} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold transition active:scale-95 shadow-sm cursor-pointer">
              创建第一个项目组
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map(ws => (
              <div key={ws.id} onClick={() => onOpenWorkspace(ws.id)} className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{ws.name}</h3>
                  </div>
                  <button onClick={(e) => handleDelete(ws.id, e)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {ws.description && <p className="text-xs text-gray-500 mb-3">{ws.description}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ws.projects.map(p => (
                    <span key={p.id} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-[10px] font-medium">
                      {p.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <FolderOpen className="w-3 h-3" />
                    {ws.projects.length} 个项目
                  </span>
                  <span>{formatDate(ws.updated_at)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 创建项目组弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                创建项目组
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">名称</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="例如：AI Agent 框架对比" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">描述（可选）</label>
                <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="简要描述这个项目组的用途" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">选择项目（可多选，后续可增删）</label>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索项目..." className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2" />
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredProjects.map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                      <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={e => {
                        setSelectedIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))
                      }} className="rounded accent-purple-600" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">{p.name}</span>
                      <span className="text-[10px] text-gray-400">{p.language}</span>
                    </label>
                  ))}
                </div>
                {selectedIds.length > 0 && (
                  <p className="text-[10px] text-purple-500 mt-1">已选择 {selectedIds.length} 个项目</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer">取消</button>
              <button onClick={handleCreate} disabled={!newName.trim() || loading} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer">
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
