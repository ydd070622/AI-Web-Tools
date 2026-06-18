/**
 * Download IPC — cancel-download handler + webview download management
 */
import { ipcMain, app, BrowserWindow, session, webContents } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

const downloadItems = new Map<string, Electron.DownloadItem>()

// All known site IDs that use persistent partition in webviews
const KNOWN_PARTITIONS = [
  'liblib','runninghub','tapnow','chatgpt','github','gemini',
  'xhs_juguang','duannao','zhisuan','onethingai','skyun','mitce',
]

// Track which sessions already have download handlers
const handledSessions = new WeakSet<Electron.Session>()

/** Pre-register download handlers on all known persistent partitions */
export function registerAllPartitions(mainWindow: BrowserWindow | null) {
  console.log('[download] registerAllPartitions: registering on', KNOWN_PARTITIONS.length, 'partitions')
  for (const pid of KNOWN_PARTITIONS) {
    try {
      const sess = session.fromPartition(`persist:${pid}`)
      attachDownloadHandler(sess, mainWindow)
      console.log('[download] registerAllPartitions: OK persist:' + pid)
    } catch (e: any) {
      console.error('[download] registerAllPartitions: FAIL persist:' + pid, e.message)
    }
  }
}

/** IPC handler: renderer can request download handler registration for a specific webContents */
export function registerWebviewSessionIPC(mainWindow: BrowserWindow | null) {
  ipcMain.handle('register-webview-session', async (_e, wcId: number) => {
    try {
      const wc = webContents.fromId(wcId)
      if (!wc) { console.warn('[download] register-webview-session: webContents not found for id', wcId); return false }
      const sess = wc.session
      if (handledSessions.has(sess)) return true // already registered
      attachDownloadHandler(sess, mainWindow)
      console.log('[download] register-webview-session: OK wcId=' + wcId)
      return true
    } catch (e: any) {
      console.error('[download] register-webview-session: ERROR', e.message)
      return false
    }
  })
}

function getDownloadPath(): string {
  const p = path.join(app.getPath('userData'), 'config.json')
  try {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
      if (data.downloadPath && fs.existsSync(data.downloadPath)) {
        return data.downloadPath
      }
    }
  } catch {}
  return app.getPath('desktop')
}

export function registerDownload(mainWindow: BrowserWindow | null) {
  ipcMain.handle('cancel-download', async (_e, id: string) => {
    const item = downloadItems.get(id)
    if (item) { item.cancel(); downloadItems.delete(id) }
  })

  // Track active downloads across webviews and main window sessions
  const activeDownloads = new Set<string>()
  const trackedSessions = new WeakSet<Electron.Session>()

  const trackSession = (sess: Electron.Session) => {
    if (trackedSessions.has(sess)) return
    trackedSessions.add(sess)
    sess.on('will-download', (_e, item) => {
      const id = `${Date.now()}-${Math.random()}`
      activeDownloads.add(id)
      item.once('done', () => activeDownloads.delete(id))
    })
  }

  // Track main window session
  if (mainWindow) {
    trackSession(mainWindow.webContents.session)
  }

  return { activeDownloads, trackSession }
}

/**
 * Register will-download handler on a given Electron Session.
 * Uses native Electron download (item.setSavePath) for reliability.
 */
function attachDownloadHandler(sess: Electron.Session, mainWindow: BrowserWindow | null) {
  if (handledSessions.has(sess)) return
  handledSessions.add(sess)
  console.log('[download] attachDownloadHandler: registering will-download on session')

  sess.on('will-download', (_event, item) => {
    const name = item.getFilename()
    console.log('[download] will-download FIRED:', name)

    // Dedup: cancel if same filename already downloading
    for (const [, dl] of downloadItems) {
      if (dl.getFilename() === name && dl.getState() === 'progressing') {
        item.cancel()
        return
      }
    }

    // Resolve save path (with dedup)
    const dir = getDownloadPath()
    let filePath = path.join(dir, name)
    let counter = 1
    const ext = path.extname(name)
    const base = path.basename(name, ext)
    while (fs.existsSync(filePath)) {
      filePath = path.join(dir, `${base} (${counter})${ext}`)
      counter++
    }

    item.setSavePath(filePath)

    const dlId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    downloadItems.set(dlId, item)

    mainWindow?.webContents.send('download-started', {
      id: dlId,
      filename: name,
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progress',
    })

    item.on('updated', () => {
      mainWindow?.webContents.send('download-progress', {
        id: dlId,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
      })
    })

    item.on('done', (_event, state) => {
      downloadItems.delete(dlId)
      if (state === 'completed') {
        mainWindow?.webContents.send('download-completed', { id: dlId, filePath })
      } else {
        mainWindow?.webContents.send('download-failed', { id: dlId })
      }
    })
  })
}

/**
 * Attach webview download handling to a webContents.
 * Called from web-contents-created event for webview types.
 */
export function attachWebviewDownloads(mainWindow: BrowserWindow | null) {
  return (contents: Electron.WebContents) => {
    attachDownloadHandler(contents.session, mainWindow)
  }
}
