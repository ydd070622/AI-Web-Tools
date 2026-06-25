/**
 * WeChat ClawBot iLink API — 腾讯官方 AI Agent 微信接口
 *
 * API Base: https://ilinkai.weixin.qq.com
 * bot_type: 3 (Claude Code)
 *
 * 参考: https://github.com/m1heng/claude-plugin-weixin
 */
import { ipcMain, BrowserWindow } from 'electron'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import * as crypto from 'crypto'

interface BotSession {
  token: string
  baseUrl: string
  ilinkBotId: string
  ilinkUserId: string
}

interface WxMessage {
  userId: string
  text: string
  contextToken: string
  clientId: string
  msgId: string
  timestamp: number
}

const DEFAULT_BASE = 'https://ilinkai.weixin.qq.com'
let session: BotSession | null = null
let polling = false
let getUpdatesBuf = ''
let reconnectAttempts = 0
let lastWxMsg: { userId: string; contextToken: string } | null = null
const messageListeners: Array<(msg: WxMessage) => void> = []
const sessionPath = path.join(app.getPath('userData'), 'wx-clawbot-session.json')

function randomWechatUin(): string {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(crypto.randomBytes(4).readUInt32BE(0))
  return buf.toString('base64')
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'AuthorizationType': 'ilink_bot_token',
    'Authorization': `Bearer ${token}`,
    'X-WECHAT-UIN': randomWechatUin(),
  }
}

function apiGet(endpoint: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, DEFAULT_BASE)
    https.get({
      hostname: url.hostname, port: 443, path: url.pathname + url.search,
      headers: { 'Accept': 'application/json' },
      timeout: 40000,
    }, (res) => {
      let raw = ''
      res.on('data', (c: Buffer) => { raw += c.toString() })
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve({ _raw: raw }) } })
    }).on('error', reject)
  })
}

function apiPost(endpoint: string, body: Record<string, unknown>, token: string, timeoutMs = 35000): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, DEFAULT_BASE)
    const data = JSON.stringify(body)
    const headers = { ...buildHeaders(token), 'Content-Length': Buffer.byteLength(data).toString() }
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname + url.search,
      method: 'POST', headers, timeout: timeoutMs,
    }, (res) => {
      let raw = ''
      res.on('data', (c: Buffer) => { raw += c.toString() })
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve({ _raw: raw }) } })
    })
    req.on('error', (e) => reject(e))
    req.on('timeout', () => { req.destroy(); resolve({ ret: 0, msgs: [], get_updates_buf: getUpdatesBuf }) })
    req.write(data)
    req.end()
  })
}

function saveSession() {
  if (session) fs.writeFileSync(sessionPath, JSON.stringify(session), 'utf-8')
}
function loadSession(): BotSession | null {
  try { if (fs.existsSync(sessionPath)) return JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) } catch {}
  return null
}
function notifyRenderer(channel: string, data: any) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, data)
}

// ===== 1. 获取二维码 =====
async function getQRCode(): Promise<{ qrcodeId: string; qrImageUrl?: string } | { error: string }> {
  try {
    const resp = await apiGet('/ilink/bot/get_bot_qrcode?bot_type=3')
    if (resp.qrcode) {
      return { qrcodeId: resp.qrcode, qrImageUrl: resp.qrcode_img_content || resp.qrcode_url }
    }
    return { error: resp.err_msg || '获取二维码失败' }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ===== 2. 轮询扫码状态 =====
async function pollQR(qrcode: string): Promise<'wait' | 'scaned' | 'confirmed' | 'expired' | 'error'> {
  try {
    const resp = await apiGet(`/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`)
    const status = resp.status
    if (status === 'confirmed') {
      session = {
        token: resp.bot_token || resp.token,
        baseUrl: resp.baseurl || DEFAULT_BASE,
        ilinkBotId: resp.ilink_bot_id || '',
        ilinkUserId: resp.ilink_user_id || '',
      }
      saveSession()
      notifyRenderer('wx-bot-status', { status: 'connected', botId: session.ilinkBotId })
      startPolling()
      return 'confirmed'
    }
    if (status === 'scaned') return 'scaned'
    if (status === 'expired') return 'expired'
    return 'wait'
  } catch { return 'error' }
}

// ===== 3. 长轮询收消息 =====
async function pollMessages(): Promise<void> {
  if (!session || !polling) return
  try {
    const resp = await apiPost('ilink/bot/getupdates', { get_updates_buf: getUpdatesBuf, base_info: { channel_version: '0.1.0' } }, session.token)
    if (resp.get_updates_buf) getUpdatesBuf = resp.get_updates_buf
    const msgs = resp.msgs || []
    for (const msg of msgs) {
      if (msg.message_type !== 1) continue
      const text = msg.item_list?.find((i: any) => i.type === 1)?.text_item?.text
      if (!text) continue
      const wxMsg: WxMessage = {
        userId: msg.from_user_id,
        text,
        contextToken: msg.context_token || '',
        clientId: msg.client_id || '',
        msgId: msg.msg_id || '',
        timestamp: msg.create_time_ms || Date.now(),
      }
      lastWxMsg = { userId: wxMsg.userId, contextToken: wxMsg.contextToken }
      for (const l of messageListeners) { try { l(wxMsg) } catch {} }
      notifyRenderer('wx-bot-message', wxMsg)
    }
    reconnectAttempts = 0
  } catch {
    reconnectAttempts++
    if (reconnectAttempts > 5) {
      notifyRenderer('wx-bot-status', { status: 'disconnected', reason: '连接断开' })
      stopPolling()
      return
    }
  }
  if (polling) setTimeout(pollMessages, 500)
}
function startPolling() { polling = true; reconnectAttempts = 0; pollMessages() }
function stopPolling() { polling = false }

// ===== 4. 发送消息 =====
async function sendMessage(userId: string, text: string, contextToken: string): Promise<{ ok: boolean; error?: string }> {
  if (!session) return { ok: false, error: '未登录' }
  try {
    const resp = await apiPost('ilink/bot/sendmessage', {
      msg: {
        from_user_id: '',
        to_user_id: userId,
        client_id: `lingworks-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        message_type: 2,
        message_state: 2,
        item_list: [{ type: 1, text_item: { text } }],
        context_token: contextToken,
      },
      base_info: { channel_version: '0.1.0' },
    }, session.token, 15000)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

// ===== IPC Registration =====
export function registerWeChatBot() {
  const saved = loadSession()
  if (saved) { session = saved; startPolling(); notifyRenderer('wx-bot-status', { status: 'connected' }) }

  ipcMain.handle('wx-bot-get-qrcode', async () => await getQRCode())
  ipcMain.handle('wx-bot-check-qr', async (_e, qrcode: string) => await pollQR(qrcode))
  ipcMain.handle('wx-bot-send', async (_e, userId: string, text: string, ctxToken: string) => await sendMessage(userId, text, ctxToken))
  ipcMain.handle('wx-bot-status', () => ({ connected: !!session, botId: session?.ilinkBotId || '' }))
  ipcMain.handle('wx-bot-push-self', async (_e, text: string) => {
    if (!session) return { ok: false, error: 'ClawBot 未连接' }
    if (!lastWxMsg) return { ok: false, error: '尚未收到微信消息，无法获取 context_token。请先在微信上发送一条消息。' }
    return await sendMessage(lastWxMsg.userId, text, lastWxMsg.contextToken)
  })
  ipcMain.handle('wx-bot-logout', () => {
    stopPolling(); session = null; getUpdatesBuf = ''
    try { fs.unlinkSync(sessionPath) } catch {}
    notifyRenderer('wx-bot-status', { status: 'disconnected' })
    return { ok: true }
  })
}

export function onWeChatMessage(fn: (msg: WxMessage) => void) {
  messageListeners.push(fn)
  return () => { const i = messageListeners.indexOf(fn); if (i >= 0) messageListeners.splice(i, 1) }
}