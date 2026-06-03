'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

const MODULES = [
  { href: '/clients',  label: 'Clients',  icon: '🏢', desc: 'Manage client companies and service sites', color: '#eff6ff', border: '#bfdbfe', iconBg: '#2563eb' },
  { href: '/quotes',   label: 'Quotes',   icon: '📋', desc: 'Create and send quotes for approval',       color: '#f0fdf4', border: '#bbf7d0', iconBg: '#16a34a' },
  { href: '/jobs',     label: 'Jobs',     icon: '🔧', desc: 'Schedule and track field service jobs',     color: '#fefce8', border: '#fde68a', iconBg: '#d97706', soon: true },
  { href: '/invoices', label: 'Invoices', icon: '💵', desc: 'Billing and invoice management',            color: '#fdf4ff', border: '#e9d5ff', iconBg: '#7c3aed', soon: true },
]

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '6px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

function ModuleCard({ href, label, icon, desc, color, border, iconBg, soon }) {
  return (
    <a href={soon ? undefined : href} style={{
      display: 'block', background: color, border: `1px solid ${border}`,
      borderRadius: '12px', padding: '20px', textDecoration: 'none',
      cursor: soon ? 'default' : 'pointer', opacity: soon ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
          {icon}
        </div>
        {soon && <span style={{ fontSize: '10px', fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '99px' }}>Coming soon</span>}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: '#64748b' }}>{desc}</div>
    </a>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there')
      const token = session.access_token

      const [clientsRes, sitesRes] = await Promise.all([
        fetch('/api/clients', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/client-sites', { headers: { authorization: `Bearer ${token}` } }),
      ])
      const clients = await clientsRes.json().catch(() => [])
      const sites = await sitesRes.json().catch(() => [])

      const all = Array.isArray(clients) ? clients : []
      setStats({
        total: all.length,
        active: all.filter(c => (c.status || 'active') === 'active').length,
        prospects: all.filter(c => c.status === 'prospect').length,
        sites: Array.isArray(sites) ? sites.length : 0,
      })
    })
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Dashboard" />
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>

          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
              {greeting()}, {userName}
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              LVJR Service Solutions — FieldFlow operations hub
            </p>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
            <StatCard label="Total Clients" value={stats?.total} sub="All client accounts" color="#2563eb" />
            <StatCard label="Active Clients" value={stats?.active} sub="Currently active" color="#16a34a" />
            <StatCard label="Prospects" value={stats?.prospects} sub="In pipeline" color="#d97706" />
            <StatCard label="Service Sites" value={stats?.sites} sub="Across all clients" color="#7c3aed" />
          </div>

          {/* Module Cards */}
          <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Modules</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
            {MODULES.map(m => <ModuleCard key={m.href} {...m} />)}
          </div>

        </div>
      </div>
    </div>
  )
}
