import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { BookOpen } from 'lucide-react'
import type { Project, FileNode } from '../../types'

interface Props {
  project: Project
  selectedFile: FileNode | null
  readme: string
  loadingReadme: boolean
  selectedFileContent: string
  loadingFileContent: boolean
  apiBase: string
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

export default function FilePreviewPanel({
  project,
  selectedFile,
  readme,
  loadingReadme,
  selectedFileContent,
  loadingFileContent,
  apiBase,
}: Props) {
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

  if (!selectedFile) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm min-h-[350px]">
        {loadingReadme ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-xs mt-3 select-none">读取 README.md 中...</p>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none
            [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-gray-900 dark:[&_h1]:text-white [&_h1]:mb-4 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-gray-100 dark:[&_h1]:border-gray-800
            [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-850 dark:[&_h2]:text-gray-100 [&_h2]:mt-5 [&_h2]:mb-3
            [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-gray-800 dark:[&_h3]:text-gray-200 [&_h3]:mt-4 [&_h3]:mb-2
            [&_p]:text-gray-700 dark:[&_p]:text-gray-300 [&_p]:my-3 [&_p]:leading-relaxed
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3
            [&_li]:text-gray-700 dark:[&_li]:text-gray-300 [&_li]:my-1.5
            [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-blue-600 dark:[&_code]:text-blue-400 [&_code]:font-mono [&_code]:text-xs
            [&_pre]:bg-gray-955 dark:[&_pre]:bg-gray-955 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-gray-200 dark:[&_pre]:border-gray-800
            [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-gray-250 [&_pre_code]:text-xs
            [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:text-gray-500 dark:[&_blockquote]:text-gray-400 [&_blockquote]:my-3 [&_blockquote]:italic
            [&_table]:w-full [&_table]:my-4 [&_table]:border-collapse
            [&_th]:bg-gray-50 dark:[&_th]:bg-gray-850 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-gray-900 dark:[&_th]:text-white [&_th]:border [&_th]:border-gray-200 dark:[&_th]:border-gray-800 [&_th]:text-xs
            [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-gray-855 [&_td]:text-gray-700 dark:[&_td]:text-gray-355 [&_td]:text-xs
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
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 shadow-sm min-h-[350px]">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 select-none">
        <BookOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">文件预览</span>
        <span className="text-xs text-gray-400">/</span>
        <span className="text-xs font-bold text-gray-900 dark:text-white truncate font-mono">{selectedFile.path}</span>
      </div>

      {loadingFileContent ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-xs mt-3 select-none">加载文件内容中...</p>
        </div>
      ) : isImageFile(selectedFile.name) ? (
        <div className="flex justify-center items-center py-8 bg-gray-50 dark:bg-gray-955 rounded-xl border border-gray-100 dark:border-gray-800/60 shadow-inner">
          <img
            src={`${apiBase}/api/projects/${project.name}/file?path=${encodeURIComponent(selectedFile.path)}`}
            alt={selectedFile.name}
            className="max-h-96 rounded shadow border border-gray-200 dark:border-gray-800"
          />
        </div>
      ) : isMarkdownFile(selectedFile.name) ? (
        <div className="prose prose-sm dark:prose-invert max-w-none
          [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-gray-900 dark:[&_h1]:text-white [&_h1]:mb-4 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-gray-100 dark:[&_h1]:border-gray-800
          [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-850 dark:[&_h2]:text-gray-100 [&_h2]:mt-5 [&_h2]:mb-3
          [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-gray-800 dark:[&_h3]:text-gray-200 [&_h3]:mt-4 [&_h3]:mb-2
          [&_p]:text-gray-700 dark:[&_p]:text-gray-300 [&_p]:my-3 [&_p]:leading-relaxed
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3
          [&_li]:text-gray-700 dark:[&_li]:text-gray-300 [&_li]:my-1.5
          [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-blue-600 dark:[&_code]:text-blue-400 [&_code]:font-mono [&_code]:text-xs
          [&_pre]:bg-gray-955 dark:[&_pre]:bg-gray-955 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-gray-200 dark:[&_pre]:border-gray-800
          [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-gray-250 [&_pre_code]:text-xs
          [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:text-gray-500 dark:[&_blockquote]:text-gray-400 [&_blockquote]:my-3 [&_blockquote]:italic
          [&_table]:w-full [&_table]:my-4 [&_table]:border-collapse
          [&_th]:bg-gray-50 dark:[&_th]:bg-gray-855 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-gray-900 dark:[&_th]:text-white [&_th]:border [&_th]:border-gray-200 dark:[&_th]:border-gray-800 [&_th]:text-xs
          [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-gray-855 [&_td]:text-gray-700 dark:[&_td]:text-gray-355 [&_td]:text-xs
          [&_hr]:border-gray-150 dark:[&_hr]:border-gray-800 [&_hr]:my-5
          [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline
          [&_strong]:text-gray-900 dark:[&_strong]:text-white
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={lightMarkdownComponents}>
            {selectedFileContent}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-gray-150 dark:border-gray-800 shadow-inner">
          <SyntaxHighlighter
            language={getLanguageFromFilename(selectedFile.name)}
            style={ghcolors}
            customStyle={{
              margin: 0,
              padding: '1.25rem 1rem',
              background: '#f8f9fa',
              fontSize: '11px',
              lineHeight: '1.6',
            }}
            PreTag={({ children, ...rest }: any) => <pre {...rest} style={{ ...rest.style, background: '#f8f9fa', margin: 0 }}>{children}</pre>}
            codeTagProps={{
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              }
            }}
            showLineNumbers={true}
          >
            {selectedFileContent || ''}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}
