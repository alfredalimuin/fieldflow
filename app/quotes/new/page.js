'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import Topbar from '../../components/Topbar'

const SERVICE_TYPES = ['HVAC', 'Plumbing', 'Electrical', 'Vacuum Truck', 'Handyman', 'Facility Management']
const PRIORITIES = [
  { value: 'emergency', label: '🔴 Emergency (< 2hr)' },
  { value: 'urgent', label: '🟠 Urgent' },
  { value: 'standard', label: '🟢 Standard' },
  { value: 'preventive', label: '🔵 Preventive Maintenance' },
]
const PAYMENT_TERMS = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'custom', label: 'Custom (see notes)' },
]
const RECURRENCE_FREQ = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }
const selectStyle = { ...inputStyle, color: '#374151', background: '#fff' }
const labelStyle = { fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }
const cardStyle = { background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '16px' }

function LineItems({ items, onChange, onAdd, onRemove }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 120px 100px 32px', gap: '8px', marginBottom: '6px' }}>
        {['Description', 'Qty', 'Unit Price', 'Total', ''].map(h => (
          <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</div>
        ))}
      </div>
      {items.map((item, i) => {
        const total = (Number(item.qty) || 0) * (Number(item.unit_price) || 0)
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 120px 100px 32px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <input value={item.description} onChange={e => onChange(i, 'description', e.target.value)}
              placeholder="Description of work"
              style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
            <input value={item.qty} onChange={e => onChange(i, 'qty', e.target.value)}
              type="number" min="0" placeholder="1"
              style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
            <input value={item.unit_price} onChange={e => onChange(i, 'unit_price', e.target.value)}
              type="number" min="0" step="0.01" placeholder="0.00"
              style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
            <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', color: '#374151' }}>
              ${total.toFixed(2)}
            </div>
            <button onClick={() => onRemove(i)}
              style={{ width: '32px', height: '32px', background: '#fef2f2', border: 'none', borderRadius: '6px', color: '#dc2626', cursor: 'pointer', fontSize: '16px' }}>×</button>
          </div>
        )
      })}
      <button onClick={onAdd}
        style={{ padding: '7px 14px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer', marginTop: '4px' }}>
        + Add Line Item
      </button>
    </div>
  )
}

function QuoteFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const templateId = searchParams.get('template')
  const fileInputRef = useRef(null)
  const quoteContainerRef = useRef(null)

  const [accessToken, setAccessToken] = useState('')
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientId, setClientId] = useState('')
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState('')

  const [templates, setTemplates] = useState([])
  const [quoteId, setQuoteId] = useState(editId || null)
  const [quoteToken, setQuoteToken] = useState('')
  const [quoteNumber, setQuoteNumber] = useState(null)

  const [title, setTitle] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [priority, setPriority] = useState('standard')
  const [expiresAt, setExpiresAt] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('due_on_receipt')
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState([{ description: '', qty: 1, unit_price: '' }])
  const [isMultiPackage, setIsMultiPackage] = useState(false)
  const [packages, setPackages] = useState([
    { id: 'pkg_1', name: 'Basic Option', description: '', items: [{ description: '', qty: 1, unit_price: '' }] },
    { id: 'pkg_2', name: 'Standard Option', description: '', items: [{ description: '', qty: 1, unit_price: '' }] },
  ])

  const [discountType, setDiscountType] = useState('fixed')
  const [discountValue, setDiscountValue] = useState('')
  const [taxRate, setTaxRate] = useState('8.25')

  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('monthly')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  const [attachments, setAttachments] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  function getSubtotal(itms) {
    return (itms || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  }
  function getDiscountAmount(subtotal) {
    return discountType === 'percentage'
      ? subtotal * (Number(discountValue) || 0) / 100
      : Number(discountValue) || 0
  }
  function getTaxAmount(subtotal) {
    const taxable = subtotal - getDiscountAmount(subtotal)
    return Math.max(0, taxable) * (Number(taxRate) || 0) / 100
  }
  function getTotal(subtotal) {
    const taxable = subtotal - getDiscountAmount(subtotal)
    return Math.max(0, taxable) + getTaxAmount(subtotal)
  }

  const simpleSubtotal = getSubtotal(items)
  const simpleTotal = getTotal(simpleSubtotal)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setAccessToken(session.access_token)
      const cRes = await fetch('/api/clients', { headers: { authorization: `Bearer ${session.access_token}` } })
      const cData = await cRes.json()
      setClients(Array.isArray(cData) ? cData : [])

      const tRes = await fetch('/api/quote-templates', { headers: { authorization: `Bearer ${session.access_token}` } })
      const tData = await tRes.json()
      setTemplates(Array.isArray(tData) ? tData : [])

      if (templateId) {
        const tmpl = Array.isArray(tData) ? tData.find(x => x.id === templateId) : null
        if (tmpl) applyTemplateData(tmpl)
      } else if (editId) {
        const qRes = await fetch('/api/quotes', { headers: { authorization: `Bearer ${session.access_token}` } })
        const qData = await qRes.json()
        const q = (Array.isArray(qData) ? qData : []).find(x => x.id === editId)
        if (q) {
          setTitle(q.title || ''); setServiceType(q.service_type || ''); setPriority(q.priority || 'standard')
          setExpiresAt(q.expires_at || ''); setPaymentTerms(q.payment_terms || 'due_on_receipt'); setNotes(q.notes || '')
          setClientId(q.client_id || ''); setSiteId(q.site_id || '')
          setDiscountType(q.discount_type || 'fixed'); setDiscountValue(q.discount_value || '')
          setTaxRate(q.tax_rate !== undefined ? String(q.tax_rate) : '8.25')
          setAttachments(q.attachments || [])
          setQuoteToken(q.token || ''); setQuoteId(q.id); setQuoteNumber(q.quote_number)
          setIsRecurring(q.is_recurring || false); setRecurrenceFrequency(q.recurrence_frequency || 'monthly')
          setRecurrenceEndDate(q.recurrence_end_date || '')
          if (q.packages && q.packages.length > 0) {
            setIsMultiPackage(true); setPackages(q.packages)
          } else {
            setItems(q.items?.length ? q.items : [{ description: '', qty: 1, unit_price: '' }])
          }
        }
      }
    })
  }, [editId])

  useEffect(() => {
    if (!clientId) { setSelectedClient(null); setSites([]); setSiteId(''); return }
    const c = clients.find(x => x.id === clientId)
    setSelectedClient(c || null)
    if (accessToken && clientId) {
      fetch(`/api/client-sites?client_id=${clientId}`, { headers: { authorization: `Bearer ${accessToken}` } })
        .then(r => r.json()).then(d => setSites(Array.isArray(d) ? d : []))
    }
  }, [clientId, clients, accessToken])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function updateItem(i, field, val) { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it)) }
  function removeItem(i) { if (items.length === 1) return; setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function addItem() { setItems(prev => [...prev, { description: '', qty: 1, unit_price: '' }]) }

  function updatePkgField(pkgIdx, field, val) {
    setPackages(prev => prev.map((p, i) => i === pkgIdx ? { ...p, [field]: val } : p))
  }
  function updatePkgItem(pkgIdx, itemIdx, field, val) {
    setPackages(prev => prev.map((p, i) => i !== pkgIdx ? p : {
      ...p, items: p.items.map((it, j) => j === itemIdx ? { ...it, [field]: val } : it)
    }))
  }
  function addPkgItem(pkgIdx) {
    setPackages(prev => prev.map((p, i) => i !== pkgIdx ? p : { ...p, items: [...p.items, { description: '', qty: 1, unit_price: '' }] }))
  }
  function removePkgItem(pkgIdx, itemIdx) {
    setPackages(prev => prev.map((p, i) => i !== pkgIdx ? p : { ...p, items: p.items.filter((_, j) => j !== itemIdx) }))
  }
  function addPackage() {
    if (packages.length >= 4) { showToast('Maximum 4 options allowed.'); return }
    const id = `pkg_${Date.now()}`
    setPackages(prev => [...prev, { id, name: `Option ${prev.length + 1}`, description: '', items: [{ description: '', qty: 1, unit_price: '' }] }])
  }
  function removePackage(pkgIdx) {
    if (packages.length <= 2) { showToast('Minimum 2 options required.'); return }
    setPackages(prev => prev.filter((_, i) => i !== pkgIdx))
  }

  function toggleMultiPackage() {
    if (!isMultiPackage) {
      setIsMultiPackage(true)
      setPackages([
        { id: 'pkg_1', name: 'Basic Option', description: '', items: items.length ? items : [{ description: '', qty: 1, unit_price: '' }] },
        { id: 'pkg_2', name: 'Standard Option', description: '', items: [{ description: '', qty: 1, unit_price: '' }] },
      ])
    } else {
      setIsMultiPackage(false)
      setItems(packages[0]?.items?.length ? packages[0].items : [{ description: '', qty: 1, unit_price: '' }])
    }
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files)
    for (const file of files) {
      if (attachments.length >= 5) { showToast('Maximum 5 photos allowed.'); break }
      setUploadingPhoto(true)
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/quote-upload', { method: 'POST', headers: { authorization: `Bearer ${accessToken}` }, body: fd })
      const data = await res.json()
      setUploadingPhoto(false)
      if (res.ok) setAttachments(prev => [...prev, data.url])
      else showToast(data.error || 'Upload failed.')
    }
    e.target.value = ''
  }

  function applyTemplateData(template) {
    if (!template) return
    setTitle('')
    setServiceType(template.service_type || '')
    setNotes(template.notes || '')
    setTaxRate(String(template.tax_rate || 8.25))
    setPaymentTerms(template.payment_terms || 'due_on_receipt')
    setDiscountType(template.discount_type || 'fixed')
    setDiscountValue(template.discount_value || '')
    if (template.packages && template.packages.length > 0) {
      setIsMultiPackage(true)
      setPackages(template.packages)
    } else {
      setIsMultiPackage(false)
      setItems(template.items?.length ? template.items : [{ description: '', qty: 1, unit_price: '' }])
    }
  }

  async function applyTemplate(templateId) {
    const template = templates.find(t => t.id === templateId)
    if (!template) return
    applyTemplateData(template)
    showToast('Template applied!')
  }

  async function saveAsTemplate() {
    if (!templateName.trim()) { showToast('Template name is required.'); return }
    const payload = {
      name: templateName,
      service_type: serviceType,
      items: isMultiPackage ? [] : items,
      packages: isMultiPackage ? packages : [],
      notes,
      tax_rate: Number(taxRate) || 8.25,
      payment_terms: paymentTerms,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
    }
    const res = await fetch('/api/quote-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      showToast('Template saved!')
      setTemplateName('')
      setShowSaveTemplate(false)
      const tRes = await fetch('/api/quote-templates', { headers: { authorization: `Bearer ${accessToken}` } })
      const tData = await tRes.json()
      setTemplates(Array.isArray(tData) ? tData : [])
    } else {
      const d = await res.json()
      showToast(d.error || 'Error saving template.')
    }
  }

  async function exportPDF() {
    const { jsPDF } = await import('jspdf')
    const html2canvas = (await import('html2canvas')).default

    const element = quoteContainerRef.current
    const canvas = await html2canvas(element, { scale: 2, allowTaint: true, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const imgWidth = 210
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= 297
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= 297
    }
    pdf.save(`quote-${quoteNumber || 'draft'}.pdf`)
    showToast('PDF exported!')
  }

  async function save(status) {
    if (!clientId) { showToast('Please select a client.'); return }
    setSaving(true)
    const site = sites.find(s => s.id === siteId)
    const payload = {
      client_id: clientId, client_name: selectedClient?.company_name || '',
      client_email: selectedClient?.contact_email || '',
      site_id: siteId || null, site_name: site?.name || null,
      title, service_type: serviceType, priority,
      expires_at: expiresAt || null, notes, payment_terms: paymentTerms,
      items: isMultiPackage ? [] : items,
      packages: isMultiPackage ? packages : [],
      discount_type: discountType, discount_value: Number(discountValue) || 0,
      tax_rate: Number(taxRate) || 8.25,
      attachments,
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? recurrenceFrequency : null,
      recurrence_end_date: isRecurring ? recurrenceEndDate : null,
      status,
    }
    let res
    if (quoteId) {
      res = await fetch('/api/quotes', { method: 'PUT', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ id: quoteId, ...payload }) })
    } else {
      res = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify(payload) })
    }
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setQuoteId(data.id); setQuoteToken(data.token || quoteToken); setQuoteNumber(data.quote_number)

      // Log activity if new quote
      if (!quoteId) {
        await fetch('/api/quote-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            quote_id: data.id,
            action: 'created',
            description: `Quote created: ${data.title || 'Untitled'}`,
          }),
        }).catch(() => {})
      }

      showToast(status === 'sent' ? 'Quote created!' : 'Saved as draft.')
      if (status === 'sent') setTimeout(() => router.push('/quotes'), 1200)
    } else { showToast(data.error || 'Error saving.') }
  }

  function copyLink() {
    if (!quoteToken) { showToast('Save first to get a link.'); return }
    navigator.clipboard.writeText(`${window.location.origin}/q/${quoteToken}`)
    showToast('Link copied!')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={editId ? 'Edit Quote' : 'New Quote'} actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {quoteToken && (
              <>
                <button onClick={exportPDF} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>📥 PDF</button>
                <button onClick={copyLink} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Copy Link</button>
              </>
            )}
            <button onClick={() => save('draft')} disabled={saving}
              style={{ padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>Save Draft</button>
            <button onClick={() => save('sent')} disabled={saving}
              style={{ padding: '7px 14px', background: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Create Quote</button>
          </div>
        } />

        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          <div ref={quoteContainerRef} style={{ maxWidth: '820px' }}>

            {/* LVJR Branding */}
            <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '20px', borderTop: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img src="https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=375,fit=crop/aQYbNL3MBVFFF50l/copilot_20260507_122149-1kUGGYsxbeXSOq7S.png" alt="LVJR Logo" style={{ height: '40px', objectFit: 'contain' }} />
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>LVJR Service Solutions Inc.</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>"Facilities never sleep. Neither do we."</p>
                </div>
              </div>
            </div>

            {templates.length > 0 && (
              <div style={cardStyle}>
                <label style={labelStyle}>Use a Template (Optional)</label>
                <select onChange={e => { if (e.target.value) applyTemplate(e.target.value); e.target.value = '' }} style={selectStyle}>
                  <option value="">— Select a template to apply —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Quote Details</h3>
                {quoteNumber && (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '4px 12px', borderRadius: '99px' }}>
                    Q-{String(quoteNumber).padStart(4, '0')}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. HVAC Preventive Maintenance — Building A" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Client *</label>
                  <select value={clientId} onChange={e => { setClientId(e.target.value); setSiteId('') }} style={selectStyle}>
                    <option value="">— Select client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Service Site</label>
                  <select value={siteId} onChange={e => setSiteId(e.target.value)} style={selectStyle} disabled={!clientId || sites.length === 0}>
                    <option value="">— Select site (optional) —</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Service Type</label>
                  <select value={serviceType} onChange={e => setServiceType(e.target.value)} style={selectStyle}>
                    <option value="">— Select service —</option>
                    {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Valid Until</label>
                  <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Payment Terms</label>
                <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} style={selectStyle}>
                  {PAYMENT_TERMS.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                </select>
              </div>

              {selectedClient && (
                <div style={{ marginTop: '16px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>CLIENT</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{selectedClient.company_name}</div>
                  </div>
                  {selectedClient.contact_name && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>CONTACT</div>
                      <div style={{ fontSize: '13px', color: '#374151' }}>{selectedClient.contact_name}</div>
                    </div>
                  )}
                  {selectedClient.contact_email && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>EMAIL</div>
                      <div style={{ fontSize: '13px', color: '#374151' }}>{selectedClient.contact_email}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {isMultiPackage ? 'Quote Options' : 'Line Items'}
                </h3>
                <button onClick={toggleMultiPackage} style={{
                  padding: '6px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                  background: isMultiPackage ? '#fef2f2' : '#eff6ff',
                  color: isMultiPackage ? '#dc2626' : '#1d4ed8',
                  border: `1px solid ${isMultiPackage ? '#fecaca' : '#bfdbfe'}`,
                }}>
                  {isMultiPackage ? '× Use Simple Quote' : '+ Multiple Options (Good/Better/Best)'}
                </button>
              </div>

              {!isMultiPackage ? (
                <>
                  <LineItems items={items} onChange={updateItem} onAdd={addItem} onRemove={removeItem} />
                  <div style={{ textAlign: 'right', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Subtotal: </span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>${simpleSubtotal.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div>
                  {packages.map((pkg, pkgIdx) => {
                    const pkgSubtotal = getSubtotal(pkg.items)
                    return (
                      <div key={pkg.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '16px', background: '#fafafa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1d4ed8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>{pkgIdx + 1}</span>
                            <input value={pkg.name} onChange={e => updatePkgField(pkgIdx, 'name', e.target.value)}
                              placeholder="Option name (e.g. Basic, Standard, Premium)"
                              style={{ ...inputStyle, fontWeight: 700, fontSize: '15px' }} />
                          </div>
                          {packages.length > 2 && (
                            <button onClick={() => removePackage(pkgIdx)} style={{ marginLeft: '10px', padding: '4px 10px', background: '#fef2f2', border: 'none', borderRadius: '6px', color: '#dc2626', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                          )}
                        </div>
                        <div style={{ marginBottom: '14px' }}>
                          <input value={pkg.description} onChange={e => updatePkgField(pkgIdx, 'description', e.target.value)}
                            placeholder="Brief description of what this option includes…"
                            style={{ ...inputStyle, fontSize: '13px', color: '#64748b' }} />
                        </div>
                        <LineItems
                          items={pkg.items}
                          onChange={(i, f, v) => updatePkgItem(pkgIdx, i, f, v)}
                          onAdd={() => addPkgItem(pkgIdx)}
                          onRemove={(i) => removePkgItem(pkgIdx, i)}
                        />
                        <div style={{ textAlign: 'right', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>Option subtotal: </span>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>${pkgSubtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })}
                  {packages.length < 4 && (
                    <button onClick={addPackage} style={{ width: '100%', padding: '10px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                      + Add Another Option
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Pricing</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Discount</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={discountType} onChange={e => setDiscountType(e.target.value)}
                      style={{ ...selectStyle, width: '130px', flexShrink: 0 }}>
                      <option value="fixed">$ Fixed</option>
                      <option value="percentage">% Percentage</option>
                    </select>
                    <input value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                      type="number" min="0" step="0.01"
                      placeholder={discountType === 'percentage' ? '0' : '0.00'}
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Tax Rate (%)</label>
                  <input value={taxRate} onChange={e => setTaxRate(e.target.value)}
                    type="number" min="0" step="0.01" placeholder="8.25"
                    style={inputStyle} />
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Texas default: 8.25%</div>
                </div>
              </div>

              {!isMultiPackage && (
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px' }}>
                  {[
                    ['Subtotal', `$${simpleSubtotal.toFixed(2)}`],
                    ['Discount', `-$${getDiscountAmount(simpleSubtotal).toFixed(2)}`],
                    [`Tax (${taxRate || 0}%)`, `+$${getTaxAmount(simpleSubtotal).toFixed(2)}`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#64748b' }}>
                      <span>{label}</span><span>{val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '2px solid #0f172a', fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>
                    <span>TOTAL</span><span>${simpleTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
              {isMultiPackage && (
                <div style={{ fontSize: '12px', color: '#94a3b8', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                  Discount and tax will be applied to the option your client selects.
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Recurring Quote</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                <span style={{ fontSize: '13px', color: '#374151' }}>This is a recurring/subscription quote</span>
              </label>

              {isRecurring && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Frequency</label>
                    <select value={recurrenceFrequency} onChange={e => setRecurrenceFrequency(e.target.value)} style={selectStyle}>
                      {RECURRENCE_FREQ.map(rf => <option key={rf.value} value={rf.value}>{rf.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>End Date (Optional)</label>
                    <input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} style={inputStyle} />
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Leave blank for ongoing</div>
                  </div>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Photos</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Attach photos of the job site, equipment, or scope of work (max 5)</div>
                </div>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto || attachments.length >= 5}
                  style={{ padding: '8px 16px', background: attachments.length >= 5 ? '#f1f5f9' : '#1d4ed8', color: attachments.length >= 5 ? '#94a3b8' : '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: attachments.length >= 5 ? 'not-allowed' : 'pointer' }}>
                  {uploadingPhoto ? 'Uploading…' : '+ Add Photo'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </div>

              {attachments.length === 0 ? (
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: '8px', padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No photos attached yet
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                  {attachments.map((url, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '4/3', border: '1px solid #e2e8f0' }}>
                      <img src={url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Notes / Terms & Conditions</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                placeholder="Payment terms, warranty, scope of work, special conditions…"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            {!showSaveTemplate && (
              <div style={{ marginBottom: '24px' }}>
                <button onClick={() => setShowSaveTemplate(true)} style={{ padding: '10px 20px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: '8px', color: '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  💾 Save as Template
                </button>
              </div>
            )}

            {showSaveTemplate && (
              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Save as Template</h3>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Template Name *</label>
                  <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Standard HVAC Maintenance" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={saveAsTemplate} style={{ flex: 1, padding: '10px', background: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Save Template</button>
                  <button onClick={() => { setShowSaveTemplate(false); setTemplateName('') }} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                </div>
              </div>
            )}

          </div>
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

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>Loading…</div>}>
      <QuoteFormContent />
    </Suspense>
  )
}
