import React from 'react'
import { FolderOpen, ChevronRight, Folder, FileText, File } from 'lucide-react'
import type { FileNode } from '../../types'

interface Props {
  fileTree: FileNode[]
  loadingFiles: boolean
  selectedFile: FileNode | null
  expandedPaths: Record<string, boolean>
  setExpandedPaths: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onNodeSelect: (node: FileNode) => void
}

export default function FileTreePanel({
  fileTree,
  loadingFiles,
  selectedFile,
  expandedPaths,
  setExpandedPaths,
  onNodeSelect,
}: Props) {
  const isMarkdownFile = (filename: string) => {
    return filename.toLowerCase().endsWith('.md')
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
        onNodeSelect(node)
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
  )
}
