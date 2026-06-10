import React from 'react'
import { Zap } from 'lucide-react'
import type { ChatMessage } from '../../types'
import AiChatMessage from '../shared/AiChatMessage'

interface Props {
  messages: ChatMessage[]
  inputValue: string
  setInputValue: (val: string) => void
  analyzing: boolean
  activities: { icon: string; text: string; done?: boolean }[]
  onSend: (question?: string) => void
  onStop: () => void
  onClear: () => void
  chatContainerRef: React.RefObject<HTMLDivElement | null>
  highlightedId: string | null
}

export default function AiChatPanel({
  messages,
  inputValue,
  setInputValue,
  analyzing,
  activities,
  onSend,
  onStop,
  onClear,
  chatContainerRef,
  highlightedId,
}: Props) {
  return (
    <div className="hidden xl:flex w-[40%] shrink-0 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl shadow-sm transition-colors duration-200 self-stretch xl:max-h-[calc(100vh-8rem)] xl:sticky xl:top-20 flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3 shrink-0 select-none">
        <Zap className="w-4 h-4 text-purple-500" />
        <h3 className="text-xs font-bold text-gray-900 dark:text-white">AI 分析</h3>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
            title="清空对话"
          >
            清空
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div ref={chatContainerRef as any} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="w-8 h-8 text-purple-400 dark:text-purple-500 mb-2" />
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">AI 项目诊断</h4>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 max-w-[200px] leading-relaxed mb-3">
              点击开始，Hermes 会自行查看项目文件进行分析。
            </p>
            <button
              onClick={() => onSend()}
              disabled={analyzing}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:text-purple-300 rounded-lg text-[11px] font-semibold text-white transition flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer"
            >
              <Zap className="w-3 h-3 text-white" />
              {analyzing ? '分析中...' : '开始深度分析'}
            </button>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <AiChatMessage
                key={msg.id}
                msg={msg}
                highlightedId={highlightedId}
                analyzing={analyzing}
                activities={activities}
                stopAnalysis={onStop}
              />
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
                  onSend(inputValue)
                  setInputValue('')
                }
              }}
            />
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  onSend(inputValue)
                  setInputValue('')
                }
              }}
              disabled={!inputValue.trim() || analyzing}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 rounded-lg text-[11px] font-semibold text-white transition active:scale-95 cursor-pointer"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
