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

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('company_name', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { company_name, contact_name, contact_email, contact_phone, address, notes, client_type, status } = body

  if (!company_name) return Response.json({ error: 'Company name is required.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({ company_name, contact_name, contact_email, contact_phone, address, notes, client_type: client_type || 'other', status: status || 'active', created_by: caller.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PUT(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, company_name, contact_name, contact_email, contact_phone, address, notes, client_type, status } = body
  if (!id) return Response.json({ error: 'Missing id.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({ company_name, contact_name, contact_email, contact_phone, address, notes, client_type, status })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const caller = await getCaller(request)
  if (!caller || caller.app_metadata?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const { error } = await supabaseAdmin.from('clients').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
