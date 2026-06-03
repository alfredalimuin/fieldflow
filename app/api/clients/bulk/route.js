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
  if (caller.app_metadata?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { action, client_ids } = await request.json()
  if (!action || !client_ids?.length) return Response.json({ error: 'action and client_ids required' }, { status: 400 })

  if (action === 'delete') {
    const { error } = await supabaseAdmin.from('clients').delete().in('id', client_ids)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, deleted: client_ids.length })
  }

  if (action === 'export') {
    const { data, error } = await supabaseAdmin.from('clients').select('*').in('id', client_ids)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
