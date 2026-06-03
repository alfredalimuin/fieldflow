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
  const query = supabaseAdmin.from('client_sites').select('*').order('name')
  if (clientId) query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { client_id, name, address, notes } = body
  if (!client_id || !name) return Response.json({ error: 'client_id and name are required.' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('client_sites').insert({ client_id, name, address, notes }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PUT(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { id, name, address, notes } = body
  if (!id) return Response.json({ error: 'Missing id.' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('client_sites').update({ name, address, notes }).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const { error } = await supabaseAdmin.from('client_sites').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
