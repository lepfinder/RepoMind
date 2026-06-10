export const TOOL_EMOJI: Record<string, string> = {
  // Hermes tools
  read_file: '📖', search_files: '🔍', terminal: '⚡',
  execute_code: '🐍', browser_navigate: '🌐', browser_snapshot: '👁️',
  // Claude Code tools
  Read: '📖', Write: '✏️', Edit: '✏️', Bash: '⚡',
  Glob: '🔍', Grep: '🔍', WebFetch: '🌐', WebSearch: '🔍',
  Agent: '🤖', NotebookEdit: '📓', thinking: '🤔',
}

export const TOOL_VERB: Record<string, string> = {
  // Hermes tools
  read_file: 'read', search_files: 'search', terminal: 'run',
  execute_code: 'exec', browser_navigate: 'goto', browser_snapshot: 'snap',
  // Claude Code tools
  Read: 'read', Write: 'write', Edit: 'edit', Bash: 'run',
  Glob: 'search', Grep: 'grep', WebFetch: 'fetch', WebSearch: 'search',
  Agent: 'agent', NotebookEdit: 'edit', thinking: '',
}

export function toolIcon(tool: string) {
  return TOOL_EMOJI[tool] || '🔧'
}

export function toolVerb(tool: string) {
  return TOOL_VERB[tool] || tool
}

export function shortLabel(label: string) {
  const parts = label.split('/')
  return parts.length > 2 ? parts.slice(-2).join('/') : (parts.pop() || label)
}
