'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/clients', label: 'Clients', icon: '🏢' },
  { href: '/quotes', label: 'Quotes', icon: '📋' },
  { href: '/jobs', label: 'Jobs', icon: '🔧' },
  { href: '/invoices', label: 'Invoices', icon: '💵' },
]

const ADMIN_NAV = [
  { href: '/users', label: 'Users', icon: '👥' },
]

const BOTTOM_NAV = [
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [role, setRole] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      setRole(session.user.app_metadata?.role || 'guest')
      setName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '')
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [...NAV, ...(role === 'admin' ? ADMIN_NAV : []), ...BOTTOM_NAV]

  return (
    <div style={{ width: '220px', minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
          Field<span style={{ color: '#2563eb' }}>Flow</span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>LVJR Service Solutions</div>
      </div>

      <nav style={{ flex: 1, padding: '8px 12px' }}>
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <a key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
              background: active ? '#1e3a8a' : 'transparent',
              color: active ? '#fff' : '#94a3b8',
              textDecoration: 'none', fontSize: '13px', fontWeight: active ? 600 : 400,
              transition: 'background 0.15s',
            }}>
              <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{icon}</span>
              {label}
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid #1e293b' }}>
        <div style={{ padding: '10px 12px', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{name}</div>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize', marginTop: '2px' }}>{role}</div>
        </div>
        <button onClick={handleSignOut} style={{
          width: '100%', padding: '8px 12px', background: 'transparent',
          border: '1px solid #1e293b', borderRadius: '8px', color: '#64748b',
          fontSize: '12px', cursor: 'pointer', textAlign: 'left',
        }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
