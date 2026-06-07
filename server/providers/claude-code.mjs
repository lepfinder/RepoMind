import { spawn } from 'child_process';

export const name = 'claude-code';
export const displayName = 'Claude Code';

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

  // Reuse session for continuity
  if (sessionId) {
    args.push('--session-id', sessionId);
  }

  console.log(`[Claude Code] Spawning for project: ${projectName}, session: ${sessionId}`);

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
          if (streamEvent?.type === 'content_block_delta') {
            const delta = streamEvent.delta;
            if (delta?.type === 'text_delta' && delta.text) {
              currentContent += delta.text;
              onChunk(delta.text);
            }
          } else if (streamEvent?.type === 'content_block_start') {
            const block = streamEvent.content_block;
            if (block?.type === 'tool_use') {
              onTool({
                tool: block.name,
                label: block.name,
                done: false,
              });
            }
          }
        } else if (event.type === 'assistant') {
          // Completed assistant turn — extract tool_use blocks
          const content = event.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use') {
                const label = block.input
                  ? `${block.name} ${JSON.stringify(block.input).slice(0, 80)}`
                  : block.name;
                onTool({ tool: block.name, label, done: false });
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
