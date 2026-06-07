import { Star, GitFork } from 'lucide-react'
import type { Project } from '../types'

interface Props {
  project: Project
  langColor: string
  onClick: () => void
}

export default function ProjectCard({ project, langColor, onClick }: Props) {
  const dateStr = project.lastCommitDate
    ? new Date(project.lastCommitDate).toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'short', day: 'numeric'
      })
    : 'Unknown'

  // 计算版本同步差异微标
  const renderCompareBadge = () => {
    const { compareStatus, aheadBy, behindBy } = project;
    if (!compareStatus || compareStatus.startsWith('unknown')) return null;

    if (compareStatus === 'identical') {
      return (
        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[11px] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          已与远程同步
        </span>
      );
    }
    if (compareStatus === 'ahead') {
      return (
        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[11px] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          落后远程 {aheadBy} 个版本
        </span>
      );
    }
    if (compareStatus === 'behind') {
      return (
        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[11px] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          本地领先 {behindBy} 个提交
        </span>
      );
    }
    if (compareStatus === 'diverged') {
      return (
        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[11px] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          分支分叉 (+{behindBy}/-{aheadBy})
        </span>
      );
    }
    return null;
  };

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 hover:shadow-md cursor-pointer flex flex-col justify-between transition-all duration-200 min-h-[190px]"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base group-hover:text-blue-500 dark:group-hover:text-blue-400 transition line-clamp-1 flex-1">
            {project.name}
          </h3>
          
          {/* Stars & Forks 展示 */}
          {project.owner && (
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px] shrink-0 font-semibold bg-gray-100 dark:bg-gray-950 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-800">
              <span className="flex items-center gap-1 text-amber-500">
                <Star className="w-3 h-3 fill-amber-500" /> <span className="text-gray-700 dark:text-gray-300 font-medium">{project.stars}</span>
              </span>
              <span className="flex items-center gap-1 text-cyan-500 dark:text-cyan-400">
                <GitFork className="w-3 h-3" /> <span className="text-gray-700 dark:text-gray-300 font-medium">{project.forks}</span>
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 min-h-[2rem]">
          {project.description}
        </p>
      </div>

      <div>
        {/* 比对状态微标 */}
        {renderCompareBadge() && (
          <div className="mb-3 flex">
            {renderCompareBadge()}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800/40 pt-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${langColor}`} />
            {project.language}
          </span>
          <span>{dateStr}</span>
        </div>

        {project.topics && project.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {project.topics.slice(0, 2).map(t => (
              <span key={t} className="px-1.5 py-0.5 bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px]">
                {t}
              </span>
            ))}
            {project.topics.length > 2 && (
              <span className="px-1.5 py-0.5 text-gray-500 dark:text-gray-600 text-[10px]">+{project.topics.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
