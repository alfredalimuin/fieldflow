'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const MODULES = [
  { href: '/clients',  label: 'Clients',  icon: '🏢', desc: 'Manage client companies and service sites', color: '#eff6ff', border: '#bfdbfe', iconBg: '#2563eb' },
  { href: '/quotes',   label: 'Quotes',   icon: '📋', desc: 'Create and send quotes for approval',       color: '#f0fdf4', border: '#bbf7d0', iconBg: '#16a34a' },
  { href: '/jobs',     label: 'Jobs',     icon: '🔧', desc: 'Schedule and track field service jobs',     color: '#fefce8', border: '#fde68a', iconBg: '#d97706', soon: true },
  { href: '/invoices', label: 'Invoices', icon: '💵', desc: 'Billing and invoice management',            color: '#fdf4ff', border: '#e9d5ff', iconBg: '#7c3aed', soon: true },
]

const STATUS_LABEL = {
  active: { label: 'Active', color: '#15803d' },
  prospect: { label: 'Prospect', color: '#a16207' },
  inactive: { label: 'Inactive', color: '#64748b' },
}

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${color}`, cursor: 'pointer', transition: 'all 0.2s', transform: 'translateY(0)' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
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
  const [clients, setClients] = useState([])
  const [sites, setSites] = useState([])
  const [quotes, setQuotes] = useState([])
  const [quoteStats, setQuoteStats] = useState(null)
  const [activities, setActivities] = useState([])
  const [modalType, setModalType] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there')
      const token = session.access_token

      const [clientsRes, sitesRes, quotesRes] = await Promise.all([
        fetch('/api/clients', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/client-sites', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/quotes', { headers: { authorization: `Bearer ${token}` } }),
      ])
      const clientsData = await clientsRes.json().catch(() => [])
      const sitesData = await sitesRes.json().catch(() => [])
      const quotesData = await quotesRes.json().catch(() => [])

      const all = Array.isArray(clientsData) ? clientsData : []
      const allQuotes = Array.isArray(quotesData) ? quotesData : []
      setClients(all)
      setSites(Array.isArray(sitesData) ? sitesData : [])
      setQuotes(allQuotes)

      setStats({
        total: all.length,
        active: all.filter(c => (c.status || 'active') === 'active').length,
        prospects: all.filter(c => c.status === 'prospect').length,
        sites: Array.isArray(sitesData) ? sitesData.length : 0,
      })

      const statusCounts = { draft: 0, sent: 0, viewed: 0, accepted: 0, declined: 0 }
      let draftValue = 0, sentValue = 0, acceptedValue = 0, overdue = 0
      const serviceCount = {}

      allQuotes.forEach(q => {
        const status = (q.status || 'draft').toLowerCase()
        if (statusCounts.hasOwnProperty(status)) statusCounts[status]++

        // Revenue pipeline
        if (status === 'draft') draftValue += Number(q.total) || 0
        if (status === 'sent' || status === 'viewed') sentValue += Number(q.total) || 0
        if (status === 'accepted') acceptedValue += Number(q.total) || 0

        // Overdue check
        if (q.expires_at && new Date(q.expires_at) < new Date() && status !== 'accepted' && status !== 'declined') {
          overdue++
        }

        // Service breakdown
        const svc = q.service_type || 'Other'
        serviceCount[svc] = (serviceCount[svc] || 0) + 1
      })

      const chartData = [
        { name: 'Draft', value: statusCounts.draft, fill: '#94a3b8' },
        { name: 'Sent', value: statusCounts.sent, fill: '#2563eb' },
        { name: 'Viewed', value: statusCounts.viewed, fill: '#f59e0b' },
        { name: 'Accepted', value: statusCounts.accepted, fill: '#10b981' },
        { name: 'Declined', value: statusCounts.declined, fill: '#ef4444' },
      ].filter(d => d.value > 0)

      const serviceData = Object.entries(serviceCount)
        .map(([name, value]) => ({ name, value, fill: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#7c3aed'][Object.keys(serviceCount).indexOf(name) % 5] }))
        .sort((a, b) => b.value - a.value)

      setQuoteStats({
        total: allQuotes.length,
        draft: statusCounts.draft,
        sent: statusCounts.sent,
        viewed: statusCounts.viewed,
        accepted: statusCounts.accepted,
        declined: statusCounts.declined,
        chartData: chartData.length > 0 ? chartData : [{ name: 'No data', value: 1, fill: '#e5e7eb' }],
        totalValue: allQuotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0),
        draftValue,
        sentValue,
        acceptedValue,
        pendingApprovals: statusCounts.sent + statusCounts.viewed,
        overdue,
        serviceData,
      })

      // Fetch recent activities from all quotes
      const allActivities = []
      for (const q of allQuotes.slice(0, 10)) {
        const aRes = await fetch(`/api/quote-activity?quote_id=${q.id}`, { headers: { authorization: `Bearer ${token}` } })
        const aData = await aRes.json()
        if (Array.isArray(aData)) allActivities.push(...aData)
      }
      setActivities(allActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10))
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

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                  {greeting()}, {userName}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  LVJR Service Solutions — FieldFlow operations hub
                </p>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/clients/new')}
                style={{ padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                ➕ New Client
              </button>
              <button onClick={() => router.push('/quotes/new')}
                style={{ padding: '10px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                📋 New Quote
              </button>
              <button onClick={() => router.push('/clients')}
                style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                👥 View Clients
              </button>
              <button onClick={() => router.push('/quotes')}
                style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                📊 View Quotes
              </button>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
            <StatCard label="Total Clients" value={stats?.total} sub="All client accounts" color="#2563eb" onClick={() => setModalType('all')} />
            <StatCard label="Active Clients" value={stats?.active} sub="Currently active" color="#16a34a" onClick={() => setModalType('active')} />
            <StatCard label="Prospects" value={stats?.prospects} sub="In pipeline" color="#d97706" onClick={() => setModalType('prospect')} />
            <StatCard label="Pending Approvals" value={quoteStats?.pendingApprovals} sub="Awaiting response" color="#f59e0b" onClick={() => router.push('/quotes')} />
          </div>

          {/* Pipeline & Overdue Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: '4px solid #2563eb' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' }}>Pipeline Value</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                ${(quoteStats?.draftValue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>In draft quotes</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', marginTop: '8px' }}>
                ${(quoteStats?.sentValue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} awaiting
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' }}>Accepted Value</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginBottom: '12px' }}>
                ${(quoteStats?.acceptedValue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Ready to convert to jobs</div>
            </div>
            <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${quoteStats?.overdue > 0 ? '#ef4444' : '#d1d5db'}` }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' }}>Overdue Quotes</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: quoteStats?.overdue > 0 ? '#ef4444' : '#94a3b8', marginBottom: '12px' }}>
                {quoteStats?.overdue || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Expiration date passed</div>
            </div>
          </div>

          {/* Recent Activity */}
          {activities.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Activity</h3>
              <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activities.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'start', paddingBottom: '12px', borderBottom: i < activities.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <div style={{ fontSize: '16px', minWidth: '24px' }}>
                        {a.action === 'created' ? '✨' : a.action === 'sent' ? '📤' : a.action === 'viewed' ? '👁️' : a.action === 'accepted' ? '✅' : a.action === 'declined' ? '❌' : a.action === 'job_created' ? '🔧' : '📝'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>{a.action.replace(/_/g, ' ')}</div>
                        {a.description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{a.description}</div>}
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Customer Pipeline & Services */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
              {/* Customer Pipeline */}
              <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '16px' }}>Customer Acquisition Funnel</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#15803d' }}>Active Clients</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{stats.active}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>Prospects</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{stats.prospects}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', borderLeft: '3px solid #2563eb' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af' }}>Service Sites</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{stats.sites}</div>
                  </div>
                </div>
              </div>

              {/* Services Breakdown */}
              {quoteStats?.serviceData && quoteStats.serviceData.length > 0 && (
                <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '16px' }}>Services Breakdown</div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={quoteStats.serviceData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                        {quoteStats.serviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Quote Analytics */}
          {quoteStats && quoteStats.total > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quote Analytics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '16px' }}>Quote Status Distribution</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={quoteStats.chartData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={100} fill="#8884d8" dataKey="value">
                        {quoteStats.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: '#fff', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '16px' }}>Quote Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>Total Quotes:</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{quoteStats.total}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>Total Value:</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#2563eb' }}>${quoteStats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Draft:</span>
                          <span style={{ fontWeight: 600, color: '#64748b' }}>{quoteStats.draft}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Sent:</span>
                          <span style={{ fontWeight: 600, color: '#2563eb' }}>{quoteStats.sent}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Viewed:</span>
                          <span style={{ fontWeight: 600, color: '#f59e0b' }}>{quoteStats.viewed}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Accepted:</span>
                          <span style={{ fontWeight: 600, color: '#10b981' }}>{quoteStats.accepted}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module Cards */}
          <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Modules</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
            {MODULES.map(m => <ModuleCard key={m.href} {...m} />)}
          </div>

        </div>
      </div>

      {modalType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setModalType(null)}>
          <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px rgba(0,0,0,0.15)', padding: '28px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {modalType === 'all' && 'All Clients'}
                {modalType === 'active' && 'Active Clients'}
                {modalType === 'prospect' && 'Prospects'}
                {modalType === 'sites' && 'Service Sites'}
              </h2>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>×</button>
            </div>

            {modalType === 'sites' ? (
              <div>
                {sites.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No service sites yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sites.map(site => (
                      <div key={site.id} style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #7c3aed' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{site.name}</div>
                        {site.address && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>📍 {site.address}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {(modalType === 'all' ? clients : clients.filter(c => (modalType === 'active' ? (c.status || 'active') === 'active' : c.status === modalType))).length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No clients to display.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(modalType === 'all' ? clients : clients.filter(c => (modalType === 'active' ? (c.status || 'active') === 'active' : c.status === modalType))).map(client => {
                      const status = client.status || 'active'
                      const statusInfo = STATUS_LABEL[status] || { label: 'Unknown', color: '#64748b' }
                      return (
                        <div key={client.id} style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #2563eb' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{client.company_name}</div>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: '#fff', color: statusInfo.color }}>
                              {statusInfo.label}
                            </span>
                          </div>
                          {client.contact_name && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>👤 {client.contact_name}</div>}
                          {client.contact_email && <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>📧 {client.contact_email}</div>}
                          {client.address && <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {client.address}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
