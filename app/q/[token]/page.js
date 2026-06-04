'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

const STATUS_COLOR = {
  draft:    '#64748b',
  sent:     '#1d4ed8',
  viewed:   '#a16207',
  accepted: '#15803d',
  declined: '#dc2626',
}

const PRIORITY_LABEL = {
  emergency: '🔴 Emergency',
  urgent:    '🟠 Urgent',
  standard:  '🟢 Standard',
  preventive: '🔵 Preventive Maintenance',
}

export default function PublicQuotePage() {
  const { token } = useParams()
  const canvasRef = useRef(null)
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState(null)

  useEffect(() => {
    fetch(`/api/q?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); setLoading(false); return }
        setQuote(data)
        if (data.packages && data.packages.length > 0) {
          setSelectedPackage(data.packages[0].id)
        }
        setLoading(false)
        fetch('/api/q', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action: 'view' }) })
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [token])

  useEffect(() => {
    if (!quote || submitted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    let isDrawing = false
    let lastX = 0, lastY = 0

    function getPos(e) {
      const rect = canvas.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      return [clientX - rect.left, clientY - rect.top]
    }

    function start(e) { e.preventDefault(); isDrawing = true; [lastX, lastY] = getPos(e) }
    function draw(e) {
      e.preventDefault()
      if (!isDrawing) return
      const [x, y] = getPos(e)
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke()
      lastX = x; lastY = y
      setHasSignature(true)
    }
    function stop() { isDrawing = false }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stop)
    canvas.addEventListener('mouseleave', stop)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stop)

    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stop)
      canvas.removeEventListener('mouseleave', stop)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stop)
    }
  }, [quote, submitted])

  function clearSignature() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  async function submitSignature() {
    if (!hasSignature) return
    if (!agreed) { alert('Please confirm you agree to the quote before signing.'); return }
    setSubmitting(true)
    const signatureData = canvasRef.current.toDataURL('image/png')
    const res = await fetch('/api/q', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'sign', signature_data: signatureData }),
    })
    setSubmitting(false)
    if (res.ok) { setSubmitted(true); setQuote(prev => ({ ...prev, status: 'accepted' })) }
  }

  function getSubtotal(items) {
    return (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  }

  function getDiscountAmount(subtotal) {
    if (!quote) return 0
    return quote.discount_type === 'percentage'
      ? subtotal * (Number(quote.discount_value) || 0) / 100
      : Number(quote.discount_value) || 0
  }

  function getTaxAmount(subtotal) {
    if (!quote) return 0
    const taxable = Math.max(0, subtotal - getDiscountAmount(subtotal))
    return taxable * (Number(quote.tax_rate) || 0) / 100
  }

  function getTotal(subtotal) {
    const taxable = Math.max(0, subtotal - getDiscountAmount(subtotal))
    return taxable + getTaxAmount(subtotal)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ color: '#64748b', fontSize: '14px' }}>Loading quote…</div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Quote Not Found</div>
        <div style={{ fontSize: '14px', color: '#64748b' }}>This quote link may be invalid or expired.</div>
      </div>
    </div>
  )

  const isAlreadySigned = quote.status === 'accepted'
  const hasPackages = quote.packages && quote.packages.length > 0
  const selectedPkg = hasPackages ? quote.packages.find(p => p.id === selectedPackage) : null
  const displaySubtotal = selectedPkg ? getSubtotal(selectedPkg.items) : getSubtotal(quote.items)
  const displayTotal = getTotal(displaySubtotal)
  const isExpired = quote.expires_at && new Date(quote.expires_at) < new Date()

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 16px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: '#0f172a', borderRadius: '12px', padding: '28px 32px', marginBottom: '20px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Field<span style={{ color: '#2563eb' }}>Flow</span>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>LVJR Service Solutions Inc.</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Quote #</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>Q-{String(quote.quote_number || 0).padStart(4, '0')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Quote Date</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Quote Info */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                {quote.title || 'Service Quote'}
              </h1>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Prepared for: <strong style={{ color: '#0f172a' }}>{quote.client_name}</strong></div>
              {quote.site_name && <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>📍 {quote.site_name}</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, background: isAlreadySigned ? '#f0fdf4' : '#eff6ff', color: isAlreadySigned ? '#15803d' : STATUS_COLOR[quote.status] || '#64748b' }}>
                {isAlreadySigned ? '✓ Accepted' : quote.status?.charAt(0).toUpperCase() + quote.status?.slice(1)}
              </span>
              {isExpired && <span style={{ padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, background: '#fef2f2', color: '#dc2626' }}>Expired</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
            {[
              ['Service Type', quote.service_type || 'N/A'],
              ['Priority', PRIORITY_LABEL[quote.priority] || quote.priority || 'N/A'],
              quote.expires_at ? ['Valid Until', new Date(quote.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })] : null,
              quote.client_email ? ['Client Email', quote.client_email] : null,
            ].filter(Boolean).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '14px', color: '#0f172a' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Packages or Line Items */}
          {hasPackages ? (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Select an Option:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {quote.packages.map((pkg) => {
                  const pkgSubtotal = getSubtotal(pkg.items)
                  const pkgTotal = getTotal(pkgSubtotal)
                  return (
                    <div key={pkg.id} onClick={() => setSelectedPackage(pkg.id)} style={{
                      border: selectedPackage === pkg.id ? '2px solid #1d4ed8' : '1px solid #e2e8f0',
                      borderRadius: '10px', padding: '16px', cursor: 'pointer', background: selectedPackage === pkg.id ? '#eff6ff' : '#fff', transition: 'all 0.2s'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{pkg.name}</div>
                      {pkg.description && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>{pkg.description}</div>}
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#1d4ed8' }}>${pkgTotal.toFixed(2)}</div>
                    </div>
                  )
                })}
              </div>

              {selectedPkg && (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>{selectedPkg.name} - Details:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', gap: '8px', padding: '8px 0', borderBottom: '2px solid #e2e8f0', marginBottom: '8px' }}>
                    {['Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                      <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</div>
                    ))}
                  </div>
                  {selectedPkg.items.map((item, i) => {
                    const lineTotal = (Number(item.qty) || 0) * (Number(item.unit_price) || 0)
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', gap: '8px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '13px', color: '#374151' }}>{item.description}</div>
                        <div style={{ fontSize: '13px', color: '#374151' }}>{item.qty}</div>
                        <div style={{ fontSize: '13px', color: '#374151' }}>${Number(item.unit_price || 0).toFixed(2)}</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>${lineTotal.toFixed(2)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', gap: '8px', padding: '8px 0', borderBottom: '2px solid #f1f5f9', marginBottom: '8px' }}>
                {['Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {(quote.items || []).map((item, i) => {
                const lineTotal = (Number(item.qty) || 0) * (Number(item.unit_price) || 0)
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', gap: '8px', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ fontSize: '13px', color: '#374151' }}>{item.description}</div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>{item.qty}</div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>${Number(item.unit_price || 0).toFixed(2)}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>${lineTotal.toFixed(2)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pricing Summary */}
          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            {[
              ['Subtotal', `$${displaySubtotal.toFixed(2)}`],
              quote.discount_value ? [`Discount${quote.discount_type === 'percentage' ? ` (${quote.discount_value}%)` : ''}`, `-$${getDiscountAmount(displaySubtotal).toFixed(2)}`] : null,
              [`Tax (${quote.tax_rate || 0}%)`, `+$${getTaxAmount(displaySubtotal).toFixed(2)}`],
            ].filter(Boolean).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#64748b' }}>
                <span>{label}</span><span>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '2px solid #0f172a', fontWeight: 800, fontSize: '18px', color: '#0f172a' }}>
              <span>TOTAL DUE</span><span>${displayTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Photos */}
          {quote.attachments && quote.attachments.length > 0 && (
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>📸 Project Photos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                {quote.attachments.map((url, i) => (
                  <div key={i} style={{ borderRadius: '8px', overflow: 'hidden', aspectRatio: '4/3', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <img src={url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {quote.notes && (
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Notes & Terms</div>
              <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{quote.notes}</div>
            </div>
          )}
        </div>

        {/* Signature Section */}
        {isAlreadySigned ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '28px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>Quote Accepted</div>
            <div style={{ fontSize: '13px', color: '#16a34a' }}>
              Signed on {new Date(quote.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '12px' }}>
              Thank you! LVJR Service Solutions will be in touch shortly to schedule the work.
            </div>
          </div>
        ) : submitted ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '28px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>Quote Accepted!</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
              Thank you! LVJR Service Solutions will be in touch shortly to schedule the work.
            </div>
          </div>
        ) : isExpired ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '28px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏰</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>Quote Expired</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
              This quote is no longer valid. Please contact LVJR Service Solutions for a new quote.
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Accept & Sign</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>
              Draw your signature below to accept this quote. By signing, you authorize LVJR Service Solutions to proceed with the described work.
            </p>

            <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', marginBottom: '12px', position: 'relative' }}>
              <canvas ref={canvasRef} width={640} height={160}
                style={{ width: '100%', height: '160px', display: 'block', cursor: 'crosshair', touchAction: 'none' }} />
              {!hasSignature && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '13px', color: '#cbd5e1' }}>Sign here…</span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              {hasSignature && (
                <button onClick={clearSignature} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear signature
                </button>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px', cursor: 'pointer' }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
                I have read and agree to this quote. I authorize LVJR Service Solutions Inc. to proceed with the work described above for the total amount of <strong>${displayTotal.toFixed(2)}</strong>.
              </span>
            </label>

            <button onClick={submitSignature} disabled={submitting || !hasSignature || !agreed} style={{
              width: '100%', padding: '14px', background: hasSignature && agreed ? '#1d4ed8' : '#e2e8f0',
              border: 'none', borderRadius: '8px', color: hasSignature && agreed ? '#fff' : '#94a3b8',
              fontSize: '15px', fontWeight: 700, cursor: hasSignature && agreed ? 'pointer' : 'not-allowed',
            }}>
              {submitting ? 'Submitting…' : 'Accept & Submit Signature'}
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#94a3b8' }}>
          LVJR Service Solutions Inc. · 13428 Corpus Christi St., Houston, Texas 77015 · (832) 830-3318
        </div>
      </div>
    </div>
  )
}
