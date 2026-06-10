import React from 'react'
import { Info, Star, GitFork, AlertTriangle } from 'lucide-react'
import type { Project } from '../../types'

interface Props {
  project: Project
  langColor: string
  dateStr: string
  remoteDateStr: string | null
}

export default function ProjectOverview({
  project,
  langColor,
  dateStr,
  remoteDateStr,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* 左侧主 Bento 卡片 (占据 2 列) */}
      <div className="lg:col-span-2 space-y-5">
        {/* 基本信息面板 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-colors duration-200">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3.5 flex items-center gap-2 select-none">
            <Info className="w-4 h-4 text-blue-500" />
            <span>项目基本信息</span>
          </h3>
          
          {project.description && (
            <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed mb-4 bg-gray-50 dark:bg-gray-955 p-3 rounded-lg border border-gray-150 dark:border-gray-800/40">
              {project.description}
            </p>
          )}

          {project.topics && project.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {project.topics.map(t => (
                <span key={t} className="px-2 py-0.5 bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px] font-semibold border border-blue-500/10 transition hover:bg-blue-500/10">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs border-t border-gray-100 dark:border-gray-855 pt-5">
            <div>
              <span className="text-gray-400 dark:text-gray-500 font-semibold block text-[10px] uppercase tracking-wider">开发语言</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${langColor}`} />
                <span className="text-gray-955 dark:text-gray-150 font-bold">{project.language || '未知'}</span>
              </div>
            </div>

            <div>
              <span className="text-gray-400 dark:text-gray-500 font-semibold block text-[10px] uppercase tracking-wider">作者 / 归属组</span>
              <p className="text-gray-955 dark:text-gray-155 font-bold mt-1">{project.owner || '本地专属目录'}</p>
            </div>

            <div>
              <span className="text-gray-400 dark:text-gray-500 font-semibold block text-[10px] uppercase tracking-wider">本地最后提交</span>
              <p className="text-gray-955 dark:text-gray-155 font-semibold mt-1">{dateStr}</p>
            </div>

            <div>
              <span className="text-gray-400 dark:text-gray-500 font-semibold block text-[10px] uppercase tracking-wider">Commit SHA</span>
              <p className="text-gray-955 dark:text-gray-155 font-mono text-[10px] truncate select-all bg-gray-50 dark:bg-gray-955 px-2 py-0.5 rounded border border-gray-200/50 dark:border-gray-800/40 mt-1 select-all">{project.lastCommitHash || '无 Commit 信息'}</p>
            </div>
          </div>
        </div>

        {/* 物理路径与 Commit 消息面板 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-colors duration-200">
          <h3 className="text-xs font-semibold text-gray-450 dark:text-gray-500 block uppercase tracking-wider mb-2">本地最后提交消息</h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-xs italic bg-gray-50 dark:bg-gray-955 p-3.5 rounded-lg border border-gray-150 dark:border-gray-800/40 font-medium">
            "{project.lastCommitMessage || '无提交日志'}"
          </p>

          <div className="mt-5">
            <h3 className="text-xs font-semibold text-gray-455 dark:text-gray-500 block uppercase tracking-wider mb-2">本地项目物理绝对路径</h3>
            <code className="block p-3 bg-gray-50 dark:bg-gray-955 text-gray-600 dark:text-gray-400 rounded-lg font-mono text-[10px] break-all select-all border border-gray-200/50 dark:border-gray-800/40 shadow-inner">
              {project.path}
            </code>
          </div>
        </div>
      </div>

      {/* 右侧 GitHub 状态与指标面板 (占据 1 列) */}
      <div className="lg:col-span-1">
        {project.owner ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-colors duration-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 select-none">
              <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>GitHub 指标与同步</span>
            </h3>

            {/* Stars & Forks 卡片组 */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 rounded-xl p-2.5 text-center">
                <div className="text-lg font-black text-amber-500 flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 fill-amber-500" />
                  <span>{project.stars}</span>
                </div>
                <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 font-bold uppercase tracking-wider">Stars</div>
              </div>
              <div className="bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20 dark:border-cyan-500/30 rounded-xl p-2.5 text-center">
                <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 flex items-center justify-center gap-1">
                  <GitFork className="w-4 h-4" />
                  <span>{project.forks}</span>
                </div>
                <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 font-bold uppercase tracking-wider">Forks</div>
              </div>
            </div>

            {/* 同步状态 */}
            <div className="bg-gray-50/60 dark:bg-gray-955/60 border border-gray-150 dark:border-gray-800/80 rounded-xl p-4 text-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/40 pb-2">
                <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">版本同步对比</span>
                {project.compareStatus === 'identical' && (
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-[9px] font-bold">已同步</span>
                )}
                {project.compareStatus === 'ahead' && (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[9px] font-bold">落后远程</span>
                )}
                {project.compareStatus === 'behind' && (
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[9px] font-bold">领先远程</span>
                )}
                {project.compareStatus === 'diverged' && (
                  <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded text-[9px] font-bold">分支分叉</span>
                )}
                {(project.compareStatus === '' || project.compareStatus.startsWith('unknown')) && (
                  <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[9px]">未配 Token</span>
                )}
              </div>

              <div className="leading-relaxed">
                {project.compareStatus === 'identical' && (
                  <p className="text-green-600 dark:text-green-400/90 font-medium">本地仓库分支与 GitHub 远程完全一致，保持最新同步状态。</p>
                )}
                {project.compareStatus === 'ahead' && (
                  <p className="text-amber-600 dark:text-amber-400/90 font-medium flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 fill-amber-500/10 shrink-0 mt-0.5" />
                    <span>落后远程 {project.aheadBy} 个提交，本地可能缺失了重要的更新更改。</span>
                  </p>
                )}
                {project.compareStatus === 'behind' && (
                  <p className="text-blue-600 dark:text-blue-400/90 font-medium">本地领先远程 {project.behindBy} 个提交，存在尚未推送的本地修改。</p>
                )}
                {project.compareStatus === 'diverged' && (
                  <p className="text-rose-600 dark:text-rose-400/90 font-medium">本地与远端分支已经分叉（超前 {project.behindBy}，落后 {project.aheadBy} 个提交）。</p>
                )}
                {(project.compareStatus === '' || project.compareStatus.startsWith('unknown')) && (
                  <p className="text-gray-400 dark:text-gray-500 leading-normal">未检测到 GITHUB_TOKEN 环境变量。配置有效的 Token 即可自动激活此处的版本差异比对看板。</p>
                )}
              </div>

              {remoteDateStr && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800/40 text-[9px] text-gray-400 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-50" />
                    <span>本地最后提交：<strong className="text-gray-600 dark:text-gray-300 font-medium">{dateStr}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>远端最后推送：<strong className="text-gray-600 dark:text-gray-300 font-medium">{remoteDateStr}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {project.compareStatus === 'ahead' && (
              <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-3 text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 fill-amber-500/10 shrink-0 mt-0.5" />
                <span>本地版本偏旧，建议您打开终端，在项目根目录中执行 <code>git pull</code>。</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-colors duration-200 text-center py-12 flex flex-col justify-center items-center h-full">
            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-955 rounded-full flex items-center justify-center border border-gray-200/50 dark:border-gray-800/40 mb-3 text-gray-400 dark:text-gray-500">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-1">本地专有仓库</h4>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 max-w-[200px] leading-relaxed select-none">此项目纯属本地专属存储库，没有配置任何 GitHub 远程上游源。</p>
          </div>
        )}
      </div>
    </div>
  )
}
