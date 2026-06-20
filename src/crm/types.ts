// 回款计划中的单笔收款记录
export interface Payment {
  id: string        // 'p' + Date.now() + 随机后缀
  label: string     // 阶段名：定金/进度款/尾款/自定义（如设计费）
  amount: number    // 金额（元）
  paid: boolean     // 是否已收款
  date: string      // 收款日期（YYYY-MM-DD），未收为空串
}

export interface Note {
  id: string; title: string; publishDate: string; status: 'published' | 'draft'
  views: number; likes: number; comments: number
  account: string
  style: string
}

export interface Customer {
  id: string; name: string; phone: string; wechat: string
  source: 'xiaohongshu' | 'referral' | 'other'; sourceNoteId: string | null
  stage: 'lead' | 'wechat' | 'communicating' | 'followup' | 'closed'
  houseType: string; city: string; style: string
  followUpDate: string; followUpNote: string
  dealAmount: number | null; notes: string
  createdAt: string; updatedAt: string
  projectId?: string
  // —— 合同生命周期 + 回款管理（仅 stage==='closed' 即成交后才有意义）——
  contractStatus?: 'signed' | 'progress' | 'done'   // 合同状态，默认 'signed'
  paymentPlan?: Payment[]                            // 回款计划，默认 []
  signDate?: string                                  // 签约日期（YYYY-MM-DD），独立于 updatedAt
}

export interface CRMData { accounts: string[]; notes: Note[]; customers: Customer[] }

export interface EnrichedCustomer extends Customer {
  sourceLabel: string; sourceIcon: string
}

export interface SharedProps {
  data: CRMData
  followUps: (Customer & { diff: number })[]
  todayCount: number
  overdueCount: number
  closedCusts: Customer[]
  leadCount: number
  enrichCust: (c: Customer) => EnrichedCustomer
  updateCust: (id: string, upd: Partial<Customer>) => void
  addCust: (cust: Partial<Customer>) => void
  deleteCust: (id: string) => void
  deleteCusts: (ids: string[]) => void
  moveCust: (id: string, stage: string) => void
  updateNote: (id: string, upd: Partial<Note>) => void
  addNote: (note: Partial<Note>) => void
  deleteNotes: (ids: string[]) => void
  viewMode: 'table' | 'kanban'
  setViewMode: (v: 'table' | 'kanban') => void
  filterNoteId: string | null
  setFilterNoteId: (id: string | null) => void
  setEditingCustomer: (c: Partial<Customer> | null) => void
  setEditingNote: (n: Partial<Note> | null) => void
  setEditingContract: (v: boolean) => void
  setViewingContract: (c: Customer | null) => void
  setTab: (tab: string) => void
}
