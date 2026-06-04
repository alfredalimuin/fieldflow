'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const STATUS_BADGE = {
  draft:    { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
  sent:     { bg: '#eff6ff', color: '#1d4ed8', label: 'Sent' },
  viewed:   { bg: '#fefce8', color: '#a16207', label: 'Viewed' },
  accepted: { bg: '#f0fdf4', color: '#15803d', label: 'Accepted' },
  declined: { bg: '#fef2f2', color: '#dc2626', label: 'Declined' },
}

const FILTER_TABS = ['All', 'Draft', 'Sent', 'Viewed', 'Accepted', 'Declined']
const SERVICE_TYPES = ['HVAC', 'Plumbing', 'Electrical', 'Vacuum Truck', 'Handyman', 'Facility Management']

export default function QuotesPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState('All')
  const [serviceFilter, setServiceFilter] = useState('All')
  const [accessToken, setAccessToken] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [toast, setToast] = useState('')
  const [previewQuote, setPreviewQuote] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(null)
  const [sendingQuote, setSendingQuote] = useState(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const importInputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setAccessToken(session.access_token)
      loadQuotes(session.access_token)
      loadTemplates(session.access_token)
    })
  }, [])

  async function loadTemplates(token) {
    const res = await fetch('/api/quote-templates', { headers: { authorization: `Bearer ${token}` } })
    const data = await res.json()
    setTemplates(Array.isArray(data) ? data : [])
  }

  async function loadQuotes(token) {
    const res = await fetch('/api/quotes', { headers: { authorization: `Bearer ${token}` } })
    const data = await res.json()
    setQuotes(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function copyLink(token) {
    navigator.clipboard.writeText(`${window.location.origin}/q/${token}`)
    showToast('Link copied!')
  }

  async function sendQuote(quoteId) {
    setSendingQuote(quoteId)
    try {
      const res = await fetch('/api/send-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ quote_id: quoteId }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Quote sent successfully!')
        loadQuotes(accessToken)
      } else {
        showToast('Failed to send quote: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Send quote error:', error)
      showToast('Error sending quote')
    } finally {
      setSendingQuote(null)
    }
  }

  async function createFromTemplate(templateId) {
    router.push(`/quotes/new?template=${templateId}`)
    setShowTemplateModal(false)
  }

  async function exportQuotePdf(quote) {
    setExportingPdf(quote.id)
    try {
      const element = document.createElement('div')
      element.style.position = 'absolute'
      element.style.left = '-9999px'
      element.style.width = '900px'
      element.style.background = '#fff'
      element.style.padding = '48px'
      element.style.fontFamily = 'system-ui'

      function getSubtotal(items) {
        return (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
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
      const items = (quote.packages && quote.packages.length > 0) ? quote.packages[0].items : quote.items
      const subtotal = getSubtotal(items)
      const discount = getDiscountAmount(subtotal)
      const tax = getTaxAmount(subtotal)
      const total = Math.max(0, subtotal - discount) + tax

      element.innerHTML = `
        <div style="margin-bottom: 32px; border-bottom: 2px solid #1d4ed8; padding-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div>
              <div style="font-size: 28px; font-weight: 800; color: #0f172a;">Field<span style="color: #2563eb;">Flow</span></div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">LVJR Service Solutions Inc.</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 8px;">Quote #</div>
              <div style="font-size: 32px; font-weight: 800; color: #1d4ed8; letter-spacing: -1px;">Q-${String(quote.quote_number || 0).padStart(4, '0')}</div>
            </div>
          </div>
        </div>
        <div style="margin-bottom: 32px;">
          <h1 style="margin: 0 0 12px; font-size: 26px; font-weight: 800; color: #0f172a;">${quote.title || 'Service Quote'}</h1>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
              <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">Prepared For</div>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${quote.client_name || 'N/A'}</div>
            </div>
            <div>
              <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">Date</div>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${new Date(quote.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 32px; padding: 16px; background: #f8fafc; border-radius: 8px;">
          <div>
            <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Service Type</div>
            <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${quote.service_type || '—'}</div>
          </div>
          <div>
            <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Status</div>
            <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${quote.status?.charAt(0).toUpperCase() + quote.status?.slice(1)}</div>
          </div>
        </div>
        <div style="margin-bottom: 32px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase;">Line Items</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="border-bottom: 2px solid #1d4ed8;">
                <th style="text-align: left; padding: 12px 0; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase;">Description</th>
                <th style="text-align: center; padding: 12px 0; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase;">Qty</th>
                <th style="text-align: right; padding: 12px 0; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase;">Unit Price</th>
                <th style="text-align: right; padding: 12px 0; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(items || []).map((item, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 14px 0; font-size: 14px; color: #0f172a;">${item.description || 'Item'}</td>
                  <td style="padding: 14px 0; font-size: 14px; color: #64748b; text-align: center;">${item.qty}</td>
                  <td style="padding: 14px 0; font-size: 14px; color: #64748b; text-align: right;">$${Number(item.unit_price || 0).toFixed(2)}</td>
                  <td style="padding: 14px 0; font-size: 14px; font-weight: 600; color: #0f172a; text-align: right;">$${(Number(item.qty) * Number(item.unit_price)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
          <div style="width: 280px;">
            <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px;">
              <span style="color: #64748b;">Subtotal:</span>
              <span style="color: #0f172a; font-weight: 600;">$${subtotal.toFixed(2)}</span>
            </div>
            ${discount > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px;">
                <span style="color: #64748b;">Discount:</span>
                <span style="color: #dc2626; font-weight: 600;">-$${discount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${tax > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px;">
                <span style="color: #64748b;">Tax (${Number(quote.tax_rate || 0).toFixed(2)}%):</span>
                <span style="color: #0f172a; font-weight: 600;">$${tax.toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 14px 0; border-top: 2px solid #1d4ed8; margin-top: 12px; font-size: 16px; font-weight: 800;">
              <span style="color: #0f172a;">Total:</span>
              <span style="color: #1d4ed8;">$${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      `
      document.body.appendChild(element)
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#fff' })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const imgData = canvas.toDataURL('image/png')
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(`quote-Q-${String(quote.quote_number || 0).padStart(4, '0')}.pdf`)
      document.body.removeChild(element)
      showToast('PDF exported!')
    } catch (error) {
      console.error('PDF export error:', error)
      showToast('Failed to export PDF')
    }
    setExportingPdf(null)
  }

  function exportQuotesCSV() {
    const data = filtered.map(q => ({
      quote_number: `Q-${String(q.quote_number || 0).padStart(4, '0')}`,
      title: q.title || '',
      client_name: q.client_name || '',
      service_type: q.service_type || '',
      total: q.total || 0,
      status: q.status || '',
      created_at: new Date(q.created_at).toLocaleDateString('en-US'),
    }))
    const headers = Object.keys(data[0] || {})
    const csv = [
      headers.join(','),
      ...data.map(r => headers.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quotes-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    showToast('CSV exported!')
  }

  async function importQuotesCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    // For now, just show a message - full import would require API endpoint
    showToast('Quote import feature coming soon!')
    importInputRef.current.value = ''
  }

  async function confirmDelete() {
    await fetch(`/api/quotes?id=${deleteId}`, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } })
    setDeleteId(null); loadQuotes(accessToken); showToast('Quote deleted.')
  }

  const filtered = quotes
    .filter(q => filterTab === 'All' || q.status === filterTab.toLowerCase())
    .filter(q => serviceFilter === 'All' || q.service_type === serviceFilter)
    .filter(q =>
      (q.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (q.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (q.service_type || '').toLowerCase().includes(search.toLowerCase()) ||
      `Q-${String(q.quote_number || 0).padStart(4, '0')}`.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Quotes" actions={
          <button onClick={() => router.push('/quotes/new')}
            style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            + New Quote
          </button>
        } />
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>

          {/* LVJR Branding */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '20px', borderTop: '3px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=375,fit=crop/aQYbNL3MBVFFF50l/copilot_20260507_122149-1kUGGYsxbeXSOq7S.png" alt="LVJR Logo" style={{ height: '32px', objectFit: 'contain' }} />
              <div>
                <h2 style={{ margin: '0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>LVJR Service Solutions Inc.</h2>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>"Facilities never sleep. Neither do we."</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by Q#, client, title, or service…"
              style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '350px', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {FILTER_TABS.map(t => (
                <button key={t} onClick={() => setFilterTab(t)} style={{
                  padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: filterTab === t ? 600 : 400,
                  background: filterTab === t ? '#1d4ed8' : '#f1f5f9',
                  color: filterTab === t ? '#fff' : '#64748b', border: 'none', cursor: 'pointer',
                }}>{t}</button>
              ))}
            </div>
            <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} style={{
              padding: '7px 12px', borderRadius: '8px', fontSize: '13px', background: '#f1f5f9', color: '#64748b',
              border: '1px solid #d1d5db', cursor: 'pointer',
            }}>
              <option value="All">All Services</option>
              {SERVICE_TYPES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => importInputRef.current?.click()}
                style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                📥 Import
              </button>
              <button onClick={exportQuotesCSV}
                style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                📤 Export
              </button>
              <button onClick={() => setShowTemplateModal(true)}
                style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                📄 Template
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px 90px 100px', padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
              {['Quote', 'Client', 'Service', 'Total', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                {search || filterTab !== 'All' ? 'No quotes match your search.' : 'No quotes yet. Create your first one.'}
              </div>
            ) : filtered.map(q => {
              const badge = STATUS_BADGE[q.status] || STATUS_BADGE.draft
              return (
                <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px 90px 100px', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f8fafc', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                      <span style={{ color: '#1d4ed8', fontWeight: 700 }}>Q-{String(q.quote_number || 0).padStart(4, '0')}</span> {q.title || 'Untitled Quote'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#374151' }}>{q.client_name || 'N/A'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{q.service_type || 'Other'}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>${(q.total || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {q.status === 'draft' && (
                      <button onClick={() => sendQuote(q.id)} disabled={sendingQuote === q.id} title="Send quote via email"
                        style={{ padding: '4px 8px', background: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '10px', color: '#fff', fontWeight: 600, cursor: sendingQuote === q.id ? 'not-allowed' : 'pointer', opacity: sendingQuote === q.id ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                        {sendingQuote === q.id ? 'Send...' : 'Send'}
                      </button>
                    )}
                    <button onClick={() => router.push(`/quotes/${q.id}`)} title="View details"
                      style={{ padding: '4px 8px', background: '#eff6ff', border: 'none', borderRadius: '4px', fontSize: '10px', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Details</button>
                    <button onClick={() => setPreviewQuote(q)} title="Preview quote"
                      style={{ padding: '4px 8px', background: '#eff6ff', border: 'none', borderRadius: '4px', fontSize: '10px', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>View</button>
                    <button onClick={() => exportQuotePdf(q)} disabled={exportingPdf === q.id} title="Download PDF"
                      style={{ padding: '4px 8px', background: '#eff6ff', border: 'none', borderRadius: '4px', fontSize: '10px', color: '#1d4ed8', fontWeight: 600, cursor: exportingPdf === q.id ? 'not-allowed' : 'pointer', opacity: exportingPdf === q.id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                      {exportingPdf === q.id ? 'PDF...' : 'PDF'}
                    </button>
                    <button onClick={() => copyLink(q.token)} title="Copy link"
                      style={{ padding: '4px 8px', background: '#eff6ff', border: 'none', borderRadius: '4px', fontSize: '10px', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Link</button>
                    <button onClick={() => router.push(`/quotes/new?id=${q.id}`)} title="Edit quote"
                      style={{ padding: '4px 8px', background: '#f8fafc', border: 'none', borderRadius: '4px', fontSize: '10px', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}>Edit</button>
                    <button onClick={() => setDeleteId(q.id)} title="Delete quote"
                      style={{ padding: '4px 8px', background: '#fef2f2', border: 'none', borderRadius: '4px', fontSize: '10px', color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap' }}>Del</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>{filtered.length} of {quotes.length} quote{quotes.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '360px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Delete Quote?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>This will permanently remove the quote.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#0f172a', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100 }}>
          {toast}
        </div>
      )}

      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowTemplateModal(false)}>
          <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px rgba(0,0,0,0.15)', padding: '28px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Create from Template</h2>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
            </div>

            {templates.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                <p>No templates yet.</p>
                <p style={{ fontSize: '12px' }}>Create a template when editing a quote to use it here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {templates.map(t => (
                  <button key={t.id} onClick={() => createFromTemplate(t.id)} style={{
                    padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                  }} onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe' }} onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{t.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {t.service_type} • {t.items?.length || t.packages?.length || 0} item(s)
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {previewQuote && <QuotePreviewModal quote={previewQuote} onClose={() => setPreviewQuote(null)} />}
    </div>
  )
}

function QuotePreviewModal({ quote, onClose }) {
  function getSubtotal(items) {
    return (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
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

  function getTotal(subtotal) {
    const taxable = Math.max(0, subtotal - getDiscountAmount(subtotal))
    return taxable + getTaxAmount(subtotal)
  }

  const hasPackages = quote.packages && quote.packages.length > 0
  const items = hasPackages ? quote.packages[0].items : quote.items
  const subtotal = getSubtotal(items)
  const discount = getDiscountAmount(subtotal)
  const tax = getTaxAmount(subtotal)
  const total = getTotal(subtotal)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '0px', width: '95%', maxWidth: '900px', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Close Button - Floating */}
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', cursor: 'pointer', width: '40px', height: '40px', borderRadius: '50%', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>×</button>

        {/* Document Body - Like printed page */}
        <div style={{ flex: 1, padding: '48px', background: '#fff', overflowY: 'auto', fontFamily: 'system-ui' }}>

          {/* Header */}
          <div style={{ marginBottom: '32px', borderBottom: '2px solid #1d4ed8', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
                  Field<span style={{ color: '#2563eb' }}>Flow</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>LVJR Service Solutions Inc.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>Quote #</div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#1d4ed8', letterSpacing: '-1px' }}>
                  Q-{String(quote.quote_number || 0).padStart(4, '0')}
                </div>
              </div>
            </div>
          </div>

          {/* Quote Details */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ margin: '0 0 12px', fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
              {quote.title || 'Service Quote'}
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Prepared For</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{quote.client_name}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Date</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  {new Date(quote.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
            {quote.site_name && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Location</div>
                <div style={{ fontSize: '14px', color: '#0f172a' }}>📍 {quote.site_name}</div>
              </div>
            )}
          </div>

          {/* Quote Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '32px', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Service Type</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{quote.service_type || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Status</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{quote.status?.charAt(0).toUpperCase() + quote.status?.slice(1)}</div>
            </div>
            {quote.expires_at && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Valid Until</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  {new Date(quote.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Line Items</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1d4ed8' }}>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontSize: '11px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '12px 0', fontSize: '11px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '11px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>Unit Price</th>
                  <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '11px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '14px 0', fontSize: '14px', color: '#0f172a' }}>{item.description || 'Item'}</td>
                    <td style={{ padding: '14px 0', fontSize: '14px', color: '#64748b', textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ padding: '14px 0', fontSize: '14px', color: '#64748b', textAlign: 'right' }}>${Number(item.unit_price || 0).toFixed(2)}</td>
                    <td style={{ padding: '14px 0', fontSize: '14px', fontWeight: 600, color: '#0f172a', textAlign: 'right' }}>${(Number(item.qty) * Number(item.unit_price)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing Summary - Right aligned box */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
            <div style={{ width: '280px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '14px' }}>
                <span style={{ color: '#64748b' }}>Subtotal:</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Discount:</span>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>-${discount.toFixed(2)}</span>
                </div>
              )}
              {tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Tax ({Number(quote.tax_rate || 0).toFixed(2)}%):</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>${tax.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '2px solid #1d4ed8', marginTop: '12px', fontSize: '16px', fontWeight: 800 }}>
                <span style={{ color: '#0f172a' }}>Total:</span>
                <span style={{ color: '#1d4ed8' }}>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div style={{ marginBottom: '32px', padding: '16px', background: '#f8fafc', borderLeft: '4px solid #1d4ed8', borderRadius: '4px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Notes</div>
              <div style={{ fontSize: '14px', color: '#0f172a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{quote.notes}</div>
            </div>
          )}

          {/* Footer with Action Buttons */}
          <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
              This is a preview of quote Q-{String(quote.quote_number || 0).padStart(4, '0')}. Click outside to close.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
