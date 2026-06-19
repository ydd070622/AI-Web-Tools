import { AVATAR_GRADS } from './constants'

export function today(): string { return new Date().toISOString().split('T')[0] }

export function daysDiff(d1: string, d2: string): number {
  return Math.ceil((new Date(d1).getTime() - new Date(d2).getTime()) / 86400000)
}

export function fmtDate(d: string): string {
  if (!d) return ''
  const p = d.split('-')
  return `${parseInt(p[1])}月${parseInt(p[2])}日`
}

export function fuDisplay(date: string | null) {
  if (!date) return null
  const diff = daysDiff(date, today())
  if (diff < 0) return { cls: 'overdue', text: `逾期${Math.abs(diff)}天` }
  if (diff === 0) return { cls: 'today', text: '今天' }
  if (diff === 1) return { cls: 'soon', text: '明天' }
  if (diff <= 3) return { cls: 'soon', text: `${diff}天后` }
  return { cls: 'future', text: `${diff}天后` }
}

export function avatarGrad(name: string): [string, string] {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_GRADS[Math.abs(h) % AVATAR_GRADS.length]
}
