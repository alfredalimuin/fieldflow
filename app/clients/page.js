'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

const STATUS_BADGE = {
  active:   { bg: '#f0fdf4', color: '#15803d', label: 'Active' },
  prospect: { bg: '#eff6ff', color: '#1d4ed8', label: 'Prospect' },
  inactive: { bg: '#f1f5f9', color: '#64748b', label: 'Inactive' },
}

const TYPE_LABEL = {
  property_manager: 'Property Manager',
  industrial:       'Industrial',
  healthcare:       'Healthcare',
  institutional:    'Institutional',
  restaurant:       'Restaurant & Food Service',
  other:            'Other',
}

const FILTER_TABS = ['All', 'Active', 'Prospect', 'Inactive']

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState('All')
  const [accessToken, setAccessToken] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [toast, setToast] = useState('')
  const [selectedClients, setSelectedClients] = useState(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const importInputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setAccessToken(session.access_token)
      loadClients(session.access_token)
    })
  }, [])

  async function loadClients(token) {
    const res = await fetch('/api/clients', { headers: { authorization: `Bearer ${token}` } })
    const data = await res.json()
    setClients(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function confirmDelete() {
    await fetch(`/api/clients?id=${deleteId}`, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } })
    setDeleteId(null); loadClients(accessToken); showToast('Client deleted.')
  }

  function toggleSelect(clientId) {
    const newSet = new Set(selectedClients)
    if (newSet.has(clientId)) newSet.delete(clientId)
    else newSet.add(clientId)
    setSelectedClients(newSet)
  }

  function toggleSelectAll() {
    if (selectedClients.size === filtered.length) setSelectedClients(new Set())
    else setSelectedClients(new Set(filtered.map(c => c.id)))
  }

  async function bulkDelete() {
    const ids = Array.from(selectedClients)
    await fetch('/api/clients/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ids }),
    })
    setSelectedClients(new Set())
    setBulkDeleteConfirm(false)
    loadClients(accessToken)
    showToast(`${ids.length} client${ids.length !== 1 ? 's' : ''} deleted.`)
  }

  function exportCSV() {
    const data = filtered.map(c => ({
      company_name: c.company_name,
      client_type: c.client_type,
      status: c.status || 'active',
      contact_name: c.contact_name || '',
      contact_email: c.contact_email || '',
      contact_phone: c.contact_phone || '',
      address: c.address || '',
      notes: c.notes || '',
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
    a.download = `clients-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    showToast('CSV exported.')
  }

  async function importCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const res = await fetch('/api/clients/import', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: text,
    })
    if (res.ok) {
      const result = await res.json()
      loadClients(accessToken)
      showToast(`${result.imported} client${result.imported !== 1 ? 's' : ''} imported.`)
    } else {
      const err = await res.json()
      showToast(err.error || 'Import failed.')
    }
    importInputRef.current.value = ''
  }

  const filtered = clients
    .filter(c => filterTab === 'All' || (c.status || 'active').toLowerCase() === filterTab.toLowerCase())
    .filter(c =>
      (c.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_email || '').toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Clients" actions={
          <button onClick={() => router.push('/clients/new')}
            style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            + Add Client
          </button>
        } />
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>

          {/* Search + Filter + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by company, contact, or email…"
              style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '300px', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '4px' }}>
              {FILTER_TABS.map(t => (
                <button key={t} onClick={() => setFilterTab(t)} style={{
                  padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: filterTab === t ? 600 : 400,
                  background: filterTab === t ? '#1d4ed8' : '#f1f5f9',
                  color: filterTab === t ? '#fff' : '#64748b',
                  border: 'none', cursor: 'pointer',
                }}>{t}</button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => importInputRef.current?.click()}
                style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                📥 Import CSV
              </button>
              <button onClick={exportCSV}
                style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                📤 Export CSV
              </button>
              {selectedClients.size > 0 && (
                <button onClick={() => setBulkDeleteConfirm(true)}
                  style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#fecaca', color: '#dc2626', border: 'none', cursor: 'pointer' }}>
                  🗑️ Delete ({selectedClients.size})
                </button>
              )}
            </div>
          </div>

          <input ref={importInputRef} type="file" accept=".csv" onChange={importCSV} style={{ display: 'none' }} />

          <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 120px 140px 160px', padding: '12px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
              <input type="checkbox" onChange={toggleSelectAll} checked={selectedClients.size === filtered.length && filtered.length > 0}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              {['Company', 'Type', 'Status', 'Contact', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                {search || filterTab !== 'All' ? 'No clients match your search.' : 'No clients yet. Add your first one.'}
              </div>
            ) : filtered.map(c => {
              const badge = STATUS_BADGE[c.status] || STATUS_BADGE.active
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 120px 140px 160px', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f8fafc', gap: '8px', background: selectedClients.has(c.id) ? '#eff6ff' : 'transparent' }}>
                  <input type="checkbox" onChange={() => toggleSelect(c.id)} checked={selectedClients.has(c.id)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{c.company_name}</div>
                    {c.address && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{c.address}</div>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{TYPE_LABEL[c.client_type] || 'Other'}</div>
                  <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color, display: 'inline-block' }}>
                    {badge.label}
                  </span>
                  <div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>{c.contact_name || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.contact_phone || c.contact_email || ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => router.push(`/clients/${c.id}`)}
                      style={{ padding: '4px 10px', background: '#eff6ff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>
                      View
                    </button>
                    <button onClick={() => router.push(`/clients/new?id=${c.id}`)}
                      style={{ padding: '4px 10px', background: '#f8fafc', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#475569', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteId(c.id)}
                      style={{ padding: '4px 10px', background: '#fef2f2', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#dc2626', cursor: 'pointer' }}>
                      Del
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
            {filtered.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '360px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Delete Client?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>This will permanently remove the client and all their sites and contacts.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '400px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Delete {selectedClients.size} Client{selectedClients.size !== 1 ? 's' : ''}?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>This will permanently remove the selected client{selectedClients.size !== 1 ? 's' : ''} and all their sites and contacts.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setBulkDeleteConfirm(false)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={bulkDelete} style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#0f172a', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
