import type { BookmarkItem } from './types'

const STORE_KEY = 'bookmarks'

const defaultBookmarks: BookmarkItem[] = [
  {
    id: 'f-ai-chat', name: 'AI 对话', type: 'folder', children: [
      { id: 'b-chatgpt', name: 'ChatGPT', type: 'bookmark', url: 'https://chatgpt.com', icon: '💬' },
      { id: 'b-deepseek', name: 'DeepSeek', type: 'bookmark', url: 'https://chat.deepseek.com', icon: '🧠' },
      { id: 'b-kimi', name: 'Kimi', type: 'bookmark', url: 'https://kimi.moonshot.cn', icon: '🌙' },
      { id: 'b-claude', name: 'Claude', type: 'bookmark', url: 'https://claude.ai', icon: '✨' },
      { id: 'b-gemini', name: 'Gemini', type: 'bookmark', url: 'https://gemini.google.com', icon: '🔮' },
    ]
  },
  {
    id: 'f-ai-image', name: 'AI 生图', type: 'folder', children: [
      { id: 'b-liblib', name: 'Liblib', type: 'bookmark', url: 'https://www.liblib.tv', icon: '🎨' },
      { id: 'b-midjourney', name: 'Midjourney', type: 'bookmark', url: 'https://www.midjourney.com', icon: '🖼️' },
      { id: 'b-comfyui', name: 'ComfyUI', type: 'bookmark', url: 'https://comfyuionline.com', icon: '🔧' },
    ]
  },
  { id: 'b-github', name: 'GitHub', type: 'bookmark', url: 'https://github.com', icon: '🐙' },
  { id: 'b-youtube', name: 'YouTube', type: 'bookmark', url: 'https://youtube.com', icon: '▶️' },
  { id: 'b-gmail', name: 'Gmail', type: 'bookmark', url: 'https://mail.google.com', icon: '📧' },
  { id: 'b-yuque', name: '语雀', type: 'bookmark', url: 'https://yuque.com', icon: '📖' },
  { id: 'b-feishu', name: '飞书', type: 'bookmark', url: 'https://feishu.cn', icon: '🐦' },
]

function genId(): string {
  return 'x' + Date.now() + Math.random().toString(36).slice(2, 6)
}

async function load(): Promise<BookmarkItem[]> {
  try {
    const api = window.electronAPI
    if (api) {
      const d = await api.getStore(STORE_KEY)
      if (d && Array.isArray(d)) return d
    }
  } catch {}
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      if (Array.isArray(d)) return d
    }
  } catch {}
  return JSON.parse(JSON.stringify(defaultBookmarks))
}

async function save(bookmarks: BookmarkItem[]): Promise<void> {
  try {
    const api = window.electronAPI
    if (api) {
      await api.setStore(STORE_KEY, bookmarks)
      return
    }
  } catch {}
  localStorage.setItem(STORE_KEY, JSON.stringify(bookmarks))
}

export const bookmarkStore = {
  async getAll(): Promise<BookmarkItem[]> { return load() },

  async addFolder(name: string): Promise<BookmarkItem> {
    const bm = await load()
    const f: BookmarkItem = { id: genId(), name, type: 'folder', children: [] }
    bm.push(f)
    await save(bm)
    return f
  },

  async addBookmark(name: string, url: string, icon: string, folderId?: string): Promise<BookmarkItem> {
    const bm = await load()
    const b: BookmarkItem = { id: genId(), name, url, type: 'bookmark', icon }
    if (folderId) {
      const f = findFolder(bm, folderId)
      if (f?.children) f.children.push(b)
    } else {
      bm.push(b)
    }
    await save(bm)
    return b
  },

  async updateBookmark(id: string, data: { name?: string; url?: string; icon?: string }): Promise<void> {
    const bm = await load()
    const b = findItem(bm, id) as Extract<BookmarkItem, { type: 'bookmark' }>
    if (!b || b.type !== 'bookmark') return
    if (data.name !== undefined) b.name = data.name
    if (data.url !== undefined) b.url = data.url
    if (data.icon !== undefined) b.icon = data.icon
    await save(bm)
  },

  async deleteBookmark(id: string): Promise<void> {
    const bm = await load()
    removeItem(bm, id)
    await save(bm)
  },

  async deleteFolder(id: string): Promise<void> {
    const bm = await load()
    const idx = bm.findIndex(x => x.id === id)
    if (idx >= 0) bm.splice(idx, 1)
    await save(bm)
  },

  async renameFolder(id: string, name: string): Promise<void> {
    const bm = await load()
    const f = bm.find(x => x.type === 'folder' && x.id === id) as Extract<BookmarkItem, { type: 'folder' }> | undefined
    if (f) f.name = name
    await save(bm)
  },

  async moveBookmark(bookmarkId: string, toFolderId: string): Promise<void> {
    const bm = await load()
    const b = findItem(bm, bookmarkId)
    if (!b || b.type !== 'bookmark') return
    removeItem(bm, bookmarkId)
    if (toFolderId) {
      const f = findFolder(bm, toFolderId)
      if (f?.children) f.children.push(b)
    } else {
      bm.push(b)
    }
    await save(bm)
  },

  async exportData(): Promise<string> {
    const bm = await load()
    return JSON.stringify(bm, null, 2)
  },

  async importData(json: string): Promise<BookmarkItem[]> {
    const d = JSON.parse(json)
    if (!Array.isArray(d)) throw new Error('Invalid format')
    await save(d)
    return d
  },

  async resetToDefault(): Promise<BookmarkItem[]> {
    const d = JSON.parse(JSON.stringify(defaultBookmarks))
    await save(d)
    return d
  },
}

function findFolder(items: BookmarkItem[], id: string): Extract<BookmarkItem, { type: 'folder' }> | null {
  for (const item of items) {
    if (item.id === id && item.type === 'folder') return item as any
    if (item.type === 'folder' && item.children) {
      const found = findFolder(item.children, id)
      if (found) return found
    }
  }
  return null
}

function findItem(items: BookmarkItem[], id: string): BookmarkItem | null {
  for (const item of items) {
    if (item.id === id) return item
    if (item.type === 'folder' && item.children) {
      const found = findItem(item.children, id)
      if (found) return found
    }
  }
  return null
}

function removeItem(items: BookmarkItem[], id: string): boolean {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) { items.splice(i, 1); return true }
    const item = items[i]
    if (item.type === 'folder' && item.children) {
      if (removeItem(item.children, id)) return true
    }
  }
  return false
}
