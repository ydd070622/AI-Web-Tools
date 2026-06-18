/**
 * Tools IPC — image ops, shell ops, window control, shortcuts, theme, history images
 */
import { ipcMain, app, BrowserWindow, dialog, shell, nativeTheme, globalShortcut, Tray, Menu, Notification } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

export function registerTools(mainWindow: BrowserWindow | null) {
  // ===== History Images =====
  ipcMain.handle('save-history-image', async (_e, base64: string, id: string) => {
    const dir = path.join(app.getPath('userData'), 'history-images')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${id}.png`)
    const data = base64.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
    return filePath
  })

  ipcMain.handle('read-history-image', async (_e, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        console.log('[read-history-image] file not found:', filePath)
        return null
      }
      const stat = fs.statSync(filePath)
      if (stat.size === 0) {
        console.log('[read-history-image] file is empty:', filePath)
        return null
      }
      const buffer = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase().slice(1) || 'png'
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      return `data:${mimeType};base64,${buffer.toString('base64')}`
    } catch (e: any) {
      console.error('[read-history-image] error:', e.message)
      return null
    }
  })

  ipcMain.handle('delete-history-image', async (_e, filePath: string) => {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
  })

  ipcMain.handle('get-history-image-dir', () =>
    path.join(app.getPath('userData'), 'history-images')
  )

  // Download image from URL in main process (bypasses renderer Node.js pollution)
  ipcMain.handle('download-image', async (_e, url: string) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) {
        console.error('[download-image] HTTP error:', res.status)
        return null
      }
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const contentType = res.headers.get('content-type') || 'image/png'
      return `data:${contentType};base64,${buffer.toString('base64')}`
    } catch (e: any) {
      console.error('[download-image] error:', e.message)
      return null
    }
  })

  // ===== Image Tools =====
  ipcMain.handle('save-image', async (_e, dataUrl: string, defaultName: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }],
    })
    if (result.canceled || !result.filePath) return
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'))
  })

  ipcMain.handle('open-image-window', async (_e, url: string) => {
    const win = new BrowserWindow({
      width: 800,
      height: 800,
      webPreferences: { webSecurity: false },
    })
    win.loadURL(url)
  })

  // ===== Shell & System =====
  ipcMain.handle('open-external', async (_e, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('shell-open-path', async (_e, p: string) => {
    shell.openPath(p)
  })

  ipcMain.handle('shell-show-item', async (_e, p: string) => {
    shell.showItemInFolder(p)
  })

  ipcMain.handle('get-desktop-path', () => app.getPath('desktop'))

  ipcMain.handle('select-folder', async (_e, defaultPath: string) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      defaultPath: defaultPath || app.getPath('desktop'),
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ===== Theme =====
  ipcMain.handle('set-theme-source', async (_e, source: string) => {
    if (source === 'dark' || source === 'light' || source === 'system') {
      nativeTheme.themeSource = source
    }
  })

  // ===== Window Control =====
  ipcMain.handle('window-minimize', () => mainWindow?.minimize())
  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) { mainWindow?.unmaximize() }
    else { mainWindow?.maximize() }
  })
  ipcMain.handle('window-close', () => mainWindow?.close())
  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('window-set-position', (_e, x: number, y: number) => {
    mainWindow?.setPosition(x, y)
  })

  // ===== Shortcuts =====

  // Track previous user-defined bindings for diff-based updates
  let prevBindings: Record<string, string> = {}

  // Track Ctrl+Space retry timer so we can clear it on quit
  let agentShortcutTimer: NodeJS.Timeout | null = null

  // Register Ctrl+Space with retry mechanism (max 5 attempts).
  // Default action 'agent-panel' is used until the renderer pushes its bindings.
  let shortcutRetries = 0
  const MAX_RETRIES = 5
  let agentShortcutAction = 'agent-panel'
  const registerAgentShortcut = () => {
    agentShortcutTimer = null
    // Re-register: register() overwrites previous callback for same accelerator
    const ok = globalShortcut.register('Ctrl+Space', () => {
      mainWindow?.webContents.send('shortcut-trigger', agentShortcutAction)
    })
    if (!ok && shortcutRetries < MAX_RETRIES) {
      shortcutRetries++
      console.warn(`[tools] Ctrl+Space registration failed — retry ${shortcutRetries}/${MAX_RETRIES} in 2s...`)
      agentShortcutTimer = setTimeout(registerAgentShortcut, 2000)
    } else if (ok) {
      shortcutRetries = 0
      console.log('[tools] Ctrl+Space registered successfully')
    } else {
      console.error('[tools] Ctrl+Space registration failed after all retries — check system IME settings')
    }
  }
  registerAgentShortcut()

  ipcMain.handle('register-shortcuts', async (_e, bindings: Record<string, string>) => {
    // Diff-based update: only unregister removed/changed shortcuts.
    // Ctrl+Space is special — handled separately below so user-configured action takes effect.
    const oldKeys = Object.keys(prevBindings)
    const newKeys = Object.keys(bindings).filter(k => k !== 'Ctrl+Space')

    // Unregister shortcuts that were removed or changed (skip Ctrl+Space)
    for (const combo of oldKeys) {
      if (combo === 'Ctrl+Space') continue
      if (!newKeys.includes(combo) || prevBindings[combo] !== bindings[combo]) {
        try { globalShortcut.unregister(combo) } catch {}
      }
    }

    // Register new or changed shortcuts (excluding Ctrl+Space from diff check)
    for (const combo of newKeys) {
      if (!oldKeys.includes(combo) || prevBindings[combo] !== bindings[combo]) {
        try {
          const ok = globalShortcut.register(combo, () => {
            mainWindow?.webContents.send('shortcut-trigger', bindings[combo])
          })
          if (!ok) {
            console.warn(`[tools] Shortcut '${combo}' registration failed — may be taken by another app`)
          } else {
            console.log(`[tools] Shortcut '${combo}' → ${bindings[combo]}`)
          }
        } catch (e) {
          console.error('[tools] Failed to register shortcut:', combo, e)
        }
      }
    }

    // Ctrl+Space: update action atomically; re-register so latest user binding takes effect.
    // (globalShortcut.register overwrites the previous callback for the same accelerator.)
    if (bindings['Ctrl+Space']) {
      agentShortcutAction = bindings['Ctrl+Space']
      try {
        const ok = globalShortcut.register('Ctrl+Space', () => {
          mainWindow?.webContents.send('shortcut-trigger', agentShortcutAction)
        })
        if (ok) {
          console.log(`[tools] Ctrl+Space → ${agentShortcutAction}`)
        }
      } catch {
        // Silent — registerAgentShortcut has its own retry
      }
    }

    prevBindings = { ...bindings }
  })

  // Clean up retry timer on quit
  app.on('will-quit', () => {
    if (agentShortcutTimer) { clearTimeout(agentShortcutTimer); agentShortcutTimer = null }
  })

  // ===== System: Auto-launch, Tray, Notifications =====
  let tray: Tray | null = null
  let closeToTrayEnabled = false

  ipcMain.handle('set-auto-launch', async (_e, enable: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enable })
  })

  ipcMain.handle('get-auto-launch', async () => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('set-start-minimized', async (_e, enable: boolean) => {
    const settings = app.getLoginItemSettings()
    app.setLoginItemSettings({ openAtLogin: settings.openAtLogin, openAsHidden: enable })
  })

  ipcMain.handle('get-start-minimized', async () => {
    return app.getLoginItemSettings().openAsHidden
  })

  ipcMain.handle('set-close-to-tray', async (_e, enable: boolean) => {
    closeToTrayEnabled = enable
    if (enable) {
      if (!tray) {
        const iconPath = path.join(__dirname, app.isPackaged ? '../dist/icon.png' : '../public/app-icon.png')
        tray = new Tray(iconPath)
        const contextMenu = Menu.buildFromTemplate([
          { label: '显示窗口', click: () => { mainWindow?.show(); mainWindow?.focus() } },
          { type: 'separator' },
          { label: '退出', click: () => { closeToTrayEnabled = false; app.quit() } },
        ])
        tray.setToolTip('LingWorks')
        tray.setContextMenu(contextMenu)
        tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
      }
    } else {
      if (tray) { tray.destroy(); tray = null }
    }
  })

  ipcMain.handle('get-close-to-tray', async () => closeToTrayEnabled)

  ipcMain.handle('show-notification', async (_e, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: path.join(__dirname, app.isPackaged ? '../dist/icon.png' : '../public/app-icon.png') }).show()
    }
  })

  // Expose close-to-tray flag for the main close handler
  return { get closeToTray() { return closeToTrayEnabled } }
}
