import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { ghcolors, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import type { ChatMessage } from '../../types'
import { toolIcon, toolVerb, shortLabel } from '../../constants/toolEmoji'
import { PROSE_CLS } from '../../styles/proseCls'

interface Props {
  msg: ChatMessage
  highlightedId: string | null
  analyzing?: boolean
  activities?: { icon: string; text: string; done?: boolean }[]
  stopAnalysis?: () => void
  expandedSessions?: Record<number, boolean>
  setExpandedSessions?: React.Dispatch<React.SetStateAction<Record<number, boolean>>>
}

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
            PreTag={({ children, ...rest }: any) => <pre {...rest} style={{ ...rest.style, background: '#f6f8fa', margin: 0 }}>{children}</pre>}
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
      <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-900 dark:text-gray-100 font-mono text-[11px]" {...props}>
        {children}
      </code>
    )
  }
}

export default function AiChatMessage({
  msg,
  highlightedId,
  analyzing = false,
  activities = [],
  stopAnalysis,
  expandedSessions = {},
  setExpandedSessions,
}: Props) {
  const isUser = msg.role === 'user'

  return (
    <div
      id={msg.id}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} transition-all duration-500 ${
        highlightedId === msg.id ? 'ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-2 rounded-xl' : ''
      }`}
    >
      <div
        className={`max-w-[90%] rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white text-xs leading-relaxed rounded-br-md'
            : 'bg-gray-50 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 text-xs leading-relaxed rounded-bl-md border border-gray-100 dark:border-gray-700/50'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : msg.isComplete === false && (activities.length > 0 || analyzing) ? (
          <>
            {activities.length > 0 ? (
              <div className="space-y-0.5 py-0.5 font-mono text-[11px] mb-2">
                {activities.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                    <span className="text-gray-300 dark:text-gray-600 select-none">┊</span>
                    <span>{a.icon}</span>
                    <span className={a.done ? 'text-gray-500 dark:text-gray-400' : 'animate-pulse'}>
                      {a.text}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <span className="text-gray-300 dark:text-gray-600 select-none">┊</span>
                  <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span className="animate-pulse">working…</span>
                  {stopAnalysis && (
                    <button
                      onClick={stopAnalysis}
                      className="ml-2 px-2 py-0.5 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition cursor-pointer"
                    >
                      停止
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-1">
                <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-gray-400">思考中...</span>
              </div>
            )}
            {msg.content && (
              <div>
                <div className={PROSE_CLS}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={darkMarkdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
                {renderAnalysesDropdown(msg, expandedSessions, setExpandedSessions)}
              </div>
            )}
          </>
        ) : msg.content?.startsWith('分析出错:') || msg.content?.startsWith('请求失败:') ? (
          <div className="text-xs text-red-500 dark:text-red-400">
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ) : msg.content ? (
          <div>
            <div className={PROSE_CLS}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={darkMarkdownComponents}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
            {renderAnalysesDropdown(msg, expandedSessions, setExpandedSessions)}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-gray-400">思考中...</span>
          </div>
        )}
      </div>
    </div>
  )
}

function renderAnalysesDropdown(
  msg: ChatMessage,
  expandedSessions: Record<number, boolean>,
  setExpandedSessions?: React.Dispatch<React.SetStateAction<Record<number, boolean>>>
) {
  if (!msg.analyses || msg.analyses.length === 0 || !setExpandedSessions) return null

  const isExpanded = !!expandedSessions[msg.sessionId!]

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setExpandedSessions((prev) => ({ ...prev, [msg.sessionId!]: !prev[msg.sessionId!] }))}
        className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer"
      >
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>查看各项目独立分析 ({msg.analyses.length})</span>
      </button>

      <div className="mt-2 space-y-2">
        {isExpanded &&
          msg.analyses.map((analysis, idx) => (
            <details key={idx} className="group">
              <summary className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg cursor-pointer text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition">
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                <span>{analysis.project_name}</span>
              </summary>
              <div className="mt-2 px-3 py-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className={PROSE_CLS}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={darkMarkdownComponents}
                  >
                    {analysis.answer}
                  </ReactMarkdown>
                </div>
              </div>
            </details>
          ))}
      </div>
    </div>
  )
}
