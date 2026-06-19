import { useState } from 'react'
import { X } from 'lucide-react'
import type { Customer } from './types'
import { STAGES } from './constants'

export default function ContractDetailModal({ contract, onSave, onDelete, onClose }: {
  contract: Customer
  onSave: (id: string, upd: Partial<Customer>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: contract.name, projectId: contract.projectId || '',
    style: contract.style, dealAmount: contract.dealAmount?.toString() || '',
    notes: contract.notes || '',
  })
  const h = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal crm-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <span className="crm-modal-title">合同详情</span>
          <button className="crm-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="crm-modal-body">
          <div className="crm-form-row">
            <div className="crm-form-group" style={{ flex: 2 }}>
              <label className="crm-form-label">客户姓名</label>
              <input className="crm-form-input" value={form.name} onChange={e => h('name', e.target.value)} />
            </div>
            <div className="crm-form-group">
              <label className="crm-form-label">合同编号</label>
              <input className="crm-form-input" value={form.projectId} onChange={e => h('projectId', e.target.value)} />
            </div>
          </div>
          <div className="crm-form-row">
            <div className="crm-form-group">
              <label className="crm-form-label">风格</label>
              <select className="crm-form-input" value={form.style} onChange={e => h('style', e.target.value)}>
                <option value="">-- 选择 --</option>
                <option value="意式极简">意式极简</option>
                <option value="法式风格">法式风格</option>
              </select>
            </div>
            <div className="crm-form-group">
              <label className="crm-form-label">合同金额（元）*</label>
              <input type="number" className="crm-form-input" value={form.dealAmount} onChange={e => h('dealAmount', e.target.value)} />
            </div>
          </div>
          <div className="crm-form-group">
            <label className="crm-form-label">备注</label>
            <textarea className="crm-form-textarea" value={form.notes} onChange={e => h('notes', e.target.value)} rows={2} />
          </div>
        </div>
        <div className="crm-modal-footer">
          <button className="crm-btn-ghost crm-btn-danger" onClick={onDelete}>删除</button>
          <div style={{ flex: 1 }} />
          <button className="crm-btn-ghost" onClick={onClose}>取消</button>
          <button className="crm-btn-primary" onClick={() => {
            if (!form.name.trim() || !form.dealAmount) return
            onSave(contract.id, {
              name: form.name, projectId: form.projectId || undefined,
              style: form.style, dealAmount: parseInt(form.dealAmount) || 0,
              notes: form.notes,
            })
          }}>保存</button>
        </div>
      </div>
    </div>
  )
}
