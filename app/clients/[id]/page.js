'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import Topbar from '../../components/Topbar'

const STATUS_BADGE = {
  active:   { bg: '#f0fdf4', color: '#15803d', label: 'Active' },
  prospect: { bg: '#eff6ff', color: '#1d4ed8', label: 'Prospect' },
  inactive: { bg: '#f1f5f9', color: '#64748b', label: 'Inactive' },
}

const TYPE_LABEL = {
  property_manager: 'Property Manager',
  industrial:       'Industrial Operator',
  healthcare:       'Healthcare',
  institutional:    'Institutional',
  restaurant:       'Restaurant & Food Service',
  other:            'Other',
}

const TAG_COLORS = {
  vip: { bg: '#fef3c7', color: '#d97706' },
  urgent: { bg: '#fecaca', color: '#dc2626' },
  followup: { bg: '#bfdbfe', color: '#1d4ed8' },
  contract: { bg: '#d1d5db', color: '#374151' },
  default: { bg: '#f3f4f6', color: '#6b7280' },
}

export default function ClientDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [sites, setSites] = useState([])
  const [contacts, setContacts] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [notes, setNotes] = useState([])
  const [tags, setTags] = useState([])
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  // Site form state
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [editSite, setEditSite] = useState(null)
  const [siteName, setSiteName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [siteNotes, setSiteNotes] = useState('')
  const [savingSite, setSavingSite] = useState(false)
  const [deleteSiteId, setDeleteSiteId] = useState(null)

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactPrimary, setContactPrimary] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [deleteContactId, setDeleteContactId] = useState(null)

  // Notes form state
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [editNote, setEditNote] = useState(null)
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [deleteNoteId, setDeleteNoteId] = useState(null)

  // Tags form state
  const [showTagForm, setShowTagForm] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [savingTag, setSavingTag] = useState(false)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setAccessToken(session.access_token)
      await loadAll(session.access_token)
    })
  }, [id])

  async function loadAll(token) {
    const [cRes, sRes, ctRes, alRes, nRes, tRes] = await Promise.all([
      fetch('/api/clients', { headers: { authorization: `Bearer ${token}` } }),
      fetch(`/api/client-sites?client_id=${id}`, { headers: { authorization: `Bearer ${token}` } }),
      fetch(`/api/client-contacts?client_id=${id}`, { headers: { authorization: `Bearer ${token}` } }),
      fetch(`/api/activity-log?client_id=${id}`, { headers: { authorization: `Bearer ${token}` } }),
      fetch(`/api/client-notes?client_id=${id}`, { headers: { authorization: `Bearer ${token}` } }),
      fetch(`/api/client-tags?client_id=${id}`, { headers: { authorization: `Bearer ${token}` } }),
    ])
    const clients = await cRes.json()
    const found = (Array.isArray(clients) ? clients : []).find(c => c.id === id)
    if (!found) { router.push('/clients'); return }
    setSites(await sRes.json().catch(() => []))
    setContacts(await ctRes.json().catch(() => []))
    setActivityLogs(await alRes.json().catch(() => []))
    setNotes(await nRes.json().catch(() => []))
    setTags(await tRes.json().catch(() => []))
    setClient(found)
    setLoading(false)
  }

  // Sites
  function openSiteForm(site = null) {
    setEditSite(site); setSiteName(site?.name || ''); setSiteAddress(site?.address || ''); setSiteNotes(site?.notes || ''); setShowSiteForm(true)
  }
  async function saveSite(e) {
    e.preventDefault(); if (!siteName.trim()) return; setSavingSite(true)
    const payload = { name: siteName, address: siteAddress, notes: siteNotes }
    const res = await fetch('/api/client-sites', {
      method: editSite ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(editSite ? { id: editSite.id, ...payload } : { client_id: id, ...payload }),
    })
    setSavingSite(false)
    if (res.ok) { setShowSiteForm(false); showToast(editSite ? 'Site updated.' : 'Site added.'); loadAll(accessToken) }
    else { const d = await res.json(); showToast(d.error || 'Error.') }
  }
  async function deleteSite() {
    await fetch(`/api/client-sites?id=${deleteSiteId}`, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } })
    setDeleteSiteId(null); loadAll(accessToken); showToast('Site removed.')
  }

  // Contacts
  function openContactForm(contact = null) {
    setEditContact(contact); setContactName(contact?.name || ''); setContactTitle(contact?.title || '')
    setContactEmail(contact?.email || ''); setContactPhone(contact?.phone || ''); setContactPrimary(contact?.is_primary || false); setShowContactForm(true)
  }
  async function saveContact(e) {
    e.preventDefault(); if (!contactName.trim()) return; setSavingContact(true)
    const payload = { name: contactName, title: contactTitle, email: contactEmail, phone: contactPhone, is_primary: contactPrimary, client_id: id }
    const res = await fetch('/api/client-contacts', {
      method: editContact ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(editContact ? { id: editContact.id, ...payload } : payload),
    })
    setSavingContact(false)
    if (res.ok) { setShowContactForm(false); showToast(editContact ? 'Contact updated.' : 'Contact added.'); loadAll(accessToken) }
    else { const d = await res.json(); showToast(d.error || 'Error.') }
  }
  async function deleteContact() {
    await fetch(`/api/client-contacts?id=${deleteContactId}`, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } })
    setDeleteContactId(null); loadAll(accessToken); showToast('Contact removed.')
  }

  // Notes
  function openNoteForm(note = null) {
    setEditNote(note); setNoteContent(note?.content || ''); setShowNoteForm(true)
  }
  async function saveNote(e) {
    e.preventDefault(); if (!noteContent.trim()) return; setSavingNote(true)
    const res = await fetch('/api/client-notes', {
      method: editNote ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(editNote ? { id: editNote.id, content: noteContent } : { client_id: id, content: noteContent }),
    })
    setSavingNote(false)
    if (res.ok) { setShowNoteForm(false); showToast(editNote ? 'Note updated.' : 'Note added.'); loadAll(accessToken) }
    else { const d = await res.json(); showToast(d.error || 'Error.') }
  }
  async function deleteNote() {
    await fetch(`/api/client-notes?id=${deleteNoteId}`, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } })
    setDeleteNoteId(null); loadAll(accessToken); showToast('Note removed.')
  }

  // Tags
  async function saveTag(e) {
    e.preventDefault(); if (!newTag.trim()) return; setSavingTag(true)
    const res = await fetch('/api/client-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ client_id: id, tag: newTag }),
    })
    setSavingTag(false)
    if (res.ok) { setNewTag(''); setShowTagForm(false); showToast('Tag added.'); loadAll(accessToken) }
    else { const d = await res.json(); showToast(d.error || 'Error.') }
  }
  async function removeTag(tag) {
    await fetch(`/api/client-tags?client_id=${id}&tag=${encodeURIComponent(tag)}`, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } })
    loadAll(accessToken); showToast('Tag removed.')
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading…</div>

  const badge = STATUS_BADGE[client.status] || STATUS_BADGE.active
  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }
  const labelStyle = { fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={client.company_name} actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => router.push(`/clients/new?id=${id}`)}
              style={{ padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>
              Edit Client
            </button>
            <button onClick={() => router.push('/clients')}
              style={{ padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>
              ← Back
            </button>
          </div>
        } />

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Header strip */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{TYPE_LABEL[client.client_type] || 'Other'}</span>
            </div>
            {client.address && <div style={{ fontSize: '13px', color: '#64748b' }}>{client.address}</div>}
          </div>

          {/* Tabs */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px', display: 'flex', gap: '0', overflowX: 'auto' }}>
            {[['overview', 'Overview'], ['contacts', `Contacts (${contacts.length})`], ['sites', `Sites (${sites.length})`], ['notes', `Notes (${notes.length})`], ['tags', `Tags (${tags.length})`], ['activity', 'Activity']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                padding: '12px 20px', background: 'none', border: 'none', borderBottom: activeTab === key ? '2px solid #1d4ed8' : '2px solid transparent',
                color: activeTab === key ? '#1d4ed8' : '#64748b', fontSize: '13px', fontWeight: activeTab === key ? 600 : 400, cursor: 'pointer', marginBottom: '-1px', whiteSpace: 'nowrap',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ padding: '28px 32px' }}>
            <div style={{ maxWidth: '760px' }}>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Client Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {[
                      ['Primary Contact', client.contact_name],
                      ['Email', client.contact_email],
                      ['Phone', client.contact_phone],
                      ['Address', client.address],
                      ['Client Type', TYPE_LABEL[client.client_type] || 'Other'],
                      ['Status', badge.label],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontSize: '14px', color: val ? '#0f172a' : '#cbd5e1' }}>{val || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                  {client.notes && (
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Notes</div>
                      <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>{client.notes}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Contacts Tab */}
              {activeTab === 'contacts' && (
                <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Contacts ({contacts.length})</h3>
                    <button onClick={() => openContactForm()}
                      style={{ padding: '6px 14px', background: '#1d4ed8', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      + Add Contact
                    </button>
                  </div>
                  {contacts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>No contacts yet. Add your first contact person for this client.</div>
                  ) : contacts.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #f8fafc' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                          {c.is_primary && <span style={{ fontSize: '10px', fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '99px' }}>Primary</span>}
                        </div>
                        {c.title && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{c.title}</div>}
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                          {c.email && <span style={{ marginRight: '12px' }}>{c.email}</span>}
                          {c.phone && <span>{c.phone}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '16px' }}>
                        <button onClick={() => openContactForm(c)} style={{ padding: '4px 10px', background: '#f8fafc', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#475569', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => setDeleteContactId(c.id)} style={{ padding: '4px 10px', background: '#fef2f2', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#dc2626', cursor: 'pointer' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sites Tab */}
              {activeTab === 'sites' && (
                <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Service Sites ({sites.length})</h3>
                    <button onClick={() => openSiteForm()}
                      style={{ padding: '6px 14px', background: '#1d4ed8', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      + Add Site
                    </button>
                  </div>
                  {sites.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>No sites yet. Sites are specific locations where LVJR provides services.</div>
                  ) : sites.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f8fafc' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{s.name}</div>
                        {s.address && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{s.address}</div>}
                        {s.notes && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '16px' }}>
                        <button onClick={() => openSiteForm(s)} style={{ padding: '4px 10px', background: '#f8fafc', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#475569', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => setDeleteSiteId(s.id)} style={{ padding: '4px 10px', background: '#fef2f2', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#dc2626', cursor: 'pointer' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Internal Notes ({notes.length})</h3>
                    <button onClick={() => openNoteForm()}
                      style={{ padding: '6px 14px', background: '#1d4ed8', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      + Add Note
                    </button>
                  </div>
                  {notes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>No notes yet. Add internal notes about this client.</div>
                  ) : notes.map(n => (
                    <div key={n.id} style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px', borderLeft: '3px solid #2563eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openNoteForm(n)} style={{ padding: '2px 8px', background: '#dbeafe', border: 'none', borderRadius: '4px', fontSize: '11px', color: '#1d4ed8', cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => setDeleteNoteId(n.id)} style={{ padding: '2px 8px', background: '#fecaca', border: 'none', borderRadius: '4px', fontSize: '11px', color: '#dc2626', cursor: 'pointer' }}>Delete</button>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{n.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tags Tab */}
              {activeTab === 'tags' && (
                <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Tags</h3>
                    <button onClick={() => setShowTagForm(true)}
                      style={{ padding: '6px 14px', background: '#1d4ed8', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      + Add Tag
                    </button>
                  </div>
                  {tags.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>No tags yet. Tag this client for quick organization.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {tags.map(t => {
                        const color = TAG_COLORS[t] || TAG_COLORS.default
                        return (
                          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '99px', background: color.bg, color: color.color, fontSize: '13px', fontWeight: 600 }}>
                            {t}
                            <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px', padding: '0 0 2px 0' }}>×</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Activity Log Tab */}
              {activeTab === 'activity' && (
                <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Activity Log</h3>
                  {activityLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>No activity yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activityLogs.map((log, idx) => (
                        <div key={idx} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #64748b' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{log.action}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {log.details && <div style={{ fontSize: '12px', color: '#64748b' }}>{log.details}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '440px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{editContact ? 'Edit Contact' : 'Add Contact'}</h3>
            <form onSubmit={saveContact}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Full Name *</label>
                <input value={contactName} onChange={e => setContactName(e.target.value)} required placeholder="Jane Smith" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Title / Role</label>
                <input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="Facility Manager" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@acme.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="832-555-0100" style={inputStyle} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                <input type="checkbox" checked={contactPrimary} onChange={e => setContactPrimary(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                Set as primary contact
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowContactForm(false)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button type="submit" disabled={savingContact} style={{ flex: 1, padding: '10px', background: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, opacity: savingContact ? 0.7 : 1 }}>
                  {savingContact ? 'Saving…' : editContact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Site Form Modal */}
      {showSiteForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '420px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{editSite ? 'Edit Site' : 'Add Service Site'}</h3>
            <form onSubmit={saveSite}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Site Name *</label>
                <input value={siteName} onChange={e => setSiteName(e.target.value)} required placeholder="Main Facility, Warehouse B…" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Address</label>
                <input value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="123 Industrial Blvd, Houston TX" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={siteNotes} onChange={e => setSiteNotes(e.target.value)} rows={2} placeholder="Access instructions, gate codes…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowSiteForm(false)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button type="submit" disabled={savingSite} style={{ flex: 1, padding: '10px', background: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, opacity: savingSite ? 0.7 : 1 }}>
                  {savingSite ? 'Saving…' : editSite ? 'Save Changes' : 'Add Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Contact Confirm */}
      {deleteContactId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '360px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>Remove Contact?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>This contact will be permanently removed.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDeleteContactId(null)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={deleteContact} style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Site Confirm */}
      {deleteSiteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '360px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>Remove Site?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>This site will be permanently removed.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDeleteSiteId(null)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={deleteSite} style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Note Form Modal */}
      {showNoteForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '480px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{editNote ? 'Edit Note' : 'Add Note'}</h3>
            <form onSubmit={saveNote}>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Note Content *</label>
                <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} required placeholder="Add your internal notes here..." rows={6} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowNoteForm(false)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button type="submit" disabled={savingNote} style={{ flex: 1, padding: '10px', background: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, opacity: savingNote ? 0.7 : 1 }}>
                  {savingNote ? 'Saving…' : editNote ? 'Save Changes' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Note Confirm */}
      {deleteNoteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '360px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>Delete Note?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>This note will be permanently removed.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDeleteNoteId(null)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={deleteNote} style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Form Modal */}
      {showTagForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '400px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Add Tag</h3>
            <form onSubmit={saveTag}>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Tag Name *</label>
                <input value={newTag} onChange={e => setNewTag(e.target.value)} required placeholder="e.g., VIP, Urgent, Follow-up…" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowTagForm(false)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button type="submit" disabled={savingTag} style={{ flex: 1, padding: '10px', background: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, opacity: savingTag ? 0.7 : 1 }}>
                  {savingTag ? 'Adding…' : 'Add Tag'}
                </button>
              </div>
            </form>
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
