import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getCaller(request) {
  const auth = request.headers.get('authorization')
  if (!auth) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(auth.replace('Bearer ', ''))
  return user
}

export async function GET(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const query = supabaseAdmin.from('client_contacts').select('*').order('is_primary', { ascending: false }).order('name')
  if (clientId) query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { client_id, name, title, email, phone, is_primary } = body
  if (!client_id || !name) return Response.json({ error: 'client_id and name are required.' }, { status: 400 })
  if (is_primary) {
    await supabaseAdmin.from('client_contacts').update({ is_primary: false }).eq('client_id', client_id)
  }
  const { data, error } = await supabaseAdmin.from('client_contacts').insert({ client_id, name, title, email, phone, is_primary: !!is_primary }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PUT(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { id, client_id, name, title, email, phone, is_primary } = body
  if (!id) return Response.json({ error: 'Missing id.' }, { status: 400 })
  if (is_primary && client_id) {
    await supabaseAdmin.from('client_contacts').update({ is_primary: false }).eq('client_id', client_id)
  }
  const { data, error } = await supabaseAdmin.from('client_contacts').update({ name, title, email, phone, is_primary: !!is_primary }).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const { error } = await supabaseAdmin.from('client_contacts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
