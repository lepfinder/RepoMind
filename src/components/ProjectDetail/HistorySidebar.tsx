import React from 'react'
import { ChevronRight } from 'lucide-react'
import type { ChatMessage } from '../../types'

interface Props {
  showHistory: boolean
  setShowHistory: (show: boolean) => void
  messages: ChatMessage[]
  scrollToMessage: (msgId: string) => void
}

export default function HistorySidebar({
  showHistory,
  setShowHistory,
  messages,
  scrollToMessage,
}: Props) {
  if (!showHistory) return null

  const userMessages = messages.filter(m => m.role === 'user')

  return (
    <div className="fixed right-0 top-0 bottom-0 z-50 w-80 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">历史问答</h3>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono text-gray-400 border border-gray-200 dark:border-gray-700">?</kbd>
          <button
            onClick={() => setShowHistory(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {userMessages.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">暂无问答记录</p>
        ) : (
          userMessages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => scrollToMessage(msg.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition cursor-pointer group"
            >
              <div className="flex items-start gap-2">
                <span className="text-blue-500 text-xs font-bold mt-0.5 shrink-0">Q</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900 dark:text-white line-clamp-2 leading-relaxed">{msg.content}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleString('zh-CN')}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 shrink-0 mt-0.5 transition" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
