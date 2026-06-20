import { useMemo } from 'react'
import type { SharedProps } from './types'

export default function DashboardPage({ data, todayCount, closedCusts }: SharedProps) {
  const total = data.customers.filter(c => c.stage !== 'closed').length
  const closed = data.customers.filter(c => c.stage === 'closed').length
  const revenue = closedCusts.reduce((s, c) => s + (c.dealAmount || 0), 0)
  const paid = closedCusts.reduce((s, c) => s + (c.paymentPlan || []).filter(p => p.paid).reduce((ss, p) => ss + p.amount, 0), 0)

  const funnel = [
    { label: '留资/咨询', count: total, color: '#3b82f6' },
    { label: '已加微信', count: data.customers.filter(c => ['wechat', 'communicating', 'followup', 'closed'].includes(c.stage)).length, color: '#8b5cf6' },
    { label: '深入沟通', count: data.customers.filter(c => ['communicating', 'followup', 'closed'].includes(c.stage)).length, color: '#6366f1' },
    { label: '报价/跟进', count: data.customers.filter(c => ['followup', 'closed'].includes(c.stage)).length, color: '#f59e0b' },
    { label: '成交', count: closed, color: '#22c55e' },
  ]
  const fmax = Math.max(...funnel.map(s => s.count), 1)

  const topNotes = useMemo(() =>
    [...data.notes].map(n => ({ ...n, leads: data.customers.filter(c => c.sourceNoteId === n.id).length }))
      .sort((a, b) => b.leads - a.leads).slice(0, 5),
    [data.notes, data.customers])

  const rankColors = ['#f59e0b', '#94a3b8', '#fb923c']

  return (
    <div>
      <div className="crm-kpi-grid">
        <div className="crm-kpi-card accent"><span className="crm-kpi-label">总客户</span><span className="crm-kpi-value">{total}</span></div>
        <div className="crm-kpi-card warn"><span className="crm-kpi-label">今日待跟进</span><span className="crm-kpi-value">{todayCount}</span></div>
        <div className="crm-kpi-card success"><span className="crm-kpi-label">已成交</span><span className="crm-kpi-value">{closed}</span></div>
        <div className="crm-kpi-card success"><span className="crm-kpi-label">总成交额</span><span className="crm-kpi-value" style={{ fontSize: 18 }}>¥{(revenue / 10000).toFixed(1)}<span style={{ fontSize: 12, fontWeight: 500 }}>万</span></span></div>
        <div className="crm-kpi-card success"><span className="crm-kpi-label">已回款</span><span className="crm-kpi-value" style={{ fontSize: 18 }}>¥{(paid / 10000).toFixed(1)}<span style={{ fontSize: 12, fontWeight: 500 }}>万</span></span></div>
      </div>

      <div className="crm-dash-grid">
        <div className="crm-section">
          <div className="crm-section-header">
            <span className="crm-section-title">转化漏斗</span>
          </div>
          <div className="crm-funnel">
            {funnel.map((s, i) => (
              <div key={s.label} className="crm-funnel-row">
                <span className="crm-funnel-label">{s.label}</span>
                <div className="crm-funnel-track">
                  <div className="crm-funnel-fill" style={{ width: `${(s.count / fmax) * 100}%`, background: s.color }}>
                    {i > 0 && funnel[i - 1].count > 0 && <span className="crm-funnel-rate">{Math.round(s.count / funnel[i - 1].count * 100)}%</span>}
                  </div>
                </div>
                <span className="crm-funnel-pct" style={{ color: s.color }}>
                  {i > 0 && funnel[i - 1].count > 0 ? Math.round(s.count / funnel[i - 1].count * 100) + '%' : ''}
                </span>
                <span className="crm-funnel-count">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="crm-section">
          <div className="crm-section-header">
            <span className="crm-section-title">笔记获客排行</span>
          </div>
          {topNotes.map((n, i) => (
            <div key={n.id} className="crm-rank-item">
              <span className="crm-rank-num" style={{ background: rankColors[i] || 'var(--bg-tertiary)', color: i < 3 ? '#000' : 'var(--text-muted)' }}>{i + 1}</span>
              <span className="crm-rank-title">{n.title}</span>
              <span className="crm-rank-count">{n.leads} 客户</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
