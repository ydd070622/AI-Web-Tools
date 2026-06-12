/**
 * Multi-Engine Search Service
 * Primary: IPC call to Electron main process (Node.js, no CORS)
 *   → main process uses: DDG Instant Answer API + DDG HTML + Bing
 * Fallback: Direct fetch from renderer (browser dev mode only)
 *   → uses DDG API + DDG HTML
 */

export interface SearchResult {
  title: string
  snippet: string
  url: string
  source?: string
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'

function stripHtml(h: string): string {
  return h.replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\s+/g,' ').trim()
}

// ===== Fallback 1: DDG Instant Answer API =====
async function searchDDG_API(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const resp = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) })
    if (!resp.ok) return results
    const data = await resp.json() as any

    if (data.AbstractText?.trim()) {
      results.push({
        title: data.Heading || query,
        snippet: data.AbstractText.trim(),
        url: data.AbstractURL || '',
        source: 'DuckDuckGo',
      })
    }
    if (Array.isArray(data.RelatedTopics)) {
      for (const t of data.RelatedTopics) {
        if (!t.Text || !t.FirstURL) continue
        results.push({ title: stripHtml(t.Text).slice(0, 120), snippet: '', url: t.FirstURL, source: 'DuckDuckGo' })
      }
    }
    if (Array.isArray(data.Results)) {
      for (const r of data.Results) {
        if (!r.Text || !r.FirstURL) continue
        results.push({ title: stripHtml(r.Text).slice(0, 120), snippet: '', url: r.FirstURL, source: 'DuckDuckGo' })
      }
    }
  } catch {}
  return results
}

// ===== Fallback 2: DDG HTML Search =====
async function searchDDG_HTML(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    })
    if (!resp.ok) return results
    const html = await resp.text()

    const linkPat = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    const links: { url: string; title: string }[] = []
    let m
    while ((m = linkPat.exec(html)) !== null) {
      let u = m[1]
      if (u.startsWith('//')) u = 'https:' + u
      const um = u.match(/uddg=([^&]+)/)
      if (um) u = decodeURIComponent(um[1])
      if (u.startsWith('http')) links.push({ url: u, title: stripHtml(m[2]) })
    }
    const snipPat = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
    const snippets: string[] = []
    while ((m = snipPat.exec(html)) !== null) snippets.push(stripHtml(m[1]))

    for (let i = 0; i < links.length; i++) {
      results.push({ title: links[i].title, snippet: snippets[i] || '', url: links[i].url, source: 'DuckDuckGo' })
    }
  } catch {}
  return results
}

async function searchFallback(query: string): Promise<SearchResult[]> {
  const [ddgApi, ddgHtml] = await Promise.all([searchDDG_API(query), searchDDG_HTML(query)])
  const all = [...ddgApi, ...ddgHtml]
  const seen = new Set<string>(); const deduped: SearchResult[] = []
  for (const r of all) { if (!r.url || seen.has(r.url)) continue; seen.add(r.url); deduped.push(r) }
  return deduped.slice(0, 10)
}

// ===== Public API =====
export async function searchWebMulti(query: string): Promise<SearchResult[]> {
  // Primary: Electron main process IPC (no CORS, DDG API + DDG HTML + Bing)
  if (window.electronAPI?.webSearch) {
    try {
      const results = await window.electronAPI.webSearch(query)
      if (results && results.length > 0) return results
    } catch {
      // IPC failed, fall through to renderer fallback
    }
  }
  // Fallback: renderer direct fetch (DDG API + DDG HTML)
  return searchFallback(query)
}

export function formatSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return ''
  return `\n\n【以下是从搜索引擎搜索到的实时信息，请基于这些信息综合回答用户问题，引用关键信息来源】\n${results.map((r, i) => `${i + 1}. [${r.source || '网页'}] ${r.title}\n   ${r.snippet || '(无摘要)'}\n   来源: ${r.url}`).join('\n\n')}\n【搜索信息结束】`
}
