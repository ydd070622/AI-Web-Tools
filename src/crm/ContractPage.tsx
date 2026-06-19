import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { SharedProps } from './types'
import { avatarGrad, fmtDate } from './helpers'

export default function ContractPage({ closedCusts, setViewingContract, setEditingContract, deleteCusts }: SharedProps) {
  const total = closedCusts.reduce((s, c) => s + (c.dealAmount || 0), 0)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  return (
    <div className="crm-page">
      <div className="crm-toolbar">
        <span className="crm-page-subtitle">已签合同 {closedCusts.length} 份 · 总金额 ¥{(total / 10000).toFixed(1)}万</span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {batchMode ? (
            <>
              <button className="crm-btn-danger-outline" onClick={() => { if (selectedIds.size > 0) { deleteCusts(Array.from(selectedIds)); setSelectedIds(new Set()); setBatchMode(false) } }} disabled={selectedIds.size === 0}>
                删除选中 ({selectedIds.size})
              </button>
              <button className="crm-btn-ghost" onClick={() => { setBatchMode(false); setSelectedIds(new Set()) }}>取消</button>
            </>
          ) : (
            <>
              <button className="crm-btn-ghost" onClick={() => setBatchMode(true)}>管理合同</button>
              <button className="crm-btn-primary" onClick={() => setEditingContract(true)}><Plus size={14} /> 新增合同</button>
            </>
          )}
        </div>
      </div>
      {closedCusts.length === 0 ? <div className="crm-empty">暂无成交合同</div> : (
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                {batchMode && <th style={{ width: 36 }}><input type="checkbox" checked={closedCusts.length > 0 && closedCusts.every(c => selectedIds.has(c.id))} onChange={e => { if (e.target.checked) setSelectedIds(new Set(closedCusts.map(c => c.id))); else setSelectedIds(new Set()) }} /></th>}
                <th>合同编号</th><th>客户</th><th>风格</th><th>合同金额</th><th>签约日期</th><th>备注</th><th style={{ width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {closedCusts.map(c => {
                const toggleSel = (id: string) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next) }
                return (
                  <tr key={c.id} onClick={() => { if (batchMode) toggleSel(c.id); else setViewingContract(c) }}>
                    {batchMode && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSel(c.id)} /></td>}
                    <td className="crm-mono crm-accent">{c.projectId || `P2026-${c.id.slice(-3).padStart(3, '0')}`}</td>
                    <td>
                      <div className="crm-td-name">
                        <div className="crm-avatar crm-avatar-sm" style={{ background: `linear-gradient(135deg,${avatarGrad(c.name)[0]},${avatarGrad(c.name)[1]})` }}>{c.name[0]}</div>
                        {c.name}
                      </div>
                    </td>
                    <td>{c.style || '—'}</td>
                    <td className="crm-amount">¥{(c.dealAmount || 0).toLocaleString()}</td>
                    <td className="crm-muted">{fmtDate(c.updatedAt)}</td>
                    <td className="crm-notes-cell">{c.notes || <span className="crm-muted">—</span>}</td>
                    <td><button className="crm-btn-ghost-xs" onClick={e => { e.stopPropagation(); setViewingContract(c) }}>详情</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
