import { LayoutDashboard, Users, Filter, FileText, BarChart3, FileEdit } from 'lucide-react'

export const STAGES = [
  { id: 'lead', label: '待引流', icon: '📥', dotColor: '#3b82f6', cls: 'stage-lead' },
  { id: 'wechat', label: '已加微信', icon: '💬', dotColor: '#8b5cf6', cls: 'stage-wechat' },
  { id: 'communicating', label: '沟通中', icon: '🤝', dotColor: '#6366f1', cls: 'stage-communicating' },
  { id: 'followup', label: '待跟进', icon: '⏰', dotColor: '#f59e0b', cls: 'stage-followup' },
  { id: 'closed', label: '已成交', icon: '✅', dotColor: '#22c55e', cls: 'stage-closed' },
] as const

export const SOURCES = [
  { id: 'xiaohongshu', label: '小红书笔记', icon: '📕' },
  { id: 'referral', label: '老客户介绍', icon: '👥' },
  { id: 'other', label: '其他', icon: '📌' },
] as const

export const AVATAR_GRADS: [string, string][] = [
  ['#6366f1', '#818cf8'], ['#8b5cf6', '#a78bfa'], ['#ec4899', '#f472b6'],
  ['#f59e0b', '#fbbf24'], ['#22c55e', '#4ade80'], ['#3b82f6', '#60a5fa'],
  ['#ef4444', '#f87171'], ['#06b6d4', '#22d3ee'], ['#f97316', '#fb923c'],
  ['#14b8a6', '#2dd4bf'],
]

export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  '意式极简': { bg: '#1e293b', text: '#94a3b8' },
  '法式风格': { bg: '#3d1a4a', text: '#e879f9' },
}

export const TABS = [
  { id: 'workbench', label: '工作台', icon: LayoutDashboard },
  { id: 'customers', label: '客户管理', icon: Users },
  { id: 'leadpool', label: '线索池', icon: Filter },
  { id: 'contracts', label: '合同管理', icon: FileText },
  { id: 'dashboard', label: '数据看板', icon: BarChart3 },
  { id: 'notes', label: '笔记管理', icon: FileEdit },
] as const

export const STORAGE_KEY = 'lingworks_crm_v3'
