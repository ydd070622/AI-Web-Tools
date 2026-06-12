import type { AgentModel, AgentMessage, AgentProvider } from '../types'

// Provider list
export const AGENT_PROVIDERS: AgentProvider[] = [
  { id: 'siliconflow', name: 'SiliconFlow (硅基流动)', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', models: ['Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen2.5-14B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V2.5', 'deepseek-ai/DeepSeek-V3'] },
  { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'zhipu', name: '智谱 AI (GLM)', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', models: ['glm-4-plus', 'glm-4-flash', 'glm-4-long'] },
  { id: 'moonshot', name: 'Moonshot (月之暗面)', endpoint: 'https://api.moonshot.cn/v1/chat/completions', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
  { id: 'qwen', name: '通义千问 (阿里云)', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', models: ['qwen-max', 'qwen-plus', 'qwen-turbo'] },
  { id: 'custom', name: '自定义 (OpenAI 兼容)', endpoint: '', models: [] },
]

// Model storage key
const MODELS_STORE_KEY = 'agentModels'

export async function loadModels(): Promise<AgentModel[]> {
  if (window.electronAPI) {
    return (await window.electronAPI.getStore(MODELS_STORE_KEY)) || []
  }
  try {
    return JSON.parse(localStorage.getItem(MODELS_STORE_KEY) || '[]')
  } catch { return [] }
}

export async function saveModels(models: AgentModel[]): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.setStore(MODELS_STORE_KEY, models)
  } else {
    localStorage.setItem(MODELS_STORE_KEY, JSON.stringify(models))
  }
}

export function getProviderEndpoint(providerId: string): string {
  const p = AGENT_PROVIDERS.find(pr => pr.id === providerId)
  if (p && p.endpoint) return p.endpoint
  if (providerId === 'custom') return ''
  return ''
}

export function getProviderBaseUrl(providerId: string): string {
  const ep = getProviderEndpoint(providerId)
  if (!ep) return ''
  // Remove /chat/completions to get base URL
  return ep.replace(/\/chat\/completions\/?$/, '')
}

/**
 * Fetch available models from a provider's /v1/models endpoint
 */
export async function fetchProviderModels(providerId: string, apiKey: string): Promise<string[]> {
  const baseUrl = getProviderBaseUrl(providerId)
  if (!baseUrl) throw new Error('未知提供商')

  const resp = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!resp.ok) {
    const text = await resp.text()
    let msg = `获取模型失败 (${resp.status})`
    try { const e = JSON.parse(text); msg = e.error?.message || e.message || msg } catch {}
    throw new Error(msg)
  }
  const data = await resp.json()
  // OpenAI-compatible: { data: [{ id: '...', ... }] }
  const models: string[] = (data.data || [])
    .map((m: any) => m.id)
    .sort()
  return models
}

/**
 * Send a chat completion request with streaming support.
 * Returns a ReadableStream-like object or full response.
 */
export async function streamChat(
  model: AgentModel,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<Response | null> {
  const endpoint = getProviderEndpoint(model.providerId)
  if (!endpoint) throw new Error('未找到该提供商的 API 端点')

  const body: Record<string, any> = {
    model: model.modelName,
    messages,
    stream: true,
    max_tokens: 4096,
    temperature: 0.7,
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      let errMsg = `API 错误 (${response.status})`
      try {
        const e = JSON.parse(errText)
        errMsg = e.error?.message || e.message || errMsg
      } catch {}
      throw new Error(errMsg)
    }

    return response
  } catch (err: any) {
    if (err.name === 'AbortError') throw err
    throw new Error(`请求失败: ${err.message}`)
  }
}

/**
 * Parse SSE stream from chat completion response
 */
export async function* parseSSEStream(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {}
    }
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
