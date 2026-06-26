/**
 * Feishu CLI IPC Handlers — execute lark-cli commands from Agent tools.
 *
 * Architecture:
 *   Renderer (agent-loop.ts) → IPC invoke → Main process (this file) → child_process.exec → lark-cli
 *
 * Security:
 *   - Command prefix whitelist (only lark-cli / npx @larksuite/cli)
 *   - Shell metacharacter rejection (no chaining/injection)
 *   - 45s timeout
 *   - 100KB output limit
 */

import { ipcMain } from 'electron'
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const MAX_TIMEOUT = 45000
const MAX_OUTPUT_BYTES = 100 * 1024

// ===== CLI Path Resolution =====
// Electron processes often lack the user's npm global bin path.
// Resolve the correct lark-cli binary on the current platform.

function getNpmGlobalPrefix(): string {
  // Common paths where npm global packages install .cmd shims
  // e.g. %APPDATA%\npm\lark-cli.cmd
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm'),
    path.join(os.homedir(), 'AppData', 'Local', 'npm'),
    path.join(process.env.APPDATA || '', 'npm'),
    path.join(process.env.LOCALAPPDATA || '', 'npm'),
  ]
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, 'lark-cli.cmd'))) {
      return dir
    }
  }
  return ''
}

function resolveCliCommand(subcommand: string): string {
  // Build a command string that works regardless of PATH

  // 1. Try direct invocation (works if PATH includes npm global dir)
  // 2. Try full path to lark-cli.cmd in npm global dir
  // 3. Try npx as fallback

  const npmPrefix = getNpmGlobalPrefix()
  if (npmPrefix) {
    const fullPath = path.join(npmPrefix, 'lark-cli.cmd')
    return `"${fullPath}" ${subcommand}`
  }

  // Fallback: hope it's on PATH, or use npx
  return `lark-cli ${subcommand}`
}

// Cache the resolved path so we don't stat the filesystem on every call
let _cachedCliPrefix = ''
function getCliPrefix(): string {
  if (_cachedCliPrefix) return _cachedCliPrefix

  const npmPrefix = getNpmGlobalPrefix()
  if (npmPrefix) {
    _cachedCliPrefix = `"${path.join(npmPrefix, 'lark-cli.cmd')}"`
    console.log('[feishu] Resolved CLI path:', _cachedCliPrefix)
    return _cachedCliPrefix
  }

  _cachedCliPrefix = 'lark-cli'
  console.log('[feishu] Using PATH-based lark-cli')
  return _cachedCliPrefix
}

// ===== Security: validate command before execution =====
function validateCommand(command: string): string | null {
  if (!command || typeof command !== 'string' || !command.trim()) {
    return '命令不能为空'
  }

  const cmd = command.trim()

  // 1. Prefix whitelist
  const allowedPrefixes = ['lark-cli ', 'npx @larksuite/cli']
  // Also allow our resolved path (full path to lark-cli.cmd)
  const resolvedPrefix = getCliPrefix()
  const allPrefixes = [...allowedPrefixes, resolvedPrefix]

  const hasAllowedPrefix = allPrefixes.some(p => cmd.startsWith(p))
  if (!hasAllowedPrefix) {
    return `命令必须以 lark-cli 开头。收到: ${cmd.slice(0, 80)}`
  }

  // 2. Reject shell metacharacters OUTSIDE of quoted strings (prevent chaining/injection)
  // Strip double-quoted content first — markdown/text inside quotes is user content, not shell syntax
  const strippedCmd = cmd.replace(/"([^"]*)"/g, '""')
  const dangerousPatterns = [
    { pattern: /;/, name: 'shell 命令分隔符 (;)' },
    { pattern: /\|/, name: 'shell 管道符 (|)' },
    { pattern: /`/, name: 'shell 反引号执行 (`)' },
    { pattern: /\$\(/, name: '命令替换 $()' },
    { pattern: /\$\{/, name: '变量替换 ${}' },
    { pattern: /&&/, name: 'shell 逻辑与 (&&)' },
    { pattern: /\|\|/, name: 'shell 逻辑或 (||)' },
    { pattern: /\s>\s?/, name: '输出重定向 (>)' },
    { pattern: /\s>>\s?/, name: '追加重定向 (>>)' },
  ]
  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(strippedCmd)) {
      return `命令包含不安全的${name}。请使用纯 lark-cli 参数形式。`
    }
  }

  // 3. Length limit (prevent abuse)
  if (cmd.length > 10000) {
    return `命令过长 (${cmd.length} 字符，上限 10000)`
  }

  return null // valid
}

// ===== Truncate output with intelligent slicing =====
function truncateOutput(stdout: string, stderr: string): { stdout: string; stderr: string; truncated: boolean } {
  const totalLen = stdout.length + stderr.length
  if (totalLen <= MAX_OUTPUT_BYTES) {
    return { stdout, stderr, truncated: false }
  }

  if (stdout.length > MAX_OUTPUT_BYTES) {
    const half = Math.floor(MAX_OUTPUT_BYTES / 2)
    return {
      stdout: stdout.slice(0, half) + '\n...(输出已截断)...\n' + stdout.slice(-half),
      stderr: stderr.slice(0, 1000).replace(/^/, '(stderr 已截断) '),
      truncated: true,
    }
  }

  const remaining = MAX_OUTPUT_BYTES - stdout.length
  return {
    stdout,
    stderr: stderr.slice(0, remaining).replace(/$/, '\n...(stderr 已截断)'),
    truncated: true,
  }
}

// ===== Build a helpful error message when CLI is not installed =====
function cliNotInstalledHelp(): string {
  return JSON.stringify({
    error: '飞书CLI未安装或未找到',
    hint: '请按以下步骤安装飞书CLI：',
    steps: [
      '1. 打开终端（Win+R 输入 cmd 回车）',
      '2. 执行安装命令（推荐一键安装）: npx @larksuite/cli@latest install',
      '3. 授权登录: lark-cli auth login --recommend',
      '4. 完成后在智能体里说"检查飞书状态"',
    ],
    docs: 'https://github.com/larksuite/cli',
    installCommand: 'npx @larksuite/cli@latest install',
    authCommand: 'lark-cli auth login --recommend',
  }, null, 2)
}

// ===== IPC Handler: feishu-exec =====
ipcMain.handle('feishu-exec', async (_ev, command: string) => {
  console.log('[feishu-exec] Command:', command.slice(0, 200))

  // Normalize: if command starts with "lark-cli ", replace with resolved path
  let cmd = command.trim()
  const cliPrefix = getCliPrefix()
  if (cmd.startsWith('lark-cli ')) {
    cmd = cliPrefix + cmd.slice(8)
  }

  // Pre-process: convert \n escape sequences → actual newlines, but ONLY inside
  // --markdown "..." and --text "..." values. Windows cmd.exe doesn't interpret \n.
  cmd = cmd.replace(/(--(?:markdown|text)\s+")([^"]*)(")/g, (_match, prefix, content, suffix) => {
    return prefix + content.replace(/\\n/g, '\n') + suffix
  })

  // Validate
  const validationError = validateCommand(cmd)
  if (validationError) {
    console.log('[feishu-exec] Validation failed:', validationError)
    return { error: validationError }
  }

  return new Promise((resolve) => {
    const child = exec(cmd, {
      timeout: MAX_TIMEOUT,
      maxBuffer: MAX_OUTPUT_BYTES + 1024 * 10,
      windowsHide: true,
      env: {
        ...process.env,
        LARK_CLI_OUTPUT_MODE: 'json',
        NO_COLOR: '1',
      },
    }, (error, stdout, stderr) => {
      const { stdout: out, stderr: err, truncated } = truncateOutput(stdout || '', stderr || '')

      if (error) {
        const exitCode = (error as any).code
        const killed = (error as any).killed

        if (exitCode === 127 || (error.message && error.message.includes('not found'))) {
          console.log('[feishu-exec] CLI not found')
          resolve(JSON.parse(cliNotInstalledHelp()))
          return
        }

        if (killed) {
          console.log('[feishu-exec] Timed out')
          resolve({ error: '飞书CLI执行超时（超过45秒），请尝试更具体的命令', command: cmd.slice(0, 100) })
          return
        }

        const authKeywords = ['unauthorized', 'unauthenticated', 'token', 'login', 'expired', 'permission', 'access denied', 'auth']
        const combinedOutput = (err + out).toLowerCase()
        const isAuthError = authKeywords.some(k => combinedOutput.includes(k))

        if (isAuthError) {
          console.log('[feishu-exec] Auth error detected')
          resolve({
            error: '飞书授权失败或未登录',
            detail: (err || error.message).slice(0, 500),
            hint: '请在终端执行: lark-cli auth login --recommend',
            authCommand: 'lark-cli auth login --recommend',
            command: cmd.slice(0, 100),
          })
          return
        }

        resolve({
          error: `飞书CLI执行失败 (exit code ${exitCode})${error.message ? ': ' + error.message.slice(0, 200) : ''}`,
          stderr: err.slice(0, 1000) || undefined,
          stdout: out.slice(0, 500) || undefined,
          command: cmd.slice(0, 100),
          truncated,
        })
        return
      }

      console.log('[feishu-exec] Done, stdout:', out.length, 'bytes, stderr:', err.length, 'bytes, truncated:', truncated)
      resolve({
        success: true,
        stdout: out,
        stderr: err || undefined,
        truncated,
      })
    })

    const forceKill = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGTERM')
      }
    }, MAX_TIMEOUT + 1000)
    child.on('exit', () => clearTimeout(forceKill))
  })
})

// ===== IPC Handler: feishu-check =====
ipcMain.handle('feishu-check', async () => {
  console.log('[feishu-check] Checking Feishu CLI status...')

  const result: {
    installed: boolean
    version?: string
    installMethod?: 'global' | 'npx'
    authed: boolean
    authUser?: string
    tenant?: string
    error?: string
    cliPath?: string
  } = {
    installed: false,
    authed: false,
  }

  const cliPrefix = getCliPrefix()
  result.cliPath = cliPrefix

  // 1. Check installation via resolved path
  try {
    const versionOutput = await new Promise<string>((resolve, reject) => {
      exec(`${cliPrefix} --version`, {
        timeout: 10000,
        windowsHide: true,
        env: { ...process.env, NO_COLOR: '1' },
      }, (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout.trim())
      })
    })
    result.installed = true
    result.installMethod = cliPrefix.includes('AppData') ? 'global' : 'npx'
    result.version = versionOutput || undefined
    console.log('[feishu-check] CLI found at', cliPrefix, ':', versionOutput)
  } catch (e: any) {
    console.log('[feishu-check] CLI not found at', cliPrefix, ':', e.message)

    // 2. Fallback: try npx directly
    try {
      const npxOutput = await new Promise<string>((resolve, reject) => {
        exec('npx @larksuite/cli --version', {
          timeout: 20000,
          windowsHide: true,
          env: { ...process.env, NO_COLOR: '1' },
        }, (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout.trim())
        })
      })
      result.installed = true
      result.installMethod = 'npx'
      result.version = npxOutput || undefined
      result.cliPath = 'npx @larksuite/cli'
      console.log('[feishu-check] CLI found via npx:', npxOutput)
    } catch (e2: any) {
      console.log('[feishu-check] CLI not found via npx either:', e2.message)
    }
  }

  // 3. Check auth status (only if installed)
  if (result.installed) {
    try {
      const authCmd = cliPrefix === 'lark-cli'
        ? 'lark-cli auth status'
        : `${cliPrefix} auth status`

      const authOutput = await new Promise<string>((resolve, reject) => {
        exec(authCmd, {
          timeout: 10000,
          windowsHide: true,
          env: { ...process.env, NO_COLOR: '1' },
        }, (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout.trim())
        })
      })

      result.authed = true
      try {
        const parsed = JSON.parse(authOutput)
        const user = parsed.identities?.user
        const bot = parsed.identities?.bot
        if (user?.available && user.userName) {
          result.authUser = user.userName
        } else if (bot?.available) {
          result.authUser = '(bot-only)'
        }
        result.tenant = parsed.brand === 'lark' ? 'Lark' : '飞书'
      } catch {
        const lines = authOutput.split('\n').filter(l => l.trim())
        if (lines.length > 0) {
          result.authUser = lines[0].trim()
        }
      }
      console.log('[feishu-check] Auth OK, user:', result.authUser)
    } catch (e: any) {
      console.log('[feishu-check] Auth check failed:', e.message)
    }
  }

  return result
})
