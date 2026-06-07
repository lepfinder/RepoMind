import { spawn } from 'child_process';
import { createHash } from 'crypto';

export const name = 'claude-code';
export const displayName = 'Claude Code';

// 将任意字符串转换为确定性 UUID v4 格式
function toUUID(str) {
  const hash = createHash('sha256').update(str).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),  // version 4
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),  // variant
    hash.slice(20, 32),
  ].join('-');
}

// Format tool name + input into a human-readable label
function formatToolLabel(toolName, input) {
  if (!input) return toolName;
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return input.file_path ? `${toolName} ${input.file_path}` : toolName;
    case 'Bash':
      return input.command ? `Bash ${input.command}` : toolName;
    case 'Glob':
      return input.pattern ? `Glob ${input.pattern}` : toolName;
    case 'Grep':
      return input.pattern ? `Grep ${input.pattern}` : toolName;
    case 'WebFetch':
      return input.url ? `Fetch ${input.url}` : toolName;
    case 'WebSearch':
      return input.query ? `Search ${input.query}` : toolName;
    case 'Agent':
      return input.prompt ? `Agent ${String(input.prompt).slice(0, 60)}` : toolName;
    case 'NotebookEdit':
      return input.notebook_path ? `Edit ${input.notebook_path}` : toolName;
    default:
      return toolName;
  }
}

export async function isAvailable() {
  try {
    const { execSync } = await import('child_process');
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function analyze({ projectPath, projectName, systemPrompt, userMessage, sessionId, abortSignal, onChunk, onTool, onError, onDone }) {
  const prompt = `${systemPrompt}\n\n${userMessage}`;

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--permission-mode', 'acceptEdits',
    '--max-turns', '30',
  ];

  // Use --continue to resume the most recent session in this directory
  // This avoids "session already in use" errors during parallel analysis
  args.push('--continue');

  console.log(`[Claude Code] Spawning for project: ${projectName}`);

  const child = spawn('claude', args, {
    cwd: projectPath,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Handle abort
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      child.kill('SIGTERM');
    });
  }

  let currentContent = '';
  let buffer = '';
  // Track tool_use blocks for rich activity reporting
  const activeTools = new Map(); // index -> { name, input }
  let toolIndex = 0;

  child.stderr.on('data', (chunk) => {
    console.error('[Claude Code stderr]', chunk.toString().trim());
  });

  // Parse JSONL output
  for await (const chunk of child.stdout) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed);

        if (event.type === 'stream_event') {
          const streamEvent = event.event;
          if (streamEvent?.type === 'content_block_start') {
            const block = streamEvent.content_block;
            if (block?.type === 'tool_use') {
              const idx = streamEvent.index ?? toolIndex++;
              activeTools.set(idx, { name: block.name, input: '' });
              onTool({
                tool: block.name,
                label: block.name,
                done: false,
              });
            }
          } else if (streamEvent?.type === 'content_block_delta') {
            const delta = streamEvent.delta;
            if (delta?.type === 'text_delta' && delta.text) {
              currentContent += delta.text;
              onChunk(delta.text);
            } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
              // Accumulate tool input for richer activity label
              const idx = streamEvent.index;
              const tool = activeTools.get(idx);
              if (tool) {
                tool.input += delta.partial_json;
              }
            }
          } else if (streamEvent?.type === 'content_block_stop') {
            const idx = streamEvent.index;
            const tool = activeTools.get(idx);
            if (tool) {
              // Send final label with input details
              let label = tool.name;
              try {
                const input = JSON.parse(tool.input);
                label = formatToolLabel(tool.name, input);
              } catch {}
              onTool({ tool: tool.name, label, done: true });
              activeTools.delete(idx);
            }
          }
        } else if (event.type === 'assistant') {
          // Completed assistant turn — extract tool_use blocks
          const content = event.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use') {
                const label = formatToolLabel(block.name, block.input);
                onTool({ tool: block.name, label, done: true });
              } else if (block.type === 'text' && block.text) {
                // In non-streaming mode, text comes as complete blocks
                // Only add if not already streamed via deltas
                if (!currentContent.includes(block.text)) {
                  currentContent += block.text;
                  onChunk(block.text);
                }
              }
            }
          }
        } else if (event.type === 'result') {
          if (event.is_error) {
            onError(event.result || 'Claude Code analysis failed');
          }
          // result event signals completion — handled below
        }
      } catch {}
    }
  }

  // Wait for process to exit
  await new Promise((resolve) => {
    child.on('close', resolve);
  });

  onDone();
  return currentContent;
}
