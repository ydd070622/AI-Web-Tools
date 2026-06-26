import type { SharedProps } from './types'

export default function DashboardPage({ data, todayCount, closedCusts }: SharedProps) {
  const total = data.customers.filter(c => c.stage !== 'closed').length
  const closed = data.customers.filter(c => c.stage === 'closed').length
  const revenue = closedCusts.reduce((s, c) => s + (c.dealAmount || 0), 0)
  const paid = closedCusts.reduce((s, c) => s + (c.paymentPlan || []).filter(p => p.paid).reduce((ss, p) => ss + p.amount, 0), 0)

  const stages = [
    { label: '留资/咨询', count: data.customers.filter(c => ['lead'].includes(c.stage)).length, color: '#3b82f6' },
    { label: '已加微信', count: data.customers.filter(c => ['wechat'].includes(c.stage)).length, color: '#8b5cf6' },
    { label: '深入沟通', count: data.customers.filter(c => ['communicating'].includes(c.stage)).length, color: '#6366f1' },
    { label: '报价/跟进', count: data.customers.filter(c => ['followup'].includes(c.stage)).length, color: '#f59e0b' },
    { label: '成交', count: closed, color: '#22c55e' },
  ]

  return (
    <div>
      {/* KPI Cards — 5 个均分整行 */}
      <div className="crm-kpi-grid">
        <div className="crm-kpi-card accent"><span className="crm-kpi-label">总客户</span><span className="crm-kpi-value">{total}</span></div>
        <div className="crm-kpi-card warn"><span className="crm-kpi-label">今日待跟进</span><span className="crm-kpi-value">{todayCount}</span></div>
        <div className="crm-kpi-card success"><span className="crm-kpi-label">已成交</span><span className="crm-kpi-value">{closed}</span></div>
        <div className="crm-kpi-card success"><span className="crm-kpi-label">总成交额</span><span className="crm-kpi-value" style={{ fontSize: 18 }}>¥{(revenue / 10000).toFixed(1)}<span style={{ fontSize: 12, fontWeight: 500 }}>万</span></span></div>
        <div className="crm-kpi-card success"><span className="crm-kpi-label">已回款</span><span className="crm-kpi-value" style={{ fontSize: 18 }}>¥{(paid / 10000).toFixed(1)}<span style={{ fontSize: 12, fontWeight: 500 }}>万</span></span></div>
      </div>

      {/* 转化漏斗 — 可视化梯形漏斗 */}
      <div className="crm-section" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="crm-section-header">
          <span className="crm-section-title">转化漏斗</span>
        </div>
        <div className="crm-funnel-visual">
          {stages.map((s, i) => {
            const pct = stages[0].count > 0 ? Math.round(s.count / stages[0].count * 100) : 0
            const prevCount = i > 0 ? stages[i - 1].count : s.count
            const rate = i > 0 && prevCount > 0 ? Math.round(s.count / prevCount * 100) : null
            return (
              <div key={s.label} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {i > 0 && (
                  <>
                    <div className="crm-funnel-rate-badge" style={{ color: s.color }}>
                      {rate}% 转化
                    </div>
                    <div className="crm-funnel-arrow" style={{ borderTopColor: stages[i - 1].color }} />
                  </>
                )}
                <div
                  className="crm-funnel-bar"
                  style={{
                    width: `${Math.max(pct, 12)}%`,
                    background: `linear-gradient(135deg, ${s.color}, ${s.color}dd)`,
                  }}
                >
                  <span className="crm-funnel-bar-label">{s.label}</span>
                  <span className="crm-funnel-bar-count">{s.count} 人</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
