/**
 * Agent Tool IPC Handlers — run in Electron main process (Node.js native fetch, no CORS).
 * Ports & Adapters: tools are executed here, agent loop runs in renderer.
 */

import { ipcMain, shell, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const FETCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'

// ===== HTML → Plain Text Extraction (DeepSeek approach, regex-only, zero deps) =====
function extractReadableText(raw: string, contentType: string): { title: string; text: string } {
  if (!contentType.includes('html') && !contentType.includes('text')) {
    return { title: '', text: normalizeWhitespace(raw) }
  }

  // Extract <title>
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : ''

  // Remove <script> and <style> blocks
  let cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')

  // Semantic tags → newlines
  cleaned = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|article|section)>/gi, '\n')

  // All other tags → space
  cleaned = cleaned.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  cleaned = decodeHtmlEntities(cleaned)

  // Normalize whitespace
  return { title, text: normalizeWhitespace(cleaned) }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \n]+|[ \n]+$/g, '')
}

// ===== URL Validation =====
function validateUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

// ===== IPC Handler: web_fetch =====
ipcMain.handle('web-fetch', async (_ev, url: string, maxBytes: number = 50000) => {
  const validUrl = validateUrl(url)
  if (!validUrl) return { error: '无效的 URL，仅支持 http/https' }

  try {
    console.log('[web-fetch] Fetching:', validUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(validUrl, {
      headers: {
        'User-Agent': FETCH_UA,
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return { error: `HTTP ${response.status} ${response.statusText}`, url: response.url }
    }

    const contentType = response.headers.get('content-type') || ''
    const finalUrl = response.url

    // Read body (respect maxBytes)
    const text = await response.text()
    const truncated = text.length > maxBytes ? text.slice(0, maxBytes) : text

    const { title, text: extracted } = extractReadableText(truncated, contentType)

    // Further truncate extracted text
    const finalText = extracted.length > maxBytes ? extracted.slice(0, maxBytes) + '\n...(内容已截断)' : extracted

    console.log('[web-fetch] Done:', finalUrl, 'title:', title, 'textLen:', finalText.length)

    return {
      url: finalUrl,
      title: title || undefined,
      content: finalText,
    }
  } catch (e: any) {
    console.log('[web-fetch] Error:', e.message)
    return { error: e.name === 'AbortError' ? '请求超时' : e.message }
  }
})

// ===== IPC Handler: file_list =====
ipcMain.handle('file-list', async (_ev, dirPath: string) => {
  try {
    console.log('[file-list] Listing:', dirPath)
    if (!fs.existsSync(dirPath)) {
      return { error: `路径不存在: ${dirPath}` }
    }
    const stat = fs.statSync(dirPath)
    if (!stat.isDirectory()) {
      return { error: `不是目录: ${dirPath}` }
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const items = entries.slice(0, 200).map(e => {
      try {
        const entryStat = fs.statSync(path.join(dirPath, e.name))
        return {
          name: e.name,
          isDir: e.isDirectory(),
          size: e.isFile() ? entryStat.size : undefined,
          modified: entryStat.mtime.toISOString(),
        }
      } catch {
        // Skip entries with permission errors (e.g. System Volume Information)
        return {
          name: e.name,
          isDir: e.isDirectory(),
          size: undefined,
          modified: undefined,
        }
      }
    })
    console.log('[file-list] Found', items.length, 'items')
    return {
      path: dirPath,
      count: entries.length,
      items,
    }
  } catch (e: any) {
    console.log('[file-list] Error:', e.message)
    return { error: e.message, path: dirPath }
  }
})

// ===== IPC Handler: file_read =====
ipcMain.handle('file-read', async (_ev, filePath: string, maxLines?: number) => {
  try {
    console.log('[file-read] Reading:', filePath, 'maxLines:', maxLines)
    if (!fs.existsSync(filePath)) {
      return { error: `文件不存在: ${filePath}` }
    }
    const stat = fs.statSync(filePath)
    const sizeKB = (stat.size / 1024).toFixed(1)
    
    // Limit to 2MB for safety
    if (stat.size > 2 * 1024 * 1024) {
      return { error: `文件过大 (${sizeKB}KB)，超过 2MB 限制`, path: filePath }
    }
    
    let content = fs.readFileSync(filePath, 'utf-8')
    const totalLines = content.split('\n').length
    
    if (maxLines && maxLines > 0) {
      const lines = content.split('\n')
      content = lines.slice(0, maxLines).join('\n')
    }
    
    console.log('[file-read] Done:', filePath, 'size:', sizeKB + 'KB', 'lines:', totalLines)
    return {
      path: filePath,
      size: stat.size,
      sizeKB,
      totalLines,
      content,
      truncated: maxLines ? content.split('\n').length < totalLines : false,
    }
  } catch (e: any) {
    console.log('[file-read] Error:', e.message)
    // Might be binary file
    try {
      const buffer = fs.readFileSync(filePath)
      const sizeKB = (buffer.length / 1024).toFixed(1)
      return {
        path: filePath,
        size: buffer.length,
        sizeKB,
        content: `[二进制文件，大小 ${sizeKB}KB]`,
      }
    } catch (e2: any) {
      return { error: e2.message, path: filePath }
    }
  }
})

// ===== IPC Handler: file_write =====
ipcMain.handle('file-write', async (_ev, filePath: string, content: string) => {
  try {
    console.log('[file-write] Writing:', filePath, 'size:', content.length)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    const stat = fs.statSync(filePath)
    console.log('[file-write] Done:', filePath)
    return {
      path: filePath,
      size: stat.size,
      message: `成功写入 ${content.length} 字符`,
    }
  } catch (e: any) {
    console.log('[file-write] Error:', e.message)
    return { error: e.message, path: filePath }
  }
})

// ===== IPC Handler: file_rename =====
ipcMain.handle('file-rename', async (_ev, oldPath: string, newPath: string) => {
  try {
    console.log('[file-rename] Renaming:', oldPath, '→', newPath)
    if (!fs.existsSync(oldPath)) {
      return { error: `源文件不存在: ${oldPath}` }
    }
    if (fs.existsSync(newPath)) {
      return { error: `目标文件已存在: ${newPath}` }
    }
    const dir = path.dirname(newPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.renameSync(oldPath, newPath)
    console.log('[file-rename] Done:', oldPath, '→', newPath)
    return {
      oldPath,
      newPath,
      message: `成功重命名: ${path.basename(oldPath)} → ${path.basename(newPath)}`,
    }
  } catch (e: any) {
    console.log('[file-rename] Error:', e.message)
    return { error: e.message, oldPath, newPath }
  }
})

// ===== IPC Handler: file_delete =====
ipcMain.handle('file-delete', async (_ev, filePath: string) => {
  try {
    console.log('[file-delete] Deleting:', filePath)
    if (!fs.existsSync(filePath)) {
      return { error: `文件不存在: ${filePath}` }
    }
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(filePath)
    }
    console.log('[file-delete] Done:', filePath)
    return {
      path: filePath,
      message: `成功删除: ${path.basename(filePath)}`,
    }
  } catch (e: any) {
    console.log('[file-delete] Error:', e.message)
    return { error: e.message, path: filePath }
  }
})

// ===== IPC Handler: file_copy =====
ipcMain.handle('file-copy', async (_ev, srcPath: string, destPath: string) => {
  try {
    console.log('[file-copy] Copying:', srcPath, '→', destPath)
    if (!fs.existsSync(srcPath)) {
      return { error: `源文件不存在: ${srcPath}` }
    }
    if (fs.existsSync(destPath)) {
      return { error: `目标已存在: ${destPath}` }
    }
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const stat = fs.statSync(srcPath)
    if (stat.isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true })
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
    console.log('[file-copy] Done:', srcPath, '→', destPath)
    return {
      srcPath,
      destPath,
      message: `成功复制: ${path.basename(srcPath)} → ${path.basename(destPath)}`,
    }
  } catch (e: any) {
    console.log('[file-copy] Error:', e.message)
    return { error: e.message, srcPath, destPath }
  }
})

// ===== IPC Handler: file_search =====
ipcMain.handle('file-search', async (_ev, dirPath: string, pattern: string, maxResults: number = 50) => {
  try {
    console.log('[file-search] Searching:', dirPath, 'pattern:', pattern)
    if (!fs.existsSync(dirPath)) {
      return { error: `目录不存在: ${dirPath}` }
    }
    const results: Array<{ name: string; path: string; isDir: boolean; size?: number }> = []
    // Convert glob-like pattern to regex (support * and ?)
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    const regex = new RegExp(regexStr, 'i')

    function searchDir(dir: string, depth: number) {
      if (depth > 5 || results.length >= maxResults) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (results.length >= maxResults) return
          const fullPath = path.join(dir, entry.name)
          if (regex.test(entry.name)) {
            const item: any = { name: entry.name, path: fullPath, isDir: entry.isDirectory() }
            if (entry.isFile()) {
              try { item.size = fs.statSync(fullPath).size } catch {}
            }
            results.push(item)
          }
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            searchDir(fullPath, depth + 1)
          }
        }
      } catch { /* skip permission errors */ }
    }

    searchDir(dirPath, 0)
    console.log('[file-search] Found:', results.length, 'results')
    return {
      dirPath,
      pattern,
      count: results.length,
      results,
    }
  } catch (e: any) {
    console.log('[file-search] Error:', e.message)
    return { error: e.message, dirPath, pattern }
  }
})

// ===== IPC Handler: file_mkdir =====
ipcMain.handle('file-mkdir', async (_ev, dirPath: string) => {
  try {
    console.log('[file-mkdir] Creating directory:', dirPath)
    if (fs.existsSync(dirPath)) {
      return { error: `目录已存在: ${dirPath}` }
    }
    fs.mkdirSync(dirPath, { recursive: true })
    console.log('[file-mkdir] Done:', dirPath)
    return {
      path: dirPath,
      message: `成功创建目录: ${path.basename(dirPath)}`,
    }
  } catch (e: any) {
    console.log('[file-mkdir] Error:', e.message)
    return { error: e.message, path: dirPath }
  }
})

// ===== IPC Handler: file_info =====
ipcMain.handle('file-info', async (_ev, filePath: string) => {
  try {
    console.log('[file-info] Getting info:', filePath)
    if (!fs.existsSync(filePath)) {
      return { error: `文件不存在: ${filePath}` }
    }
    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const typeMap: Record<string, string> = {
      '.jpg': '图片', '.jpeg': '图片', '.png': '图片', '.gif': '图片', '.bmp': '图片', '.webp': '图片', '.svg': '图片',
      '.mp4': '视频', '.avi': '视频', '.mkv': '视频', '.mov': '视频', '.wmv': '视频',
      '.mp3': '音频', '.wav': '音频', '.flac': '音频', '.aac': '音频', '.ogg': '音频',
      '.pdf': 'PDF文档', '.doc': 'Word文档', '.docx': 'Word文档', '.xls': 'Excel表格', '.xlsx': 'Excel表格',
      '.ppt': 'PPT', '.pptx': 'PPT', '.txt': '文本文件', '.csv': 'CSV文件',
      '.zip': '压缩包', '.rar': '压缩包', '.7z': '压缩包', '.tar': '压缩包', '.gz': '压缩包',
      '.exe': '可执行文件', '.msi': '安装程序', '.bat': '批处理文件', '.ps1': 'PowerShell脚本',
      '.js': 'JavaScript', '.ts': 'TypeScript', '.py': 'Python', '.java': 'Java', '.html': 'HTML', '.css': 'CSS',
      '.json': 'JSON', '.xml': 'XML', '.md': 'Markdown',
    }
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
    }
    return {
      path: filePath,
      name: path.basename(filePath),
      ext,
      type: stat.isDirectory() ? '文件夹' : (typeMap[ext] || '文件'),
      isDirectory: stat.isDirectory(),
      size: stat.size,
      sizeFormatted: formatSize(stat.size),
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString(),
      accessed: stat.atime.toISOString(),
    }
  } catch (e: any) {
    console.log('[file-info] Error:', e.message)
    return { error: e.message, path: filePath }
  }
})

// ===== IPC Handler: file_open =====
ipcMain.handle('file-open', async (_ev, filePath: string) => {
  try {
    console.log('[file-open] Opening:', filePath)
    if (!fs.existsSync(filePath)) {
      return { error: `文件不存在: ${filePath}` }
    }
    const err = await shell.openPath(filePath)
    if (err) {
      return { error: `打开失败: ${err}`, path: filePath }
    }
    return { path: filePath, message: `已打开: ${path.basename(filePath)}` }
  } catch (e: any) {
    console.log('[file-open] Error:', e.message)
    return { error: e.message, path: filePath }
  }
})

// ===== IPC Handler: list_drives =====
ipcMain.handle('list-drives', async () => {
  try {
    const drives: Array<{ drive: string; label: string; used: string }> = []
    if (process.platform === 'win32') {
      for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i)
        const root = `${letter}:\\`
        try {
          if (fs.existsSync(root)) {
            drives.push({ drive: root, label: `本地磁盘 (${letter}:)`, used: '' })
          }
        } catch { /* skip permission errors */ }
      }
      return { platform: 'win32', drives }
    }
    // Linux/Mac: root only
    return { platform: process.platform, drives: [{ drive: '/', label: '根目录 /', used: '' }] }
  } catch (e: any) {
    return { error: e.message }
  }
})

// ===== IPC Handler: file_show =====
ipcMain.handle('file-show', async (_ev, filePath: string) => {
  try {
    console.log('[file-show] Showing in folder:', filePath)
    if (!fs.existsSync(filePath)) {
      return { error: `文件不存在: ${filePath}` }
    }
    shell.showItemInFolder(filePath)
    return { path: filePath, message: `已在资源管理器中显示: ${path.basename(filePath)}` }
  } catch (e: any) {
    console.log('[file-show] Error:', e.message)
    return { error: e.message, path: filePath }
  }
})

// ===== IPC Handler: file_edit =====
ipcMain.handle('file-edit', async (_ev, filePath: string, search: string, replace: string) => {
  try {
    console.log('[file-edit] Editing:', filePath)
    if (!fs.existsSync(filePath)) {
      return { error: `文件不存在: ${filePath}` }
    }
    let content = fs.readFileSync(filePath, 'utf-8')
    
    if (!content.includes(search)) {
      return {
        error: `在文件中找不到匹配内容`,
        path: filePath,
        searchPreview: search.slice(0, 200),
      }
    }
    
    const newContent = content.replace(search, replace)
    fs.writeFileSync(filePath, newContent, 'utf-8')
    
    const oldLines = content.split('\n').length
    const newLines = newContent.split('\n').length
    console.log('[file-edit] Done:', filePath, `lines: ${oldLines} → ${newLines}`)
    return {
      path: filePath,
      message: `成功替换编辑（${oldLines}行 → ${newLines}行）`,
      oldLines,
      newLines,
    }
  } catch (e: any) {
    console.log('[file-edit] Error:', e.message)
    return { error: e.message, path: filePath }
  }
})

// ===== Memory System — Markdown-based persistent user memories =====
function getMemoriesDir(): string {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), 'memories')
  }
  return path.join(app.getPath('documents'), 'LingWorks', 'memories')
}

function ensureMemoriesDir(): void {
  if (!fs.existsSync(getMemoriesDir())) {
    fs.mkdirSync(getMemoriesDir(), { recursive: true })
  }
  const topicsDir = path.join(getMemoriesDir(), 'topics')
  if (!fs.existsSync(topicsDir)) {
    fs.mkdirSync(topicsDir, { recursive: true })
  }
  const profilePath = path.join(getMemoriesDir(), 'profile.md')
  if (!fs.existsSync(profilePath)) {
    fs.writeFileSync(profilePath, '# 用户档案\n\n_你的基本信息会以下面结构化的格式记录在这里，智能体会在每次对话时读取。_\n\n', 'utf-8')
  }
}

// ===== IPC Handler: memory_save =====
ipcMain.handle('memory-save', async (_ev, category: string, content: string) => {
  try {
    console.log('[memory-save] Category:', category, 'content:', content.slice(0, 60))
    ensureMemoriesDir()
    
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    
    let filePath: string
    if (category === 'profile') {
      filePath = path.join(getMemoriesDir(), 'profile.md')
    } else {
      filePath = path.join(getMemoriesDir(), 'topics', `${category}.md`)
    }
    
    const entry = `\n### ${dateStr} ${timeStr}\n${content}\n`
    
    if (fs.existsSync(filePath)) {
      fs.appendFileSync(filePath, entry, 'utf-8')
    } else {
      fs.writeFileSync(filePath, `# ${category}\n${entry}`, 'utf-8')
    }
    
    console.log('[memory-save] Done:', filePath)
    return { success: true, category, file: path.basename(filePath), message: `已保存到 ${category}` }
  } catch (e: any) {
    console.log('[memory-save] Error:', e.message)
    return { error: e.message, category }
  }
})

// ===== Memory Entry Splitting =====
// Splits a single memory markdown file into individual entries by `### ` headings.
// Each entry = { heading, date, content, raw }. File-level `# category` header and
// default intro text (e.g. profile.md placeholder) are skipped (not returned as entries).
interface MemoryEntry {
  heading: string   // full heading line, e.g. "### 2026-06-15 14:30"
  date: string      // parsed YYYY-MM-DD (empty if unparseable)
  content: string   // body text under the heading (trimmed)
  raw: string       // full block including heading + body
}

function splitMemoryEntries(rawMarkdown: string): MemoryEntry[] {
  const lines = rawMarkdown.split('\n')
  const entries: MemoryEntry[] = []
  let currentHeading = ''
  let currentBody: string[] = []
  let inEntry = false

  const flush = () => {
    if (!inEntry) return
    const content = currentBody.join('\n').trim()
    // Parse date from heading: "### 2026-06-15 14:30" → "2026-06-15"
    const dateMatch = currentHeading.match(/^###\s+(\d{4}-\d{2}-\d{2})/)
    const date = dateMatch ? dateMatch[1] : ''
    entries.push({
      heading: currentHeading,
      date,
      content,
      raw: (currentHeading + '\n' + content).trim(),
    })
    currentHeading = ''
    currentBody = []
    inEntry = false
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flush()
      currentHeading = line
      inEntry = true
    } else if (inEntry) {
      currentBody.push(line)
    }
    // Lines before the first `### ` (file header `# category` + intro text) are skipped
  }
  flush()
  return entries
}

// Extract a short title from an entry's content: first non-empty line, truncated.
function entryTitle(entry: MemoryEntry): string {
  const firstLine = entry.content.split('\n').map(l => l.trim()).find(l => l) || ''
  // Strip markdown list/heading markers for a cleaner title
  const cleaned = firstLine.replace(/^[-*]\s*/, '').replace(/^#+\s*/, '').trim()
  return cleaned.length > 40 ? cleaned.slice(0, 40) + '...' : cleaned
}

// ===== IPC Handler: memory_recall =====
ipcMain.handle('memory-recall', async (_ev, category?: string, keyword?: string, limit?: number, mode?: 'index' | 'full') => {
  try {
    console.log('[memory-recall] Category:', category || 'all', 'keyword:', keyword || '', 'mode:', mode || 'full')
    ensureMemoriesDir()

    const memDir = getMemoriesDir()
    const topicsDir = path.join(memDir, 'topics')

    // Build the list of (category, filePath) to scan
    const targets: Array<{ category: string; filePath: string }> = []
    if (category) {
      const filePath = category === 'profile'
        ? path.join(memDir, 'profile.md')
        : path.join(topicsDir, `${category}.md`)
      if (fs.existsSync(filePath)) targets.push({ category, filePath })
    } else {
      // profile first, then topics in sorted order (preserves existing behavior)
      const profilePath = path.join(memDir, 'profile.md')
      if (fs.existsSync(profilePath)) targets.push({ category: 'profile', filePath: profilePath })
      if (fs.existsSync(topicsDir)) {
        const files = fs.readdirSync(topicsDir).filter(f => f.endsWith('.md')).sort()
        for (const f of files) {
          targets.push({ category: f.replace(/\.md$/, ''), filePath: path.join(topicsDir, f) })
        }
      }
    }

    const maxLimit = (typeof limit === 'number' && limit > 0) ? limit : 20
    const kw = (typeof keyword === 'string' && keyword.trim()) ? keyword.trim().toLowerCase() : ''

    // ===== Index mode: return per-category summary (count + latest entry) =====
    if (mode === 'index') {
      const index: Array<{ category: string; count: number; latestDate: string; latestTitle: string }> = []
      for (const t of targets) {
        const raw = fs.readFileSync(t.filePath, 'utf-8')
        const entries = splitMemoryEntries(raw)
        if (entries.length === 0) continue
        // latest = last appended entry (appendFileSync appends to end)
        const latest = entries[entries.length - 1]
        index.push({
          category: t.category,
          count: entries.length,
          latestDate: latest.date,
          latestTitle: entryTitle(latest),
        })
      }
      return { mode: 'index', categories: index, totalCategories: index.length }
    }

    // ===== Full mode: return structured entries (optionally filtered by keyword) =====
    const allEntries: Array<{ category: string; date: string; heading: string; content: string }> = []
    let truncated = false
    for (const t of targets) {
      const raw = fs.readFileSync(t.filePath, 'utf-8')
      let entries = splitMemoryEntries(raw)
      if (kw) {
        entries = entries.filter(e => e.content.toLowerCase().includes(kw) || e.heading.toLowerCase().includes(kw))
      }
      // Apply per-category limit
      if (entries.length > maxLimit) {
        entries = entries.slice(0, maxLimit)
        truncated = true
      }
      for (const e of entries) {
        allEntries.push({ category: t.category, date: e.date, heading: e.heading, content: e.content })
      }
    }

    console.log('[memory-recall] Done, entries:', allEntries.length, 'truncated:', truncated)
    return { mode: 'full', entries: allEntries, total: allEntries.length, truncated }
  } catch (e: any) {
    console.log('[memory-recall] Error:', e.message)
    return { error: e.message }
  }
})

// ===== IPC Handler: memory_delete =====
ipcMain.handle('memory-delete', async (_ev, category: string, search: string) => {
  try {
    console.log('[memory-delete] Category:', category, 'search:', search.slice(0, 60))
    ensureMemoriesDir()
    
    const filePath = category === 'profile'
      ? path.join(getMemoriesDir(), 'profile.md')
      : path.join(getMemoriesDir(), 'topics', `${category}.md`)
    
    if (!fs.existsSync(filePath)) {
      return { error: `记忆分类 ${category} 不存在` }
    }
    
    let content = fs.readFileSync(filePath, 'utf-8')
    if (!content.includes(search)) {
      return { error: `在 ${category} 中找不到匹配内容`, searchPreview: search.slice(0, 100) }
    }
    
    const lines = content.split('\n')
    const searchIdx = lines.findIndex(l => l.includes(search))
    if (searchIdx >= 0) {
      let start = searchIdx
      while (start > 0 && !lines[start].startsWith('### ') && lines[start].trim() !== '') {
        start--
      }
      if (start > 0 && lines[start].startsWith('### ')) {
        // Include the heading
      } else if (start > 0 && lines[start].trim() === '') {
        start++
      }
      let end = searchIdx + 1
      while (end < lines.length && !lines[end].startsWith('### ') && !lines[end].startsWith('# ')) {
        end++
      }
      while (end > start && lines[end - 1].trim() === '') {
        end--
      }
      lines.splice(start, end - start)
      content = lines.join('\n').replace(/\n{3,}/g, '\n\n')
    }
    
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log('[memory-delete] Done:', filePath)
    return { success: true, category, file: path.basename(filePath), message: `已从 ${category} 中删除匹配记忆` }
  } catch (e: any) {
    console.log('[memory-delete] Error:', e.message)
    return { error: e.message, category }
  }
})
