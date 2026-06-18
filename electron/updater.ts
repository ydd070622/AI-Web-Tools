/**
 * Auto-updater — check Gitee for latest release, download silently, notify renderer
 */
import { app, BrowserWindow, net, shell, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

function compareVersions(local: string, remote: string): boolean {
  const l = local.split('.').map(Number)
  const r = remote.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true
    if ((r[i] || 0) < (l[i] || 0)) return false
  }
  return false
}

let downloadedFilePath: string | null = null
let downloading = false

export async function checkForUpdates(mainWindow: BrowserWindow) {
  try {
    // Check Gitee for version (fast in China, no VPN needed)
    const res = await net.fetch('https://gitee.com/api/v5/repos/ydd070622/ai-web-tools/releases/latest')
    if (!res.ok) return
    const data = await res.json() as { tag_name?: string; body?: string; assets?: { browser_download_url?: string; name?: string }[] }
    const remoteVersion = (data.tag_name || '').replace(/^v/, '')
    const localVersion = app.getVersion()
    if (!remoteVersion || !compareVersions(localVersion, remoteVersion)) return

    // Prefer .exe from Gitee assets, fall back to GitHub download URL
    let downloadUrl = data.assets?.find(a => a.name?.endsWith('.exe'))?.browser_download_url
    if (!downloadUrl) {
      // No .exe on Gitee yet — use GitHub release (global CDN, reliable)
      downloadUrl = `https://github.com/ydd070622/LingWorks/releases/download/v${remoteVersion}/LingWorks Setup ${remoteVersion}.exe`
    }

    // Just notify renderer — do NOT auto-download
    mainWindow.webContents.send('update-available', {
      version: remoteVersion,
      currentVersion: localVersion,
      downloadUrl,
    })
  } catch {}
}

// Silent download triggered by renderer (or auto-started)
async function startDownload(mainWindow: BrowserWindow, downloadUrl: string, version: string) {
  try {
    const tmpDir = app.getPath('temp')
    const fileName = `LingWorks Setup ${version}.exe`
    const filePath = path.join(tmpDir, fileName)

    // Check if already downloaded (previous session)
    if (fs.existsSync(filePath)) {
      downloadedFilePath = filePath
      mainWindow.webContents.send('update-downloaded', { filePath, version })
      return
    }

    const dlRes = await net.fetch(downloadUrl)
    if (!dlRes.ok || !dlRes.body) {
      mainWindow.webContents.send('update-error', '下载失败')
      return
    }

    const total = Number(dlRes.headers.get('content-length') || 0)
    let downloaded = 0
    const reader = (dlRes.body as any).getReader()
    const chunks: Buffer[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value))
      downloaded += value.length
      if (total > 0) {
        const pct = Math.round((downloaded / total) * 100)
        mainWindow.webContents.send('update-download-progress', { percent: pct })
      }
    }

    fs.writeFileSync(filePath, Buffer.concat(chunks))
    downloadedFilePath = filePath
    mainWindow.webContents.send('update-downloaded', { filePath, version })
  } catch {
    mainWindow.webContents.send('update-error', '下载失败')
  }
}

export function registerUpdateIPC(mainWindow: BrowserWindow) {
  // Start download on demand (user clicked "立即更新")
  ipcMain.handle('update-start-download', async (_event, downloadUrl: string, version: string) => {
    if (downloading) return // prevent double download
    downloading = true
    try {
      await startDownload(mainWindow, downloadUrl, version)
    } finally {
      downloading = false
    }
  })

  ipcMain.handle('update-install', async () => {
    if (downloadedFilePath) {
      shell.openPath(downloadedFilePath)
      setTimeout(() => app.quit(), 500)
    }
  })
}
