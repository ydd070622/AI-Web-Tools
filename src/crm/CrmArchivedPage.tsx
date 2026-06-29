import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import type { SharedProps } from './types'
import { TAG_COLORS } from './constants'
import { avatarGrad, fuDisplay, fmtDate } from './helpers'

export default function CrmArchivedPage({ data, updateCust, setEditingCustomer }: SharedProps) {
  const archived = data.customers.filter(c => !!c.archived)
  const invalidCusts = archived.filter(c => c.stage !== 'closed')
  const doneCusts = archived.filter(c => c.stage === 'closed')

  const [filter, setFilter] = useState<'all' | 'invalid' | 'done'>('all')
  const [manageMode, setManageMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const list = useMemo(() => {
    if (filter === 'invalid') return invalidCusts
    if (filter === 'done') return doneCusts
    return archived
  }, [filter, archived, invalidCusts, doneCusts])

  const toggleSelect = (id: string) => setSelectedIds(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id])
  const toggleAll = () => setSelectedIds(s => s.length === list.length ? [] : list.map(c => c.id))
  const restoreSelected = () => {
    if (selectedIds.length === 0) return
    selectedIds.forEach(id => updateCust(id, { archived: false }))
    setSelectedIds([]); setManageMode(false)
    toast.success(`已恢复 ${selectedIds.length} 位客户`)
  }

  return (
    <div>
      {/* ═══ Header ═══ */}
      <div className="crm-page-header">
        <h2>📦 已完成项</h2>
        <span className="crm-page-count">
          共 {archived.length} 位
          <span style={{ color: '#f87171', marginLeft: 6 }}>· 无效 {invalidCusts.length}</span>
          <span style={{ color: '#4ade80', marginLeft: 6 }}>· 已完成 {doneCusts.length}</span>
        </span>
        <div style={{ flex: 1 }} />
        {manageMode && selectedIds.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={restoreSelected}>退档选中 ({selectedIds.length})</button>
        )}
        <button className={`btn btn-sm ${manageMode ? 'btn-danger' : 'btn-ghost'}`} style={{ marginLeft: 8 }} onClick={() => { setManageMode(!manageMode); setSelectedIds([]) }}>
          {manageMode ? '完成' : '管理'}
        </button>
      </div>

      {/* ═══ Filter bar ═══ */}
      <div className="crm-filter-btns" style={{ marginBottom: 14 }}>
        {[
          ['全部', 'all'],
          ['🚫 无效客户', 'invalid'],
          ['✅ 已完成客户', 'done'],
        ].map(([label, key]) => (
          <button key={key} className={`crm-filter-btn ${filter === key ? 'active' : ''}`}
            onClick={() => { setFilter(key as any); setSelectedIds([]) }}>{label}</button>
        ))}
      </div>

      {/* ═══ Table ═══ */}
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {manageMode && <th style={{ width: 36, textAlign: 'center' }}><input type="checkbox" checked={list.length > 0 && selectedIds.length === list.length} onChange={toggleAll} /></th>}
              <th style={{ width: 90 }}>分类</th>
              <th>客户</th><th>添加时间</th><th>地区</th><th>小区名称</th>
              <th>房子面积</th><th>喜欢风格</th><th>客户归属</th><th>跟进</th><th>跟进时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={manageMode ? 12 : 11}><div className="crm-empty"><span>📭</span>暂无匹配的归档客户</div></td></tr>
            )}
            {list.map(c => {
              const fu = fuDisplay(c.followUpDate || null)
              const [g1, g2] = avatarGrad(c.name)
              const isDone = c.stage === 'closed'
              return (
                <tr key={c.id} className={isDone ? 'row-done' : 'row-invalid'}
                  onClick={() => { if (manageMode) toggleSelect(c.id); else setEditingCustomer(c) }} style={{ cursor: 'pointer' }}>
                  {manageMode && <td style={{ width: 36, textAlign: 'center' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} /></td>}
                  <td onClick={e => e.stopPropagation()}>
                    <span className={`crm-archive-badge ${isDone ? 'done' : 'invalid'}`}>
                      <span className="badge-dot" />
                      {isDone ? '已完成' : '无效'}
                    </span>
                  </td>
                  <td>
                    <div className="crm-td-name">
                      <div className="crm-avatar crm-avatar-sm" style={{ background: `linear-gradient(135deg,${g1},${g2})` }}>{c.name[0]}</div>
                      <div>
                        <div>{c.name}</div>
                        {c.wechat && <div className="crm-muted" style={{ fontSize: 10, lineHeight: 1.3 }}>{c.wechat}</div>}
                      </div>
                    </div>
                  </td>
                  <td><span className="crm-muted">{fmtDate(c.recordDate) || '—'}</span></td>
                  <td><span className="crm-info-text">{c.city || <span className="crm-muted">—</span>}</span></td>
                  <td><span className="crm-info-text">{c.community || <span className="crm-muted">—</span>}</span></td>
                  <td><span className="crm-info-text">{c.houseArea || <span className="crm-muted">—</span>}</span></td>
                  <td>{c.stylePreference ? <span className="crm-tag" style={{ background: (TAG_COLORS[c.stylePreference] || {}).bg || 'var(--bg-tertiary)', color: (TAG_COLORS[c.stylePreference] || {}).text || 'var(--text-secondary)' }}>{c.stylePreference}</span> : <span className="crm-muted">—</span>}</td>
                  <td>{c.style ? <span className="crm-tag" style={{ background: (TAG_COLORS[c.style] || {}).bg || 'var(--bg-tertiary)', color: (TAG_COLORS[c.style] || {}).text || 'var(--text-secondary)' }}>{c.style}</span> : <span className="crm-muted">—</span>}</td>
                  <td>{fu ? <span className={`crm-tag ${fu.cls}`}>{fu.text}</span> : <span className="crm-muted">—</span>}</td>
                  <td><span className="crm-muted">{c.followUpDate ? fmtDate(c.followUpDate) : '—'}</span></td>
                  <td>
                    <button className="crm-btn-ghost-xs" onClick={e => { e.stopPropagation(); if (confirm('确认退档？客户将会退回到客户管理页面。')) { updateCust(c.id, { archived: false }); toast.success(`${c.name} 已退档`) } }}>退档</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
