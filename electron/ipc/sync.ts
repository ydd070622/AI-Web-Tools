/**
 * GitHub Gist Sync — CRM data upload/download via GitHub Gist API
 */
import { ipcMain, app } from 'electron'
import * as https from 'https'
import * as path from 'path'
import * as fs from 'fs'

// Config stored in electron-store (config.json)
async function getStore(key: string): Promise<any> {
  const p = path.join(app.getPath('userData'), 'config.json')
  try {
    if (!fs.existsSync(p)) return null
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
    return data[key] ?? null
  } catch { return null }
}

async function setStore(key: string, value: any): Promise<void> {
  const p = path.join(app.getPath('userData'), 'config.json')
  let data: Record<string, any> = {}
  try {
    if (fs.existsSync(p)) data = JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {}
  data[key] = value
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

function apiRequest(token: string, method: string, endpoint: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`)
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'LingWorks-CRM',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => data += chunk.toString())
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {}
          if (res.statusCode && res.statusCode >= 400) {
            resolve({ error: json.message || `HTTP ${res.statusCode}`, status: res.statusCode })
          } else {
            resolve(json)
          }
        } catch {
          resolve({ error: 'Invalid response', raw: data.slice(0, 200) })
        }
      })
    })
    req.on('error', (e) => reject(e))
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ===== 1. Create a new private gist with CRM data =====
async function createGist(token: string): Promise<{ gistId?: string; htmlUrl?: string; error?: string }> {
  const p = path.join(app.getPath('userData'), 'config.json')
  let crmData = ''
  try {
    if (fs.existsSync(p)) {
      const config = JSON.parse(fs.readFileSync(p, 'utf-8'))
      const crm = config['lingworks_crm_v3']
      if (crm) crmData = JSON.stringify(crm)
    }
  } catch {}

  const body = {
    description: 'LingWorks CRM 数据同步',
    public: false,
    files: {
      'crm-data.json': { content: crmData || '{}' },
    },
  }

  const resp = await apiRequest(token, 'POST', '/gists', body)
  if (resp.error) return { error: resp.error }
  return { gistId: resp.id, htmlUrl: resp.html_url }
}

// ===== 2. Upload CRM data to existing gist =====
async function uploadGist(token: string, gistId: string): Promise<{ ok: boolean; error?: string }> {
  const p = path.join(app.getPath('userData'), 'config.json')
  let crmData = '{}'
  try {
    if (fs.existsSync(p)) {
      const config = JSON.parse(fs.readFileSync(p, 'utf-8'))
      const crm = config['lingworks_crm_v3']
      if (crm) crmData = JSON.stringify(crm)
    }
  } catch {}

  const body = {
    files: {
      'crm-data.json': { content: crmData },
    },
  }

  const resp = await apiRequest(token, 'PATCH', `/gists/${gistId}`, body)
  if (resp.error) return { ok: false, error: resp.error }
  // Store last sync time
  await setStore('syncLastAt', new Date().toISOString())
  return { ok: true }
}

// ===== 3. Download CRM data from gist =====
async function downloadGist(token: string, gistId: string): Promise<{ ok: boolean; error?: string; data?: any }> {
  const resp = await apiRequest(token, 'GET', `/gists/${gistId}`)
  if (resp.error) return { ok: false, error: resp.error }

  const file = resp.files?.['crm-data.json']
  if (!file?.content) return { ok: false, error: 'Gist 中没有 crm-data.json' }

  let data: any
  try {
    data = JSON.parse(file.content)
  } catch {
    return { ok: false, error: 'Gist 数据格式错误' }
  }

  // Write to local config
  try {
    const p = path.join(app.getPath('userData'), 'config.json')
    let config: Record<string, any> = {}
    if (fs.existsSync(p)) {
      config = JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
    config['lingworks_crm_v3'] = data
    fs.writeFileSync(p, JSON.stringify(config, null, 2))
  } catch (e: any) {
    return { ok: false, error: `写入本地失败: ${e.message}` }
  }

  // Store last sync time
  await setStore('syncLastAt', new Date().toISOString())
  return { ok: true, data }
}

// ===== 4. Check gist metadata (last update time, compare) =====
async function statusGist(token: string, gistId: string): Promise<{
  ok: boolean; error?: string; updatedAt?: string; lastSyncAt?: string
}> {
  const resp = await apiRequest(token, 'GET', `/gists/${gistId}`)
  if (resp.error) return { ok: false, error: resp.error }

  const lastSyncAt = await getStore('syncLastAt')
  return {
    ok: true,
    updatedAt: resp.updated_at || '',
    lastSyncAt: lastSyncAt || '',
  }
}

// ===== IPC Registration =====
export function registerSync() {
  ipcMain.handle('sync-create', async (_e, token: string) => {
    const result = await createGist(token)
    if (result.gistId) {
      await setStore('syncGistId', result.gistId)
      await setStore('syncToken', token)
      await setStore('syncLastAt', new Date().toISOString())
    }
    return result
  })

  ipcMain.handle('sync-upload', async (_e) => {
    const token = await getStore('syncToken')
    const gistId = await getStore('syncGistId')
    if (!token || !gistId) return { ok: false, error: '未配置同步。请在设置中填写 GitHub Token 并创建同步。' }
    return await uploadGist(token, gistId)
  })

  ipcMain.handle('sync-download', async (_e) => {
    const token = await getStore('syncToken')
    const gistId = await getStore('syncGistId')
    if (!token || !gistId) return { ok: false, error: '未配置同步。请在设置中填写 GitHub Token 并创建同步。' }
    return await downloadGist(token, gistId)
  })

  ipcMain.handle('sync-status', async () => {
    const token = await getStore('syncToken')
    const gistId = await getStore('syncGistId')
    const lastSyncAt = await getStore('syncLastAt')
    return {
      configured: !!(token && gistId),
      gistId: gistId || '',
      lastSyncAt: lastSyncAt || '',
    }
  })

  ipcMain.handle('sync-connect', async (_e, token: string, gistId: string) => {
    // Validate the gist exists and token works
    const resp = await apiRequest(token, 'GET', `/gists/${gistId}`)
    if (resp.error) return { ok: false, error: resp.error }
    await setStore('syncGistId', gistId)
    await setStore('syncToken', token)
    await setStore('syncLastAt', new Date().toISOString())
    return { ok: true }
  })

  ipcMain.handle('sync-unbind', async () => {
    await setStore('syncToken', null)
    await setStore('syncGistId', null)
    await setStore('syncLastAt', null)
    return { ok: true }
  })
}
