'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import Topbar from '../../components/Topbar'

const STATUS_BADGE = {
  draft:    { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
  sent:     { bg: '#eff6ff', color: '#1d4ed8', label: 'Sent' },
  viewed:   { bg: '#fefce8', color: '#a16207', label: 'Viewed' },
  accepted: { bg: '#f0fdf4', color: '#15803d', label: 'Accepted' },
  declined: { bg: '#fef2f2', color: '#dc2626', label: 'Declined' },
}

const ACTIVITY_ICONS = {
  created: '✨',
  sent: '📤',
  viewed: '👁️',
  signed: '✍️',
  accepted: '✅',
  declined: '❌',
  job_created: '🔧',
}

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const quoteId = params.id
  const [quote, setQuote] = useState(null)
  const [activity, setActivity] = useState([])
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [creatingJob, setCreatingJob] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setAccessToken(session.access_token)
      await loadQuote(session.access_token)
      await loadActivity(session.access_token)
    })
  }, [quoteId])

  async function loadQuote(token) {
    const res = await fetch('/api/quotes', { headers: { authorization: `Bearer ${token}` } })
    const quotes = await res.json()
    const q = Array.isArray(quotes) ? quotes.find(x => x.id === quoteId) : null
    setQuote(q)
    setLoading(false)
  }

  async function loadActivity(token) {
    const res = await fetch(`/api/quote-activity?quote_id=${quoteId}`, { headers: { authorization: `Bearer ${token}` } })
    const data = await res.json()
    setActivity(Array.isArray(data) ? data : [])
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function downloadHTML() {
    if (!quote) return
    const items = (quote.packages && quote.packages.length > 0) ? quote.packages[0].items : quote.items

    function getSubtotal(itms) {
      return (itms || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
    }
    function getDiscountAmount(subtotal) {
      return quote.discount_type === 'percentage'
        ? subtotal * (Number(quote.discount_value) || 0) / 100
        : Number(quote.discount_value) || 0
    }
    function getTaxAmount(subtotal) {
      const taxable = Math.max(0, subtotal - getDiscountAmount(subtotal))
      return taxable * (Number(quote.tax_rate) || 0) / 100
    }

    const subtotal = getSubtotal(items)
    const discount = getDiscountAmount(subtotal)
    const tax = getTaxAmount(subtotal)
    const total = Math.max(0, subtotal - discount) + tax

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote Q-${String(quote.quote_number || 0).padStart(4, '0')}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 48px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
    .branding { border-top: 4px solid #ef4444; padding-bottom: 20px; margin-bottom: 32px; display: flex; align-items: center; gap: 16px; }
    .branding-logo { height: 50px; }
    .branding-text h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }
    .branding-text p { margin: 4px 0 0; font-size: 13px; color: #64748b; font-style: italic; }
    .header { border-bottom: 2px solid #ef4444; padding-bottom: 20px; margin-bottom: 32px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .quote-number { text-align: right; }
    .quote-number-label { font-size: 13px; color: #94a3b8; font-weight: 600; margin-bottom: 8px; }
    .quote-number-value { font-size: 32px; font-weight: 800; color: #ef4444; letter-spacing: -1px; }
    .quote-title { margin: 0 0 12px; font-size: 26px; font-weight: 800; color: #0f172a; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .detail-item-label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
    .detail-item-value { font-size: 16px; font-weight: 700; color: #0f172a; }
    .info-box { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 32px; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444; }
    .info-box-item-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
    .info-box-item-value { font-size: 14px; font-weight: 600; color: #0f172a; }
    h2 { margin: 0 0 16px; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { text-align: left; padding: 12px 0; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; border-bottom: 2px solid #ef4444; }
    td { padding: 14px 0; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; }
    td.number { text-align: right; color: #64748b; }
    .summary { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .summary-box { width: 280px; }
    .summary-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; }
    .summary-row.total { border-top: 2px solid #ef4444; padding: 14px 0; margin-top: 12px; font-size: 16px; font-weight: 800; }
    .summary-row .label { color: #64748b; }
    .summary-row.total .label { color: #0f172a; }
    .summary-row .value { color: #0f172a; font-weight: 600; }
    .summary-row.total .value { color: #ef4444; }
    .notes-box { margin-bottom: 32px; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; }
    .notes-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
    .notes-content { font-size: 14px; color: #0f172a; line-height: 1.6; white-space: pre-wrap; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="branding">
      <img src="https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=375,fit=crop/aQYbNL3MBVFFF50l/copilot_20260507_122149-1kUGGYsxbeXSOq7S.png" alt="LVJR Logo" class="branding-logo" />
      <div class="branding-text">
        <h2>LVJR Service Solutions Inc.</h2>
        <p>"Facilities never sleep. Neither do we."</p>
      </div>
    </div>

    <div class="header">
      <div class="header-top">
        <div>
          <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Service Quote</div>
          <div style="font-size: 13px; color: #64748b;">13428 Corpus Christi St., Houston, TX 77015 | 832-830-3318</div>
        </div>
        <div class="quote-number">
          <div class="quote-number-label">Quote #</div>
          <div class="quote-number-value">Q-${String(quote.quote_number || 0).padStart(4, '0')}</div>
        </div>
      </div>
    </div>

    <h1 class="quote-title">${quote.title || 'Service Quote'}</h1>

    <div class="details-grid">
      <div>
        <div class="detail-item-label">Prepared For</div>
        <div class="detail-item-value">${quote.client_name || 'N/A'}</div>
      </div>
      <div>
        <div class="detail-item-label">Date</div>
        <div class="detail-item-value">${new Date(quote.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>
    </div>

    <div class="info-box">
      <div>
        <div class="info-box-item-label">Service Type</div>
        <div class="info-box-item-value">${quote.service_type || 'N/A'}</div>
      </div>
      <div>
        <div class="info-box-item-label">Status</div>
        <div class="info-box-item-value">${quote.status?.charAt(0).toUpperCase() + quote.status?.slice(1)}</div>
      </div>
      <div>
        <div class="info-box-item-label">Payment Terms</div>
        <div class="info-box-item-value">${quote.payment_terms || 'N/A'}</div>
      </div>
    </div>

    <h2>Line Items</h2>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="number">Qty</th>
          <th class="number">Unit Price</th>
          <th class="number">Total</th>
        </tr>
      </thead>
      <tbody>
        ${(items || []).map((item, idx) => `
          <tr>
            <td>${item.description || 'Item'}</td>
            <td class="number">${item.qty}</td>
            <td class="number">$${Number(item.unit_price || 0).toFixed(2)}</td>
            <td class="number">$${(Number(item.qty) * Number(item.unit_price)).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-box">
        <div class="summary-row">
          <span class="label">Subtotal:</span>
          <span class="value">$${subtotal.toFixed(2)}</span>
        </div>
        ${discount > 0 ? `
          <div class="summary-row">
            <span class="label">Discount:</span>
            <span class="value" style="color: #dc2626;">-$${discount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${tax > 0 ? `
          <div class="summary-row">
            <span class="label">Tax (${Number(quote.tax_rate || 0).toFixed(2)}%):</span>
            <span class="value">$${tax.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="summary-row total">
          <span class="label">Total:</span>
          <span class="value">$${total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${quote.notes ? `
      <div class="notes-box">
        <div class="notes-label">Notes</div>
        <div class="notes-content">${quote.notes}</div>
      </div>
    ` : ''}

    <div class="footer">
      <p>This is quote Q-${String(quote.quote_number || 0).padStart(4, '0')} for LVJR Service Solutions Inc.</p>
      <p>Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </div>
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quote-Q-${String(quote.quote_number || 0).padStart(4, '0')}.html`
    a.click()
    showToast('HTML downloaded!')
  }

  async function createJobFromQuote() {
    if (!quote) return
    setCreatingJob(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          client_id: quote.client_id,
          client_name: quote.client_name,
          site_id: quote.site_id,
          site_name: quote.site_name,
          title: quote.title || 'Untitled Job',
          service_type: quote.service_type,
          priority: quote.priority || 'standard',
          items: quote.packages && quote.packages.length > 0 ? quote.packages[0].items : quote.items,
          notes: quote.notes,
          quote_id: quote.id,
        }),
      })
      if (res.ok) {
        const job = await res.json()
        showToast(`Job created: ${job.id.slice(0, 8)}...`)
        await loadActivity(accessToken)
      } else {
        const err = await res.json()
        showToast(err.error || 'Failed to create job')
      }
    } catch (error) {
      showToast('Error creating job')
    }
    setCreatingJob(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Quote" />
        <div style={{ flex: 1, padding: '28px 32px', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </div>
    </div>
  )

  if (!quote) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Quote" />
        <div style={{ flex: 1, padding: '28px 32px', textAlign: 'center', color: '#94a3b8' }}>Quote not found</div>
      </div>
    </div>
  )

  const badge = STATUS_BADGE[quote.status] || STATUS_BADGE.draft

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={`Quote Q-${String(quote.quote_number || 0).padStart(4, '0')}`} actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={downloadHTML}
              style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              📋 Download HTML
            </button>
            {quote.status === 'accepted' && (
              <button onClick={createJobFromQuote} disabled={creatingJob}
                style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: creatingJob ? 'not-allowed' : 'pointer', opacity: creatingJob ? 0.6 : 1 }}>
                {creatingJob ? 'Creating…' : '🔧 Create Job'}
              </button>
            )}
            <button onClick={() => router.push(`/quotes/new?id=${quote.id}`)}
              style={{ padding: '8px 16px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              ✏️ Edit
            </button>
          </div>
        } />
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>

          {/* LVJR Branding Header */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '20px', borderTop: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <img src="https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=375,fit=crop/aQYbNL3MBVFFF50l/copilot_20260507_122149-1kUGGYsxbeXSOq7S.png" alt="LVJR Logo" style={{ height: '40px', objectFit: 'contain' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>LVJR Service Solutions Inc.</h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>"Facilities never sleep. Neither do we."</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '11px' }}>
              <div><span style={{ color: '#94a3b8' }}>📍</span> 13428 Corpus Christi St., Houston, TX 77015</div>
              <div><span style={{ color: '#94a3b8' }}>📞</span> 832-830-3318</div>
              <div><span style={{ color: '#94a3b8' }}>📧</span> admin@lvjrservicesolutions.com</div>
            </div>
          </div>

          {/* Quote Details */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
              <div>
                <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{quote.title || 'Untitled Quote'}</h1>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Created {new Date(quote.created_at).toLocaleDateString()}</p>
              </div>
              <span style={{ padding: '6px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>CLIENT</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{quote.client_name}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>SERVICE TYPE</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{quote.service_type || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>TOTAL</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#2563eb' }}>${(quote.total || 0).toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>PAYMENT TERMS</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{quote.payment_terms || '—'}</div>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          {activity.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Activity Log</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #2563eb' }}>
                    <div style={{ fontSize: '18px' }}>{ACTIVITY_ICONS[a.action] || '📝'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>{a.action.replace(/_/g, ' ')}</div>
                      {a.description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{a.description}</div>}
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#0f172a', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
