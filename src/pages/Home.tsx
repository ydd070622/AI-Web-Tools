import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'

interface SearchEngine {
  id: string
  name: string
  buildUrl: (q: string) => string
}

const engines: SearchEngine[] = [
  { id: 'baidu', name: '百度', buildUrl: q => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}` },
  { id: 'bing', name: '必应', buildUrl: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { id: 'google', name: 'Google', buildUrl: q => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { id: 'deepseek', name: 'DeepSeek', buildUrl: q => `https://chat.deepseek.com/a/chat/s/${encodeURIComponent(q)}` },
  { id: 'kimi', name: 'Kimi', buildUrl: q => `https://kimi.moonshot.cn/?q=${encodeURIComponent(q)}` },
]

type WebviewElement = HTMLElement & { src: string }

export default function Home({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState(engines[0])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchUrl, setSearchUrl] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!searchUrl || !containerRef.current) return
    const wv = document.createElement('webview') as unknown as WebviewElement
    wv.setAttribute('src', searchUrl)
    wv.setAttribute('disablewebsecurity', '')
    wv.setAttribute('allowpopups', '')
    Object.assign(wv.style, {
      width: '100%', height: '100%', border: 'none',
      position: 'absolute', top: '0', left: '0',
    })
    while (containerRef.current.firstChild) containerRef.current.removeChild(containerRef.current.firstChild)
    containerRef.current.appendChild(wv)
    return () => wv.remove()
  }, [searchUrl])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = () => {
    const q = query.trim()
    if (!q) return
    setSearchUrl(engine.buildUrl(q))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleBack = () => setSearchUrl(null)

  const selectEngine = (e: SearchEngine) => {
    setEngine(e)
    setShowDropdown(false)
  }

  if (searchUrl) {
    return (
      <div className="home-page-results">
        <div className="home-results-bar">
          <span className="home-results-back" onClick={handleBack}>← 返回搜索</span>
          <span className="home-results-engine">{engine.name} 搜索</span>
        </div>
        <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />
      </div>
    )
  }

  return (
    <div className="home-page">
      <div className="home-content">
        <h1 className="home-title">AI Web Tools</h1>
        <p className="home-subtitle">所有 AI 工具，一站汇聚</p>
        <div className="home-search-wrap">
          <input
            className="home-search-box"
            type="text"
            placeholder="输入关键词搜索..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Search className="home-search-icon" size={18} onClick={handleSearch} />
          <div className="home-engine-select" ref={dropdownRef}>
            <div className="home-engine-current" onClick={() => setShowDropdown(!showDropdown)}>
              {engine.name}
              <ChevronDown size={12} />
            </div>
            {showDropdown && (
              <div className="home-engine-dropdown">
                {engines.map(e => (
                  <div
                    key={e.id}
                    className={'home-engine-option' + (engine.id === e.id ? ' active' : '')}
                    onClick={() => selectEngine(e)}
                  >
                    {e.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
