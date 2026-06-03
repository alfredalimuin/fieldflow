import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function getCaller(request) {
  const auth = request.headers.get('authorization')
  if (!auth) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(auth.replace('Bearer ', ''))
  return user
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const text = await request.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) return Response.json({ error: 'CSV must have header and at least one row' }, { status: 400 })

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const requiredFields = ['company_name']
  if (!requiredFields.every(f => headers.includes(f))) {
    return Response.json({ error: `CSV must include: ${requiredFields.join(', ')}` }, { status: 400 })
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || null })
    rows.push(row)
  }

  const clients = rows.map(r => ({
    company_name: r.company_name,
    contact_name: r.contact_name || null,
    contact_email: r.contact_email || null,
    contact_phone: r.contact_phone || null,
    address: r.address || null,
    notes: r.notes || null,
    created_by: caller.id,
  }))

  const { data, error } = await supabaseAdmin.from('clients').insert(clients).select()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true, imported: data.length, clients: data })
}
