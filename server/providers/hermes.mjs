import fs from 'fs';
import path from 'path';

export const name = 'hermes';
export const displayName = 'Hermes';

function getHermesApiKey() {
  try {
    const userHome = process.env.HOME || '/Users/xiyangxie';
    const envPath = path.join(userHome, '.hermes', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/API_SERVER_KEY\s*=\s*(.+)/);
      if (match) {
        return match[1].trim().replace(/['"]/g, '');
      }
    }
  } catch (e) {
    console.error('Failed to parse ~/.hermes/.env for API key:', e);
  }
  return 'change-me-local-dev';
}

export async function isAvailable() {
  try {
    const apiKey = getHermesApiKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://127.0.0.1:8642/v1/models', {
      signal: controller.signal,
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyze({ projectPath, projectName, systemPrompt, userMessage, sessionId, abortSignal, onChunk, onTool, onError, onDone }) {
  const apiKey = getHermesApiKey();

  const payload = {
    model: 'hermes-agent',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: true
  };

  console.log(`[Hermes] Sending request for project: ${projectName}, session: ${sessionId}`);

  const response = await fetch('http://127.0.0.1:8642/v1/chat/completions', {
    signal: abortSignal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Hermes-Session-Id': sessionId,
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    onError(`网关响应错误: ${errText}`);
    return '';
  }

  let buffer = '';
  let currentContent = '';
  let currentEventType = '';

  for await (const chunk of response.body) {
    const chunkStr = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    buffer += chunkStr;

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('event: ')) {
        currentEventType = trimmed.slice(7).trim();
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') continue;

        try {
          if (currentEventType === 'hermes.tool.progress') {
            const toolData = JSON.parse(dataStr);
            if (toolData.status === 'running' && toolData.label) {
              onTool({ tool: toolData.tool, label: toolData.label, done: false });
            } else if (toolData.status === 'completed' && toolData.tool) {
              onTool({ tool: toolData.tool, label: toolData.tool, done: true });
            }
            currentEventType = '';
            continue;
          }

          const parsed = JSON.parse(dataStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            currentContent += content;
            onChunk(content);
          }
        } catch {}
        currentEventType = '';
      }
    }
  }

  // Handle remaining buffer
  if (buffer.trim().startsWith('data: ')) {
    const dataStr = buffer.trim().slice(6).trim();
    if (dataStr !== '[DONE]') {
      try {
        const parsed = JSON.parse(dataStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          currentContent += content;
          onChunk(content);
        }
      } catch {}
    }
  }

  onDone();
  return currentContent;
}
