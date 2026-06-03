'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

const ROLES = ['admin', 'normal', 'guest']
const roleBadge = { admin: { bg: '#ede9fe', color: '#6d28d9' }, normal: { bg: '#e0f2fe', color: '#0369a1' }, guest: { bg: '#f1f5f9', color: '#475569' } }

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [accessToken, setAccessToken] = useState('')

  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  const [editUser, setEditUser] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('normal')
  const [saving, setSaving] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const [deleteId, setDeleteId] = useState(null)
  const [disableUser, setDisableUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      if (session.user.app_metadata?.role !== 'admin') { router.push('/dashboard'); return }
      setAccessToken(session.access_token)
      loadUsers(session.access_token)
    })
  }, [])

  async function loadUsers(token) {
    const res = await fetch('/api/users', { headers: { authorization: `Bearer ${token}` } })
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function openEdit(u) {
    setEditUser(u); setEditName(u.user_metadata?.full_name || ''); setEditRole(u.app_metadata?.role || 'normal'); setResetSent(false)
  }

  async function saveEdit(e) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'update', userId: editUser.id, name: editName, role: editRole }),
    })
    setSaving(false)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, user_metadata: { ...u.user_metadata, full_name: editName }, app_metadata: { ...u.app_metadata, role: editRole } } : u))
      setEditUser(null); showToast('User updated.')
    } else { const d = await res.json(); showToast(d.error || 'Error.') }
  }

  async function sendReset() {
    setSendingReset(true)
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action: 'reset-password', email: editUser.email }) })
    setSendingReset(false)
    if (res.ok) setResetSent(true); else { const d = await res.json(); showToast(d.error || 'Error.') }
  }

  async function inviteUser(e) {
    e.preventDefault(); setInviting(true)
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action: 'invite', email: inviteEmail, name: inviteName }) })
    setInviting(false)
    if (res.ok) { setShowInvite(false); setInviteName(''); setInviteEmail(''); showToast('Invite sent!'); loadUsers(accessToken) }
    else { const d = await res.json(); showToast(d.error || 'Failed.') }
  }

  async function confirmDisable() {
    const isDisabled = !!disableUser.banned_until
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action: 'ban', userId: disableUser.id, banned: !isDisabled }) })
    setDisableUser(null); loadUsers(accessToken); showToast(isDisabled ? 'Account enabled.' : 'Account disabled.')
  }

  async function confirmDelete() {
    await fetch(`/api/users?id=${deleteId}`, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } })
    setDeleteId(null); loadUsers(accessToken); showToast('User deleted.')
  }

  const filtered = users.filter(u =>
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.user_metadata?.full_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Team" actions={
          <button onClick={() => setShowInvite(true)} style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            + Invite Member
          </button>
        } />
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          <div style={{ marginBottom: '16px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
              style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '300px', outline: 'none' }} />
          </div>
          <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 100px 210px', padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
              {['Member', 'Role', 'Status', 'Provider', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading…</div>
            ) : filtered.map(u => {
              const isDisabled = !!u.banned_until
              const name = u.user_metadata?.full_name || u.email?.split('@')[0]
              const role = u.app_metadata?.role || 'normal'
              const badge = roleBadge[role] || roleBadge.normal
              return (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 100px 210px', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f8fafc', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>
                      {name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{name}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{u.email}</div>
                    </div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color, textTransform: 'capitalize', display: 'inline-block' }}>{role}</span>
                  <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: isDisabled ? '#fef2f2' : '#f0fdf4', color: isDisabled ? '#dc2626' : '#15803d' }}>
                    {isDisabled ? 'Disabled' : 'Active'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{u.identities?.[0]?.provider || 'email'}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(u)} style={{ padding: '4px 10px', background: '#eff6ff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => setDisableUser(u)} style={{ padding: '4px 10px', background: isDisabled ? '#f0fdf4' : '#fefce8', border: 'none', borderRadius: '6px', fontSize: '11px', color: isDisabled ? '#15803d' : '#a16207', cursor: 'pointer' }}>
                      {isDisabled ? 'Enable' : 'Disable'}
                    </button>
                    <button onClick={() => setDeleteId(u.id)} style={{ padding: '4px 10px', background: '#fef2f2', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#dc2626', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#1d4ed8' }}>
                {(editUser.user_metadata?.full_name || editUser.email)?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Edit Team Member</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{editUser.email}</div>
              </div>
            </div>
            <form onSubmit={saveEdit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Full Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Jane Smith"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#374151', background: '#fff' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '24px', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Password Reset</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px' }}>Send a reset link to this member's email.</div>
                {resetSent ? <div style={{ fontSize: '13px', color: '#15803d', fontWeight: 500 }}>Reset email sent!</div> : (
                  <button type="button" onClick={sendReset} disabled={sendingReset}
                    style={{ padding: '7px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#374151', cursor: 'pointer', opacity: sendingReset ? 0.6 : 1 }}>
                    {sendingReset ? 'Sending…' : 'Send Reset Email'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setEditUser(null)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px', background: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '380px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Invite Team Member</h3>
            <form onSubmit={inviteUser}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Full Name</label>
                <input value={inviteName} onChange={e => setInviteName(e.target.value)} required placeholder="Jane Smith"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Email</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required placeholder="jane@lvjrservices.com"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => { setShowInvite(false); setInviteName(''); setInviteEmail('') }} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button type="submit" disabled={inviting} style={{ flex: 1, padding: '10px', background: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, opacity: inviting ? 0.7 : 1 }}>
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable Confirm */}
      {disableUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '360px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{disableUser.banned_until ? 'Enable Account?' : 'Disable Account?'}</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>
              {disableUser.banned_until ? `${disableUser.user_metadata?.full_name || disableUser.email} will regain access.` : `${disableUser.user_metadata?.full_name || disableUser.email} will be suspended and lose access.`}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDisableUser(null)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={confirmDisable} style={{ flex: 1, padding: '10px', background: disableUser.banned_until ? '#1d4ed8' : '#d97706', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                {disableUser.banned_until ? 'Yes, Enable' : 'Yes, Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '360px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Delete Member?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>This permanently removes their account.</p>
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
    </div>
  )
}
