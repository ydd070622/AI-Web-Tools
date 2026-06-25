import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { SharedProps, FollowUp } from './types'
import { avatarGrad, fmtDate } from './helpers'

export default function Workbench({ data, followUps, todayCount, overdueCount, closedCusts, updateCust, setEditingCustomer, setEditingNote, setTab }: SharedProps) {
  const active = data.customers.filter(c => c.stage !== 'closed')
  const closed = closedCusts.length

  const today = new Date().toISOString().split('T')[0]
  // Split: overdue (before today) vs on-time (today) vs future
  const overdueFU = followUps.filter(c => c.followUpDate < today)
  const ontimeFU = followUps.filter(c => c.followUpDate === today)
  const futureFU = followUps.filter(c => c.followUpDate > today)

  const [expandedFuId, setExpandedFuId] = useState<string | null>(null)
  const [fuNote, setFuNote] = useState('')
  const [fuDate, setFuDate] = useState('')

  const openFU = (id: string, _note: string, date: string) => {
    if (expandedFuId === id) { setExpandedFuId(null); return }
    setExpandedFuId(id)
    setFuNote('')
    setFuDate(date || today)
  }

  const markDone = (id: string) => {
    const cust = data.customers.find(c => c.id === id)
    const existingHistory = cust?.followUpHistory ?? []
    const todayStr = new Date().toISOString().split('T')[0]
    const newEntry: FollowUp = {
      id: 'fu_' + Date.now(),
      date: todayStr,
      content: '已完成跟进',
      nextDate: undefined,
    }
    updateCust(id, {
      followUpDate: '',
      followUpNote: cust?.followUpNote || '',
      followUpHistory: [...existingHistory, newEntry],
    })
    toast.success(`已标记完成 · ${cust?.name || ''}`)
  }

  const doneFU = (id: string, newStage?: string) => {
    const cust = data.customers.find(c => c.id === id)
    const existingHistory = cust?.followUpHistory ?? []
    const todayStr = new Date().toISOString().split('T')[0]
    const newEntry: FollowUp = {
      id: 'fu_' + Date.now(),
      date: todayStr,
      content: fuNote || (newStage === 'closed' ? '已成交' : '完成跟进'),
      nextDate: newStage === 'closed' ? undefined : (fuDate || undefined),
    }

    if (newStage === 'closed') {
      const amt = prompt('成交金额（元）：', '28000')
      if (!amt) return
      const dealAmount = parseInt(amt) || 0
      updateCust(id, {
        stage: 'closed', followUpNote: fuNote || '已成交', followUpDate: '',
        dealAmount, contractStatus: 'signed',
        paymentPlan: [
          { id: 'p_dep_' + Date.now(), label: '定金', amount: Math.round(dealAmount * 0.3), paid: false, date: '' },
          { id: 'p_pro_' + Date.now(), label: '进度款', amount: Math.round(dealAmount * 0.4), paid: false, date: '' },
          { id: 'p_fin_' + Date.now(), label: '尾款', amount: dealAmount - Math.round(dealAmount * 0.3) - Math.round(dealAmount * 0.4), paid: false, date: '' },
        ],
        followUpHistory: [...existingHistory, newEntry],
      })
      toast.success(`已成交 ¥${dealAmount.toLocaleString()} · ${cust?.name || ''}`)
    } else {
      updateCust(id, {
        followUpNote: fuNote || (cust?.followUpNote || ''),
        followUpDate: fuDate,
        followUpHistory: [...existingHistory, newEntry],
      })
      toast.success(`已记录跟进 · ${cust?.name || ''}`)
    }
    setExpandedFuId(null)
  }

  // Helper: Chinese weekday name
  const weekdayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  }

  // Helper: month label from date string
  const monthLabel = (dateStr: string) => {
    const p = dateStr.split('-')
    return `${parseInt(p[1])}月`
  }

  // Helper: day from date string
  const dayNum = (dateStr: string) => dateStr.split('-')[2]

  return (
    <div className="wb-v3">

      {/* Metric Cards */}
      <div className="wb-v3-metrics">
        <div className="wb-v3-metric">
          <div className="wb-v3-metric-icon" style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8' }}>👥</div>
          <div><div className="wb-v3-metric-value">{active.length}</div><div className="wb-v3-metric-label">全部客户</div></div>
        </div>
        <div className="wb-v3-metric">
          <div className="wb-v3-metric-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>⏰</div>
          <div><div className="wb-v3-metric-value" style={{ color: '#fbbf24' }}>{followUps.length}</div><div className="wb-v3-metric-label">待跟进</div></div>
        </div>
        <div className="wb-v3-metric">
          <div className="wb-v3-metric-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>✅</div>
          <div><div className="wb-v3-metric-value" style={{ color: '#4ade80' }}>{closed}</div><div className="wb-v3-metric-label">已成交</div></div>
        </div>
      </div>

      {/* Follow-up Timeline */}
      <div className="wb-v3-card">
        <div className="wb-v3-card-body">

          {/* Overdue */}
          {overdueFU.length > 0 && (
            <>
              <div className="wb-v3-section">
                <span className="wb-v3-section-badge overdue">已逾期</span>
                <div className="wb-v3-section-line" />
              </div>
              {overdueFU.map(c => {
                const [g1, g2] = avatarGrad(c.name)
                const isOpen = expandedFuId === c.id
                return (
                  <div key={c.id}>
                    <div className="wb-v3-fu-card urgent">
                      <div className="wb-v3-fu-date overdue">
                        <div className="wb-v3-fu-day">{dayNum(c.followUpDate)}</div>
                        <div className="wb-v3-fu-month">{monthLabel(c.followUpDate)} · {weekdayName(c.followUpDate)}</div>
                      </div>
                      <div className="wb-v3-fu-body">
                        <div className="wb-v3-fu-top">
                          <div className="wb-v3-fu-av" style={{ background: `linear-gradient(135deg,${g1},${g2})` }}>{c.name[0]}</div>
                          <span className="wb-v3-fu-name">{c.name}</span>
                        </div>
                        <div className={`wb-v3-fu-note${!c.followUpNote ? ' empty' : ''}`}>
                          {c.followUpNote || '暂无跟进备注'}
                        </div>
                      </div>
                      <div className="wb-v3-fu-actions">
                        <button className="wb-v3-fu-btn done" onClick={e => { e.stopPropagation(); markDone(c.id) }}>✓ 完成</button>
                        <button className="wb-v3-fu-btn edit" onClick={e => { e.stopPropagation(); openFU(c.id, c.followUpNote, c.followUpDate || today) }}>编辑</button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div className="wb-v3-fu-inline" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()}>
                          <div className="wb-v3-fu-inline-row">
                            <div className="wb-v3-fu-inline-group" style={{ flex: 2 }}>
                              <label className="wb-v3-fu-inline-label">跟进备注</label>
                              <textarea className="wb-v3-fu-inline-input" value={fuNote} onChange={e => setFuNote(e.target.value)} />
                            </div>
                            <div className="wb-v3-fu-inline-group">
                              <label className="wb-v3-fu-inline-label">下次跟进</label>
                              <input type="date" className="wb-v3-fu-inline-input" value={fuDate} onChange={e => setFuDate(e.target.value)} />
                            </div>
                          </div>
                          <div className="wb-v3-fu-inline-actions">
                            <button className="wb-v3-fu-btn edit" onClick={() => doneFU(c.id, 'closed')}>已成交</button>
                            <button className="wb-v3-fu-btn done" onClick={() => doneFU(c.id)}>保存跟进</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </>
          )}

          {/* Today */}
          {ontimeFU.length > 0 && (
            <>
              <div className="wb-v3-section">
                <span className="wb-v3-section-badge today">今天 {fmtDate(today)}</span>
                <div className="wb-v3-section-line" />
              </div>
              {ontimeFU.map(c => {
                const [g1, g2] = avatarGrad(c.name)
                const isOpen = expandedFuId === c.id
                return (
                  <div key={c.id}>
                    <div className="wb-v3-fu-card warn">
                      <div className="wb-v3-fu-date today">
                        <div className="wb-v3-fu-day">{dayNum(c.followUpDate)}</div>
                        <div className="wb-v3-fu-month">{monthLabel(c.followUpDate)} · {weekdayName(c.followUpDate)}</div>
                      </div>
                      <div className="wb-v3-fu-body">
                        <div className="wb-v3-fu-top">
                          <div className="wb-v3-fu-av" style={{ background: `linear-gradient(135deg,${g1},${g2})` }}>{c.name[0]}</div>
                          <span className="wb-v3-fu-name">{c.name}</span>
                        </div>
                        <div className={`wb-v3-fu-note${!c.followUpNote ? ' empty' : ''}`}>
                          {c.followUpNote || '暂无跟进备注'}
                        </div>
                      </div>
                      <div className="wb-v3-fu-actions">
                        <button className="wb-v3-fu-btn done" onClick={e => { e.stopPropagation(); markDone(c.id) }}>✓ 完成</button>
                        <button className="wb-v3-fu-btn edit" onClick={e => { e.stopPropagation(); openFU(c.id, c.followUpNote, c.followUpDate || today) }}>编辑</button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div className="wb-v3-fu-inline" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()}>
                          <div className="wb-v3-fu-inline-row">
                            <div className="wb-v3-fu-inline-group" style={{ flex: 2 }}>
                              <label className="wb-v3-fu-inline-label">跟进备注</label>
                              <textarea className="wb-v3-fu-inline-input" value={fuNote} onChange={e => setFuNote(e.target.value)} />
                            </div>
                            <div className="wb-v3-fu-inline-group">
                              <label className="wb-v3-fu-inline-label">下次跟进</label>
                              <input type="date" className="wb-v3-fu-inline-input" value={fuDate} onChange={e => setFuDate(e.target.value)} />
                            </div>
                          </div>
                          <div className="wb-v3-fu-inline-actions">
                            <button className="wb-v3-fu-btn edit" onClick={() => doneFU(c.id, 'closed')}>已成交</button>
                            <button className="wb-v3-fu-btn done" onClick={() => doneFU(c.id)}>保存跟进</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </>
          )}

          {/* Upcoming */}
          {futureFU.length > 0 && (
            <>
              <div className="wb-v3-section" style={{ marginTop: 4 }}>
                <span className="wb-v3-section-badge upcoming">即将跟进</span>
                <div className="wb-v3-section-line" />
              </div>
              {futureFU.map(c => {
                const [g1, g2] = avatarGrad(c.name)
                const isOpen = expandedFuId === c.id
                return (
                  <div key={c.id}>
                    <div className="wb-v3-fu-card">
                      <div className="wb-v3-fu-date upcoming">
                        <div className="wb-v3-fu-day">{dayNum(c.followUpDate)}</div>
                        <div className="wb-v3-fu-month">{monthLabel(c.followUpDate)} · {weekdayName(c.followUpDate)}</div>
                      </div>
                      <div className="wb-v3-fu-body">
                        <div className="wb-v3-fu-top">
                          <div className="wb-v3-fu-av" style={{ background: `linear-gradient(135deg,${g1},${g2})` }}>{c.name[0]}</div>
                          <span className="wb-v3-fu-name">{c.name}</span>
                        </div>
                        <div className={`wb-v3-fu-note${!c.followUpNote ? ' empty' : ''}`}>
                          {c.followUpNote || '暂无跟进备注'}
                        </div>
                      </div>
                      <div className="wb-v3-fu-actions">
                        <button className="wb-v3-fu-btn done" onClick={e => { e.stopPropagation(); markDone(c.id) }}>✓ 完成</button>
                        <button className="wb-v3-fu-btn edit" onClick={e => { e.stopPropagation(); openFU(c.id, c.followUpNote, c.followUpDate || today) }}>编辑</button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div className="wb-v3-fu-inline" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()}>
                          <div className="wb-v3-fu-inline-row">
                            <div className="wb-v3-fu-inline-group" style={{ flex: 2 }}>
                              <label className="wb-v3-fu-inline-label">跟进备注</label>
                              <textarea className="wb-v3-fu-inline-input" value={fuNote} onChange={e => setFuNote(e.target.value)} />
                            </div>
                            <div className="wb-v3-fu-inline-group">
                              <label className="wb-v3-fu-inline-label">下次跟进</label>
                              <input type="date" className="wb-v3-fu-inline-input" value={fuDate} onChange={e => setFuDate(e.target.value)} />
                            </div>
                          </div>
                          <div className="wb-v3-fu-inline-actions">
                            <button className="wb-v3-fu-btn edit" onClick={() => doneFU(c.id, 'closed')}>已成交</button>
                            <button className="wb-v3-fu-btn done" onClick={() => doneFU(c.id)}>保存跟进</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </>
          )}

          {followUps.length === 0 && (
            <div className="wb-v3-empty">🎉 暂无待跟进客户</div>
          )}

        </div>
      </div>

    </div>
  )
}
