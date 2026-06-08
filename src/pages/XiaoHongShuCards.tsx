import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, User, Plus, Trash2, Edit3, Check, X, Settings, RefreshCw, ArrowLeft as ArrowLeftIcon, ArrowRight, Copy, ExternalLink } from 'lucide-react'

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
}

interface Tab {
  id: string
  url: string
  title: string
}

const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#a29bfe', '#55efc4', '#fd79a8', '#fdcb6e', '#74b9ff']
const STORE_KEY = 'xhs_accounts'
const MAIN_URL = 'https://www.xiaohongshu.com'
const AD_URL = 'https://ad.xiaohongshu.com'

function genColor(i: number) { return COLORS[i % COLORS.length] }

function defaultAccounts(): AccountConfig[] {
  return [
    { id: 'xhs_account_1', name: '小红书·账号一', color: genColor(0) },
    { id: 'xhs_account_2', name: '小红书·账号二', color: genColor(1) },
    { id: 'xhs_account_3', name: '小红书·账号三', color: genColor(2) },
  ]
}

let tabCounter = 0

export default function XiaoHongShuCards() {
  const [accounts, setAccounts] = useState<AccountConfig[]>(defaultAccounts())
  const [loaded, setLoaded] = useState(false)
  const [manageMode, setManageMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [activeView, setActiveView] = useState<{ account: AccountConfig; url: string; label: string } | null>(null)

  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState('')
  const [ctxTab, setCtxTab] = useState<Tab | null>(null)
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null)
  const wvMap = useRef<Map<string, WebviewElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef(activeView)

  useEffect(() => { accountRef.current = activeView }, [activeView])

  useEffect(() => {
    (async () => {
      const saved = await window.electronAPI?.getStore(STORE_KEY)
      if (Array.isArray(saved) && saved.length > 0) {
        setAccounts(saved as AccountConfig[])
      }
      setLoaded(true)
    })()
  }, [])

  // Init tabs when entering a view
  useEffect(() => {
    if (!activeView) return
    const initId = `xhs-${++tabCounter}`
    setTabs([{ id: initId, url: activeView.url, title: activeView.label }])
    setActiveTabId(initId)
    setCtxTab(null)
    setCtxPos(null)
  }, [activeView?.account.id, activeView?.url])

  const saveStore = useCallback(async (list: AccountConfig[]) => {
    if (window.electronAPI) await window.electronAPI.setStore(STORE_KEY, list)
  }, [])

  const createWebview = useCallback((tabId: string, tabUrl: string) => {
    const acc = accountRef.current
    const accountId = acc?.account.id || ''
    const wv = document.createElement('webview') as unknown as WebviewElement
    wv.setAttribute('src', tabUrl)
    wv.setAttribute('partition', `persist:${accountId}`)
    wv.setAttribute('disablewebsecurity', '')
    wv.setAttribute('allowpopups', '')
    Object.assign(wv.style, {
      width: '100%', height: '100%', border: 'none',
      position: 'absolute', top: '0', left: '0',
    })

    wv.addEventListener('page-title-updated', (e: any) => {
      if (e.title) {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: e.title } : t))
      }
    })

    wv.addEventListener('did-finish-load', () => {
      ;(wv as any).executeJavaScript(`
        Object.defineProperty(navigator,'webdriver',{get:function(){return false}});
        window.open=function(u){if(u)window.location.href=u;return null};
        document.addEventListener('click',function(e){
          var a=e.target.closest('a');
          if(a&&a.target==='_blank'&&a.href){
            e.preventDefault();e.stopPropagation();
            window.location.href=a.href;
          }
        },true);
      `)
    })

    return wv
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !activeView) return

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
  }, [activeTabId, tabs, activeView, createWebview])

  useEffect(() => {
    return () => {
      wvMap.current.forEach(w => w.remove())
      wvMap.current.clear()
    }
  }, [])

  const handleClose = (id: string) => {
    if (tabs.length <= 1) return
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      setActiveTabId(activeTabId === id ? next[Math.min(idx, next.length - 1)].id : activeTabId)
      return next
    })
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
  }

  const addAccount = async () => {
    const idx = accounts.length
    const newAcc: AccountConfig = {
      id: `xhs_account_${Date.now()}`,
      name: `小红书·账号${idx + 1}`,
      color: genColor(idx),
    }
    const updated = [...accounts, newAcc]
    setAccounts(updated)
    saveStore(updated)
  }

  if (!loaded) return null

  if (activeView) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setActiveView(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <ArrowLeft size={13} /> 返回
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: activeView.account.color, flexShrink: 0, whiteSpace: 'nowrap' }}>{activeView.account.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>· {activeView.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <div style={{ padding: '3px 5px', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              onClick={handleGoBack} title="后退"><ArrowLeftIcon size={13} /></div>
            <div style={{ padding: '3px 5px', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              onClick={handleGoForward} title="前进"><ArrowRight size={13} /></div>
            <div style={{ padding: '3px 5px', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              onClick={handleRefresh} title="刷新"><RefreshCw size={13} /></div>
          </div>
          <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0, overflow: 'hidden', alignItems: 'center' }}>
            {tabs.map(tab => (
              <div
                key={tab.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 10px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 11, whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0, maxWidth: 160,
                  background: tab.id === activeTabId ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: tab.id === activeTabId ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
                onClick={() => setActiveTabId(tab.id)}
                onContextMenu={e => handleTabContext(e, tab)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
                {tabs.length > 1 && (
                  <span style={{ opacity: 0.5, fontSize: 14, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); handleClose(tab.id) }}>×</span>
                )}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0, whiteSpace: 'nowrap' }}>cookie 隔离</span>
        </div>
        <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />
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
      </div>
    )
  }

  const cols = Math.min(accounts.length, 4)
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    borderRadius: 16,
    border: '1px solid var(--border-color)',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    transition: 'all 0.2s',
    width: cols <= 2 ? 280 : undefined,
    flex: cols > 2 ? 1 : undefined,
  }

  return (
    <div style={{ height: '100%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 1100, width: '100%', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>小红书聚光</h1>
          <button
            onClick={() => setManageMode(!manageMode)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 6,
              background: manageMode ? 'var(--accent)' : 'transparent',
              color: manageMode ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${manageMode ? 'var(--accent)' : 'var(--border-color)'}`,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            <Settings size={13} /> {manageMode ? '完成' : '管理'}
          </button>
        </div>
        {manageMode && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <button
              onClick={addAccount}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 16px', borderRadius: 8,
                background: 'var(--accent)', color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> 添加账号
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 20, width: '100%', flexWrap: 'wrap', justifyContent: 'center' }}>
          {accounts.map(acc => {
            const isEditing = editingId === acc.id
            return (
              <div key={acc.id} style={cardStyle}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: `${acc.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <User size={24} color={acc.color} />
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameAccount(acc.id, editName) }}
                      style={{
                        width: 120, padding: '2px 6px', borderRadius: 4,
                        border: '1px solid var(--accent)', background: 'var(--bg-primary)',
                        color: 'var(--text-primary)', fontSize: 13, textAlign: 'center', outline: 'none',
                      }}
                      autoFocus
                    />
                    <Check size={14} style={{ cursor: 'pointer', color: '#22c55e' }}
                      onClick={() => renameAccount(acc.id, editName)} />
                    <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                      onClick={() => setEditingId(null)} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{acc.name}</span>
                    {manageMode && (
                      <>
                        <Edit3 size={12} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                          onClick={() => { setEditingId(acc.id); setEditName(acc.name) }} />
                        <Trash2 size={12} style={{ cursor: 'pointer', color: '#ef4444' }}
                          onClick={() => deleteAccount(acc.id)} />
                      </>
                    )}
                  </div>
                )}

                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>独立 session</span>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setActiveView({ account: acc, url: MAIN_URL, label: '小红书' })}
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      background: acc.color, color: '#fff', border: 'none',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    小红书
                  </button>
                  <button
                    onClick={() => setActiveView({ account: acc, url: AD_URL, label: '聚光平台' })}
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      background: 'transparent', color: acc.color,
                      border: `1px solid ${acc.color}`, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    聚光平台
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          每个账号独立 cookie 隔离，小红书与聚光平台共享同一登录态
        </p>
      </div>
    </div>
  )
}
