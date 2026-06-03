'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import Topbar from '../../components/Topbar'

const CLIENT_TYPES = [
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'industrial', label: 'Industrial Operator' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'restaurant', label: 'Restaurant & Food Service' },
  { value: 'other', label: 'Other' },
]

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'inactive', label: 'Inactive' },
]

function ClientFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')

  const [accessToken, setAccessToken] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [clientType, setClientType] = useState('other')
  const [status, setStatus] = useState('active')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setAccessToken(session.access_token)
      if (editId) {
        const res = await fetch('/api/clients', { headers: { authorization: `Bearer ${session.access_token}` } })
        const data = await res.json()
        const c = (Array.isArray(data) ? data : []).find(x => x.id === editId)
        if (c) {
          setCompanyName(c.company_name || '')
          setClientType(c.client_type || 'other')
          setStatus(c.status || 'active')
          setContactName(c.contact_name || '')
          setContactEmail(c.contact_email || '')
          setContactPhone(c.contact_phone || '')
          setAddress(c.address || '')
          setNotes(c.notes || '')
        }
      }
    })
  }, [editId])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function handleSave(e) {
    e.preventDefault()
    if (!companyName.trim()) { showToast('Company name is required.'); return }
    setSaving(true)
    const payload = { company_name: companyName, client_type: clientType, status, contact_name: contactName, contact_email: contactEmail, contact_phone: contactPhone, address, notes }
    const res = await fetch('/api/clients', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(editId ? { id: editId, ...payload } : payload),
    })
    setSaving(false)
    if (res.ok) {
      showToast(editId ? 'Client updated.' : 'Client added.')
      setTimeout(() => router.push('/clients'), 1000)
    } else {
      const d = await res.json(); showToast(d.error || 'Error saving.')
    }
  }

  const selectStyle = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#374151', background: '#fff', outline: 'none', boxSizing: 'border-box' }
  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }
  const labelStyle = { fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={editId ? 'Edit Client' : 'Add Client'} actions={
          <button onClick={() => router.push('/clients')}
            style={{ padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>
            Cancel
          </button>
        } />
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          <form onSubmit={handleSave} style={{ maxWidth: '640px' }}>

            {/* Company Info */}
            <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Company Info</h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Company Name *</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Acme Properties LLC" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Client Type</label>
                  <select value={clientType} onChange={e => setClientType(e.target.value)} style={selectStyle}>
                    {CLIENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Street Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, Houston TX 77015" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Contract details, special requirements, SLA terms…"
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Primary Contact */}
            <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Primary Contact</h3>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8' }}>You can add more contacts from the client detail page after saving.</p>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Contact Name</label>
                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@acme.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="832-555-0100" style={inputStyle} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving} style={{
              padding: '11px 28px', background: '#1d4ed8', border: 'none', borderRadius: '8px',
              color: '#fff', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Client'}
            </button>
          </form>
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

export default function NewClientPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>Loading…</div>}>
      <ClientFormContent />
    </Suspense>
  )
}
