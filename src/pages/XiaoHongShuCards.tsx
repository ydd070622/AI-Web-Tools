import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, Trash2, Edit3, Check, X, Settings, RefreshCw, ArrowLeft, ArrowRight, Copy, ExternalLink, ChevronDown } from 'lucide-react'

type WebviewElement = HTMLElement & {
  src: string
  getURL: () => string
  getWebContentsId: () => number
  canGoBack: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
  executeJavaScript: (code: string) => Promise<any>
  addEventListener: (event: string, handler: (...args: any[]) => void) => void
}

interface AccountConfig {
  id: string
  name: string
  color: string
  loggedIn?: boolean
  lastLogin?: number
  lastActive?: number
}

interface Tab {
  id: string
  url: string
  title: string
}

interface ComboState {
  tabs: Tab[]
  activeTabId: string
}

const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#a29bfe', '#55efc4', '#fd79a8', '#fdcb6e', '#74b9ff']
const STORE_KEY = 'xhs_accounts'

const PLATFORMS = [
  { key: 'xhs',     label: '小红书',     url: 'https://www.xiaohongshu.com',       emoji: '📕' },
  { key: 'creator', label: '创作者中心', url: 'https://creator.xiaohongshu.com',    emoji: '✍️' },
  { key: 'jg',      label: '聚光平台',   url: 'https://ad.xiaohongshu.com',          emoji: '📊' },
]

function genColor(i: number) { return COLORS[i % COLORS.length] }

function defaultAccounts(): AccountConfig[] {
  const now = Date.now()
  return [
    { id: 'xhs_account_1', name: '小红书·账号一', color: genColor(0), loggedIn: true, lastLogin: now - 3600000, lastActive: now - 600000 },
    { id: 'xhs_account_2', name: '小红书·账号二', color: genColor(1), loggedIn: true, lastLogin: now - 7200000, lastActive: now - 3600000 },
    { id: 'xhs_account_3', name: '小红书·账号三', color: genColor(2), loggedIn: false, lastLogin: now - 86400000, lastActive: now - 43200000 },
  ]
}

let tabCounter = 0

export default function XiaoHongShuCards({ visible, onUrlChange, resetKey }: { visible: boolean; onUrlChange?: (url: string, pageContent?: string) => void; resetKey?: number }) {
  const [accounts, setAccounts] = useState<AccountConfig[]>(defaultAccounts())
  const [loaded, setLoaded] = useState(false)
  const [manageMode, setManageMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [activeView, setActiveView] = useState<{ account: AccountConfig; platformKey: string; url: string; label: string } | null>(null)

  // Re-clicking sidebar clears view back to empty state
  useEffect(() => {
    if (resetKey && resetKey > 0) setActiveView(null)
  }, [resetKey])

  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState('')
  const [ctxTab, setCtxTab] = useState<Tab | null>(null)
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  // Per-combo state persistence (tabs survive switching between accounts/platforms)
  const comboStateRef = useRef<Map<string, ComboState>>(new Map())
  // Refs mirroring state to avoid stale closures in event handlers
  const tabsRef = useRef<Tab[]>([])
  const activeTabIdRef = useRef('')
  const activeViewRef = useRef(activeView)
  const activeViewKeyRef = useRef('') // combo key of currently shown webviews

  // Keep refs in sync
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])
  useEffect(() => { activeViewRef.current = activeView }, [activeView])

  const getComboKey = useCallback((view: typeof activeView) => {
    return view ? `${view.account.id}:${view.platformKey}` : ''
  }, [])

  // Persist current combo state to ref (call before switching combos)
  const saveComboState = useCallback(() => {
    const key = activeViewKeyRef.current
    if (!key) return
    comboStateRef.current.set(key, {
      tabs: [...tabsRef.current],
      activeTabId: activeTabIdRef.current,
    })
  }, [])

  // Swap to a combo: save current state, load target state
  const swapCombo = useCallback((newView: typeof activeView) => {
    saveComboState()
    const newKey = getComboKey(newView)
    activeViewKeyRef.current = newKey
    let saved = comboStateRef.current.get(newKey)
    if (!saved || saved.tabs.length === 0) {
      // First visit: create initial tab
      const initId = `xhs-${++tabCounter}`
      saved = { tabs: [{ id: initId, url: newView!.url, title: newView!.label }], activeTabId: initId }
      comboStateRef.current.set(newKey, saved)
    }
    setTabs(saved.tabs)
    setActiveTabId(saved.activeTabId)
    setCtxTab(null)
    setCtxPos(null)
  }, [saveComboState, getComboKey])

  // Helper: update tabs and persist to combo ref
  const updateTabs = useCallback((updater: (prev: Tab[]) => Tab[]) => {
    setTabs(prev => {
      const next = updater(prev)
      comboStateRef.current.set(activeViewKeyRef.current, {
        tabs: next,
        activeTabId: activeTabIdRef.current,
      })
      return next
    })
  }, [])

  // Helper: update activeTabId and persist to combo ref
  const updateActiveTabId = useCallback((id: string) => {
    setActiveTabId(id)
    comboStateRef.current.set(activeViewKeyRef.current, {
      tabs: tabsRef.current,
      activeTabId: id,
    })
  }, [])

  // Load persisted accounts
  useEffect(() => {
    (async () => {
      const saved = await window.electronAPI?.getStore(STORE_KEY)
      if (Array.isArray(saved) && saved.length > 0) {
        const migrated = (saved as AccountConfig[]).map(a => ({
          ...a,
          loggedIn: a.loggedIn ?? false,
          lastLogin: a.lastLogin ?? 0,
          lastActive: a.lastActive ?? 0,
        }))
        setAccounts(migrated)
      }
      setLoaded(true)
    })()
  }, [])

  // Listen for cross-subdomain popup requests from main process
  useEffect(() => {
    const unsub = window.electronAPI?.onXhsNewTab((data) => {
      const newId = `xhs-${++tabCounter}`
      updateTabs(prev => [...prev, { id: newId, url: data.url, title: '加载中...' }])
      updateActiveTabId(newId)
    })
    return () => { unsub?.() }
  }, [updateTabs, updateActiveTabId])

  const saveStore = useCallback(async (list: AccountConfig[]) => {
    if (window.electronAPI) await window.electronAPI.setStore(STORE_KEY, list)
  }, [])

  const createWebview = useCallback((tabId: string, tabUrl: string) => {
    const acc = activeViewRef.current
    const accountId = acc?.account.id || ''
    const wv = document.createElement('webview') as unknown as WebviewElement
    wv.setAttribute('src', tabUrl)
    wv.setAttribute('partition', `persist:${accountId}`)
    wv.setAttribute('allowpopups', '')
    Object.assign(wv.style, {
      width: '100%', height: '100%', border: 'none',
      position: 'absolute', top: '0', left: '0',
    })

    let recentUrls: string[] = []

    wv.addEventListener('page-title-updated', (e: any) => {
      if (e.title) {
        updateTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: e.title } : t))
      }
    })

    wv.addEventListener('will-navigate', ((e: any) => {
      const url = e.url || ''
      if (!url.startsWith('http')) return
      recentUrls.push(url)
      if (recentUrls.length > 6) recentUrls.shift()
      const normalizedUrl = url.split('?')[0].split('#')[0]
      const matchCount = recentUrls.filter(u => u.split('?')[0].split('#')[0] === normalizedUrl).length
      if (matchCount >= 3) {
        e.preventDefault()
        recentUrls = []
        try {
          ;(wv as any).executeJavaScript(`
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1a1a2e;color:#eee;flex-direction:column;gap:16px">' +
              '<h2 style="margin:0;color:#ff8a65">登录状态异常</h2>' +
              '<p style="margin:0;color:#aaa;font-size:14px">检测到登录重定向循环，已自动停止。</p>' +
              '<p style="margin:0;color:#888;font-size:13px">请点击下方按钮重新加载页面后再次扫码登录。</p>' +
              '<button onclick="location.reload()" style="padding:8px 24px;border-radius:8px;border:1px solid #555;background:#2a2a3e;color:#fff;cursor:pointer;font-size:14px">重新加载</button>' +
              '</div>'
          `)
        } catch {}
        return
      }
    }) as EventListener)

    wv.addEventListener('did-finish-load', () => {
      if (onUrlChange) {
        const url = (wv as any).getURL?.() || tabUrl
        try {
          ;(wv as any).executeJavaScript('document.body?document.body.innerText:document.documentElement.innerText').then((content: string) => {
            const trimmed = content?.slice(0, 8000) || ''
            onUrlChange(url, trimmed ? `页面内容（前8000字符）:\n${trimmed}` : undefined)
          }).catch(() => {
            onUrlChange(url)
          })
        } catch {
          onUrlChange(url)
        }
      }
      try {
        ;(wv as any).executeJavaScript(`
          document.addEventListener('click',function(e){
            var a=e.target.closest('a');
            if(a&&a.target==='_blank'&&a.href){
              e.preventDefault();e.stopPropagation();
              window.location.href=a.href;
            }
          },true);
        `)
      } catch (_) { /* ignore */ }
    })

    wv.addEventListener('did-navigate-in-page', ((e: any) => {
      if (onUrlChange && e.url) {
        setTimeout(() => {
          try {
            ;(wv as any).executeJavaScript('document.body?document.body.innerText:document.documentElement.innerText').then((content: string) => {
              const trimmed = content?.slice(0, 8000) || ''
              onUrlChange(e.url, trimmed ? `页面内容（前8000字符）:\n${trimmed}` : undefined)
            }).catch(() => {
              onUrlChange(e.url)
            })
          } catch {
            onUrlChange(e.url)
          }
        }, 1200)
      }
    }) as EventListener)

    return wv
  }, [onUrlChange, updateTabs])

  // Show/hide webviews based on current active tab
  const wvMap = useRef<Map<string, WebviewElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Hide all webviews when page is not visible (Electron webview ignores parent CSS)
    if (!visible) {
      wvMap.current.forEach(w => {
        if (container.contains(w)) w.style.display = 'none'
      })
      return
    }

    if (!activeView) return

    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) return

    let wv = wvMap.current.get(tab.id)
    if (!wv) {
      wv = createWebview(tab.id, tab.url)
      wvMap.current.set(tab.id, wv)
    }

    if (!container.contains(wv)) {
      container.appendChild(wv)
    }
    wvMap.current.forEach((w, id) => {
      if (container.contains(w)) {
        (w.style as any).display = id === tab.id ? '' : 'none'
      }
    })
  }, [visible, activeTabId, tabs, activeView, createWebview])

  // Cleanup all webviews on unmount
  useEffect(() => {
    return () => {
      wvMap.current.forEach(w => w.remove())
      wvMap.current.clear()
    }
  }, [])

  // ── Tab / Navigation Handlers ──
  const handleClose = (id: string) => {
    if (tabs.length <= 1) return
    const idx = tabs.findIndex(t => t.id === id)
    const next = tabs.filter(t => t.id !== id)
    updateTabs(() => next)
    updateActiveTabId(activeTabId === id ? next[Math.min(idx, next.length - 1)].id : activeTabId)
    const wv = wvMap.current.get(id)
    if (wv) { wv.remove(); wvMap.current.delete(id) }
  }

  const handleRefresh = () => {
    const wv = wvMap.current.get(activeTabId)
    if (wv) (wv as any).reload?.()
  }

  const handleGoBack = () => {
    const wv = wvMap.current.get(activeTabId)
    if (wv) (wv as any).goBack?.()
  }

  const handleGoForward = () => {
    const wv = wvMap.current.get(activeTabId)
    if (wv) (wv as any).goForward?.()
  }

  const handleTabContext = (e: React.MouseEvent, tab: Tab) => {
    e.preventDefault()
    setCtxTab(tab)
    setCtxPos({ x: e.clientX, y: e.clientY })
  }

  const closeCtx = () => { setCtxTab(null); setCtxPos(null) }

  const handleCopyUrl = () => {
    if (!ctxTab) return
    const wv = wvMap.current.get(ctxTab.id)
    const url = wv ? ((wv as any).getURL?.() || wv.src) : ctxTab.url
    navigator.clipboard.writeText(url).catch(() => {})
    closeCtx()
  }

  const handleOpenExternal = () => {
    if (ctxTab) {
      if (window.electronAPI) window.electronAPI.openExternal(ctxTab.url)
      else window.open(ctxTab.url, '_blank')
    }
    closeCtx()
  }

  // ── Account Management ──
  const renameAccount = async (id: string, name: string) => {
    const updated = accounts.map(a => a.id === id ? { ...a, name } : a)
    setAccounts(updated)
    saveStore(updated)
    setEditingId(null)
  }

  const deleteAccount = async (id: string) => {
    const updated = accounts.filter(a => a.id !== id)
    setAccounts(updated)
    saveStore(updated)
    if (activeView?.account.id === id) setActiveView(null)
  }

  const addAccount = async () => {
    const idx = accounts.length
    const newAcc: AccountConfig = {
      id: `xhs_account_${Date.now()}`,
      name: `小红书·账号${idx + 1}`,
      color: genColor(idx),
      loggedIn: false,
      lastLogin: 0,
      lastActive: 0,
    }
    const updated = [...accounts, newAcc]
    setAccounts(updated)
    saveStore(updated)
    setManageMode(true)
    setEditingId(newAcc.id)
    setEditName(newAcc.name)
  }

  const toggleLogin = async (id: string) => {
    const now = Date.now()
    const updated = accounts.map(a => {
      if (a.id !== id) return a
      const newLoggedIn = !a.loggedIn
      return {
        ...a,
        loggedIn: newLoggedIn,
        lastLogin: newLoggedIn ? now : a.lastLogin,
        lastActive: newLoggedIn ? now : a.lastActive,
      }
    })
    setAccounts(updated)
    saveStore(updated)
  }

  // ── Sidebar Selection ──
  const handleSelectPlatform = (platformKey: string, accountId: string) => {
    if (manageMode) {
      const acc = accounts.find(a => a.id === accountId)
      if (acc) { setEditingId(accountId); setEditName(acc.name) }
      return
    }
    const acc = accounts.find(a => a.id === accountId)
    const plat = PLATFORMS.find(p => p.key === platformKey)
    if (!acc || !plat) return
    // Update lastActive
    const updated = accounts.map(a => a.id === acc.id ? { ...a, lastActive: Date.now() } : a)
    setAccounts(updated)
    saveStore(updated)
    // Swap combo: saves old tabs, restores (or creates) new tabs
    setActiveView({ account: acc, platformKey, url: plat.url, label: plat.label })
    swapCombo({ account: acc, platformKey, url: plat.url, label: plat.label })
  }

  const toggleCategory = (catKey: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (next.has(catKey)) next.delete(catKey)
      else next.add(catKey)
      return next
    })
  }

  if (!loaded) return null

  return (
    <div className="xhs-panel" style={{ display: visible ? '' : 'none' }}>
      {/* ===== Secondary Sidebar ===== */}
      <div className="xhs-sidebar">
        <div className="xhs-sidebar-logo">
          <div className="xhs-sidebar-logo-icon">📕</div>
          <span className="xhs-sidebar-logo-text">工作台</span>
          <span className="xhs-sidebar-logo-badge">{accounts.length}账号</span>
        </div>

        {PLATFORMS.map(plat => {
          const isCollapsed = collapsedCats.has(plat.key)
          return (
            <div key={plat.key}>
              <div className="xhs-sidebar-section" onClick={() => toggleCategory(plat.key)}>
                <span>{plat.emoji} {plat.label}</span>
                <ChevronDown size={10} className={`xhs-sidebar-chevron ${isCollapsed ? 'collapsed' : ''}`} />
              </div>
              {!isCollapsed && (
                <div className="xhs-sidebar-nav">
                  {accounts.map(acc => {
                    const isActive = activeView?.account.id === acc.id && activeView?.platformKey === plat.key
                    const isEditing = editingId === acc.id
                    return isEditing ? (
                      <div key={acc.id} className="xhs-sidebar-item active" style={{ padding: '4px 10px' }}>
                        <span className={`xhs-account-dot ${acc.loggedIn ? 'online' : 'offline'}`} />
                        <input
                          className="xhs-rename-input"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renameAccount(acc.id, editName) }}
                          onBlur={() => renameAccount(acc.id, editName)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                        <span className="xhs-action-icons">
                          <span onClick={e => { e.stopPropagation(); renameAccount(acc.id, editName) }} title="确认"><Check size={12} /></span>
                          <span onClick={e => { e.stopPropagation(); setEditingId(null) }} title="取消"><X size={12} /></span>
                        </span>
                      </div>
                    ) : (
                      <div
                        key={acc.id}
                        className={`xhs-sidebar-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleSelectPlatform(plat.key, acc.id)}
                      >
                        <span
                          className={`xhs-account-dot ${acc.loggedIn ? 'online' : 'offline'}`}
                          onClick={e => { e.stopPropagation(); toggleLogin(acc.id) }}
                          title={acc.loggedIn ? '已登录 (点击切换)' : '未登录 (点击切换)'}
                        />
                        <span className="xhs-account-name">{acc.name}</span>
                        {manageMode && (
                          <span className="xhs-action-icons">
                            <span onClick={e => { e.stopPropagation(); setEditingId(acc.id); setEditName(acc.name) }} title="重命名"><Edit3 size={10} /></span>
                            <span onClick={e => { e.stopPropagation(); deleteAccount(acc.id) }} title="删除"><Trash2 size={10} /></span>
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Sidebar Footer */}
        <div className="xhs-sidebar-footer">
          <button
            className={`xhs-manage-btn ${manageMode ? 'active' : ''}`}
            onClick={() => { setManageMode(!manageMode); setEditingId(null) }}
          >
            <Settings size={11} /> {manageMode ? '完成管理' : '管理账号'}
          </button>
          <button className="xhs-manage-btn" onClick={addAccount}>
            <Plus size={11} /> 添加账号
          </button>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="xhs-main">
        {activeView ? (
          <>
            {/* Tab Bar */}
            <div className="xhs-tabbar">
              <span className="xhs-tabbar-account" style={{ color: activeView.account.color }}>
                <span className={`xhs-account-dot ${activeView.account.loggedIn ? 'online' : 'offline'}`} style={{ position: 'static', display: 'inline-block' }} />
                {activeView.account.name}
              </span>
              <div className="xhs-tabbar-nav">
                <div className="xhs-tabbar-nav-btn" onClick={handleGoBack} title="后退"><ArrowLeft size={13} /></div>
                <div className="xhs-tabbar-nav-btn" onClick={handleGoForward} title="前进"><ArrowRight size={13} /></div>
              </div>
              <div className="xhs-tabs">
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`xhs-tab ${tab.id === activeTabId ? 'active' : ''}`}
                    onClick={() => updateActiveTabId(tab.id)}
                    onContextMenu={e => handleTabContext(e, tab)}
                  >
                    <span className="xhs-tab-title">{tab.title}</span>
                    {tabs.length > 1 && (
                      <span className="xhs-tab-close" onClick={e => { e.stopPropagation(); handleClose(tab.id) }}>×</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="xhs-refresh-btn" onClick={handleRefresh}><RefreshCw size={11} /> 刷新</div>
            </div>

            {/* WebView Container */}
            <div ref={containerRef} className="xhs-webview-container" />

            {/* Context Menu */}
            {ctxTab && ctxPos && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={closeCtx} onContextMenu={e => { e.preventDefault(); closeCtx() }}>
                <div style={{
                  position: 'absolute', left: ctxPos.x, top: ctxPos.y,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: 4, minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <div className="webview-ctx-item" onClick={handleCopyUrl}><Copy size={12} /> 复制网址</div>
                  <div className="webview-ctx-item" onClick={handleOpenExternal}><ExternalLink size={12} /> 在浏览器中打开</div>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '2px 8px' }} />
                  <div className="webview-ctx-item" onClick={() => { handleClose(ctxTab.id); closeCtx() }}>关闭标签</div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="xhs-empty">
            <div className="xhs-empty-icon">📕</div>
            <div className="xhs-empty-text">选择左侧账号开始操作</div>
            <div className="xhs-empty-hint">点击账号 → 平台组合，直接进入对应网页</div>
          </div>
        )}
      </div>
    </div>
  )
}
