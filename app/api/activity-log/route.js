import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

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
  const client_id = searchParams.get('client_id')
  if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('activity_log').select('*').eq('client_id', client_id).order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { client_id, action, description } = await request.json()
  if (!client_id || !action) return Response.json({ error: 'client_id and action required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('activity_log').insert({ client_id, action, description, created_by: caller.id })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
