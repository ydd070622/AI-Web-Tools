import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { MessageCircle, RefreshCw, Check, Loader2, LogOut } from 'lucide-react'

interface WxMessage {
  userId: string; text: string; contextToken: string; clientId: string; msgId: string; timestamp: number
}

export default function WeChatConnect() {
  const [connected, setConnected] = useState(false)
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'wait' | 'scaned' | 'confirmed' | 'expired' | 'error'>('idle')
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [qrId, setQrId] = useState('')
  const [messages, setMessages] = useState<WxMessage[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Check existing connection
    (async () => {
      const st = await window.electronAPI?.wxBotStatus?.()
      if (st?.connected) setConnected(true)
    })()

    // Listen for status changes
    const unsub1 = window.electronAPI?.wxBotOnStatus?.((data: any) => {
      if (data.status === 'connected') {
        setConnected(true)
        setQrStatus('confirmed')
        toast.success('微信已连接')
      } else if (data.status === 'disconnected') {
        setConnected(false)
        setQrStatus('idle')
      }
    })

    // Listen for incoming messages
    const unsub2 = window.electronAPI?.wxBotOnMessage?.((msg: WxMessage) => {
      setMessages(prev => [msg, ...prev].slice(0, 20))
    })

    return () => { unsub1?.(); unsub2?.() }
  }, [])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const startLogin = async () => {
    setQrStatus('loading')
    setErrorMsg('')
    const result = await window.electronAPI?.wxBotGetQRCode?.()
    if (result?.error) {
      setQrStatus('error')
      setErrorMsg(result.error)
      return
    }
    // Generate QR image from the URL using free API
    const qrUrl = result.qrImageUrl
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}`
    setQrImageUrl(qrImg)
    setQrId(result.qrcodeId)
    setQrStatus('wait')

    pollRef.current = setInterval(async () => {
      const status = await window.electronAPI?.wxBotCheckQR?.(result.qrcodeId)
      if (status === 'confirmed') {
        clearInterval(pollRef.current!)
      } else if (status === 'scaned') {
        setQrStatus('scaned')
      } else if (status === 'expired') {
        clearInterval(pollRef.current!)
        setQrStatus('expired')
      } else if (status === 'error') {
        setQrStatus('error')
      }
    }, 2000)
  }

  const handleLogout = async () => {
    await window.electronAPI?.wxBotLogout?.()
    setConnected(false)
    setMessages([])
    toast.success('已断开微信')
  }

  return (
    <div className="wx-connect-panel">
      <div className="wx-connect-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageCircle size={20} style={{ color: '#07C160' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>微信连接</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {connected ? '已连接 · 微信可收发消息' : '扫码连接微信 ClawBot'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={`wx-status-dot ${connected ? 'online' : 'offline'}`} />
          <span style={{ fontSize: 11, color: connected ? '#07C160' : 'var(--text-muted)' }}>
            {connected ? '在线' : '离线'}
          </span>
          {connected && (
            <button className="crm-btn-ghost crm-btn-danger" onClick={handleLogout} style={{ marginLeft: 4 }}>
              <LogOut size={12} /> 断开
            </button>
          )}
        </div>
      </div>

      {!connected && (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>

          {/* QR Code Area */}
          {qrStatus === 'idle' && (
            <>
              <MessageCircle size={48} style={{ color: '#07C160', opacity: 0.6 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>连接微信 ClawBot</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  扫码后可通过微信向智能体发送指令
                </div>
              </div>
              <button className="crm-btn-primary" onClick={startLogin} style={{ width: '100%' }}>
                <MessageCircle size={14} /> 获取二维码
              </button>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                需要微信 iOS 最新版，ClawBot 功能已灰度开放
              </div>
            </>
          )}

          {qrStatus === 'loading' && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Loader2 size={32} className="spin" />
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>获取二维码中...</div>
            </div>
          )}

          {(qrStatus === 'wait' || qrStatus === 'scaned') && (
            <>
              {qrImageUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={qrImageUrl} alt="微信扫码" style={{ width: 200, height: 200, borderRadius: 8 }} />
                  {qrStatus === 'scaned' && (
                    <div className="wx-qr-scanned-overlay">
                      <Check size={40} style={{ color: '#07C160' }} />
                      <span>请在手机上确认</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  width: 200, height: 200, borderRadius: 8,
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <MessageCircle size={32} style={{ color: '#07C160' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {qrStatus === 'scaned' ? '已扫码，请确认' : '请用微信扫一扫'}
                  </span>
                </div>
              )}
            </>
          )}

          {(qrStatus === 'expired' || qrStatus === 'error') && (
            <>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                {qrStatus === 'expired' ? '二维码已过期' : `获取失败: ${errorMsg}`}
              </div>
              <button className="crm-btn-primary" onClick={startLogin} style={{ width: '100%' }}>
                <RefreshCw size={14} /> 重新获取
              </button>
            </>
          )}
        </div>
      )}

      {/* Connected: message area */}
      {connected && (
        <div style={{ padding: '12px 16px', maxHeight: 200, overflowY: 'auto' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>
              等待消息...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.slice(0, 8).map((msg, i) => (
                <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: '#07C160', fontWeight: 600, marginBottom: 2 }}>{msg.userId}</div>
                  <div style={{ fontSize: 12 }}>{msg.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
