import { useState, useMemo } from 'react'
import { Plus, ChevronRight, Link } from 'lucide-react'
import type { SharedProps, Note } from './types'
import { fmtDate } from './helpers'

export default function NotesPage({ data, updateNote, deleteNotes, setEditingNote, setFilterNoteId, setTab }: SharedProps) {
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [syncLink, setSyncLink] = useState('')

  const notesWithLeads = useMemo(() => data.notes.map(n => ({
    ...n, leads: data.customers.filter(c => c.sourceNoteId === n.id).length,
  })), [data.notes, data.customers])

  const toggleSel = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const openSyncModal = () => {
    const link = syncLink.trim()
    if (!link) return
    setEditingNote({ link, account: data.accounts[0] })
    setSyncLink('')
  }

  return (
    <div className="crm-page">
      <div className="crm-toolbar">
        <span className="crm-page-subtitle">{notesWithLeads.length} 条笔记 · {notesWithLeads.filter(n => n.status === 'published').length} 已发布</span>
        <div className="crm-toolbar-right">
          {batchMode ? (
            <>
              <button className="crm-btn-danger-outline" disabled={selectedIds.size === 0} onClick={() => {
                if (selectedIds.size > 0) { deleteNotes(Array.from(selectedIds)); setSelectedIds(new Set()); setBatchMode(false) }
              }}>删除选中 ({selectedIds.size})</button>
              <button className="crm-btn-ghost" onClick={() => { setBatchMode(false); setSelectedIds(new Set()) }}>取消</button>
            </>
          ) : (
            <>
              <input
                className="crm-search"
                style={{ width: 240 }}
                placeholder="粘贴小红书链接…"
                value={syncLink}
                onChange={e => setSyncLink(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') openSyncModal() }}
              />
              <button className="crm-btn-primary" onClick={openSyncModal} disabled={!syncLink.trim()}>
                <Link size={13} /> 粘贴链接
              </button>
              <button className="crm-btn-ghost" onClick={() => setBatchMode(true)}>管理</button>
              <button className="crm-btn-primary" onClick={() => setEditingNote({})}><Plus size={14} /> 新增笔记</button>
            </>
          )}
        </div>
      </div>
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {batchMode && <th style={{ width: 36 }}><input type="checkbox" checked={notesWithLeads.length > 0 && notesWithLeads.every(n => selectedIds.has(n.id))} onChange={e => { if (e.target.checked) setSelectedIds(new Set(notesWithLeads.map(n => n.id))); else setSelectedIds(new Set()) }} /></th>}
              <th>笔记标题</th>
              <th style={{ width: 70 }}>账号</th>
              <th style={{ width: 85 }}>发布时间</th>
              <th style={{ width: 72 }}>状态</th>
              <th style={{ width: 90, textAlign: 'center' }}>带来客户</th>
            </tr>
          </thead>
          <tbody>
            {notesWithLeads.map(n => (
              <tr key={n.id} onClick={() => { if (batchMode) toggleSel(n.id); else setEditingNote(n) }}>
                {batchMode && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(n.id)} onChange={() => toggleSel(n.id)} /></td>}
                <td className="crm-note-title">
                  {n.title}
                  {n.link && <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 10 }} title={n.link}>🔗</span>}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{n.account}</td>
                <td className="crm-muted">{n.publishDate ? fmtDate(n.publishDate) : '—'}</td>
                <td onClick={e => e.stopPropagation()}>
                  <select
                    className="crm-table-select"
                    value={n.status}
                    onChange={e => updateNote(n.id, { status: e.target.value as Note['status'] })}
                  >
                    <option value="published">已发布</option>
                    <option value="draft">草稿</option>
                  </select>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="crm-link-btn" onClick={e => { e.stopPropagation(); setFilterNoteId(n.id); setTab('customers') }}>
                    {n.leads} 人 <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
