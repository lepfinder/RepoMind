import { useState, useEffect } from 'react'
import { X, Settings, Zap, Terminal, Loader2, Check } from 'lucide-react'

const API_BASE = 'http://localhost:3001'

interface Props {
  onClose: () => void
}

const PROVIDER_INFO: Record<string, { name: string; description: string; icon: typeof Zap }> = {
  hermes: {
    name: 'Hermes',
    description: '本地部署的 Hermes API Gateway，通过 OpenAI 兼容协议调用本地大模型',
    icon: Zap,
  },
  'claude-code': {
    name: 'Claude Code',
    description: 'Anthropic Claude Code CLI，支持文件读写、代码分析等工具调用',
    icon: Terminal,
  },
}

export default function SettingsModal({ onClose }: Props) {
  const [selected, setSelected] = useState('hermes')
  const [aiStatus, setAiStatus] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          fetch(`${API_BASE}/api/settings`),
          fetch(`${API_BASE}/api/ai-status`),
        ])
        const settings = await settingsRes.json()
        const status = await statusRes.json()
        if (settings.ai_provider) setSelected(settings.ai_provider)
        setAiStatus(status)
      } catch (e) {
        console.error('Failed to load settings:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_provider', value: selected }),
      })
      setSaved(true)
      setTimeout(() => onClose(), 800)
    } catch (e) {
      console.error('Failed to save settings:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            设置
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Provider Selection */}
            <div className="mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">AI 分析引擎</p>
              <div className="space-y-2">
                {Object.entries(PROVIDER_INFO).map(([key, info]) => {
                  const available = aiStatus[key]
                  const isSelected = selected === key
                  const Icon = info.icon
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(key)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {info.name}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${available ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {available ? '可用' : '不可用'}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {info.description}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                  saved
                    ? 'bg-emerald-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {saved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    已保存
                  </>
                ) : saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存设置'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
