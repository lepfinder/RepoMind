import React from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Project } from '../../types'

interface Props {
  project: Project
  onBack: () => void
  syncing: boolean
  syncMessage: { type: 'success' | 'error'; text: string } | null
  onSync: () => void
  onDeleteClick: () => void
}

export default function ProjectHeader({
  project,
  onBack,
  syncing,
  syncMessage,
  onSync,
  onDeleteClick,
}: Props) {
  return (
    <header className="border-b border-gray-200 bg-white/80 dark:border-gray-800 dark:bg-gray-900/50 backdrop-blur sticky top-0 z-10 transition-colors duration-200">
      <div className="w-full px-6 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h1>

        {/* 同步状态标签 */}
        {project.compareStatus && project.compareStatus !== 'unknown' && !project.compareStatus.startsWith('unknown') && (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
            project.compareStatus === 'identical'
              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
              : project.compareStatus === 'ahead'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              : project.compareStatus === 'behind'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              project.compareStatus === 'identical' ? 'bg-green-500' :
              project.compareStatus === 'ahead' ? 'bg-amber-500' :
              project.compareStatus === 'behind' ? 'bg-blue-500' : 'bg-rose-500'
            }`} />
            {project.compareStatus === 'identical' && '已同步'}
            {project.compareStatus === 'ahead' && `落后 ${project.aheadBy} 个版本`}
            {project.compareStatus === 'behind' && `领先 ${project.behindBy} 个提交`}
            {project.compareStatus === 'diverged' && '分支分叉'}
          </span>
        )}

        {/* 同步代码按钮 */}
        {project.compareStatus === 'ahead' && (
          <button
            disabled={syncing}
            onClick={onSync}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-1.5 active:scale-95 disabled:cursor-not-allowed cursor-pointer"
          >
            {syncing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>{syncing ? '同步中...' : '同步代码'}</span>
          </button>
        )}

        {/* 同步结果提示 */}
        {syncMessage && (
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            syncMessage.type === 'success'
              ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
              : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
          }`}>
            {syncMessage.type === 'success' ? '✓' : '✗'} {syncMessage.text}
          </span>
        )}

        <button
          onClick={onDeleteClick}
          className="ml-auto px-3 py-1.5 bg-red-500/10 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 hover:bg-red-500/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
          <span>物理清除</span>
        </button>
      </div>
    </header>
  )
}
