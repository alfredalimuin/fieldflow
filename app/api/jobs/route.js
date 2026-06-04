import { createClient } from '@supabase/supabase-js'

const supabaseMain = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const supabaseQuotes = createClient(
  process.env.NEXT_PUBLIC_QUOTES_SUPABASE_URL,
  process.env.QUOTES_SUPABASE_SERVICE_ROLE_KEY
)

async function getCaller(request) {
  const auth = request.headers.get('authorization')
  if (!auth) return null
  const { data: { user } } = await supabaseMain.auth.getUser(auth.replace('Bearer ', ''))
  return user
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    client_id, client_name, site_id, site_name,
    title, service_type, priority, items,
    notes, quote_id,
  } = body

  if (!client_id) return Response.json({ error: 'Client is required' }, { status: 400 })

  const { data, error } = await supabaseQuotes.from('jobs').insert({
    client_id,
    client_name,
    site_id: site_id || null,
    site_name: site_name || null,
    title: title || 'Untitled Job',
    service_type: service_type || '',
    priority: priority || 'standard',
    status: 'scheduled',
    items: items || [],
    notes: notes || '',
    quote_id: quote_id || null,
    created_by: caller.id,
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Log activity in quote
  if (quote_id) {
    await supabaseQuotes.from('quote_activity').insert({
      quote_id,
      action: 'job_created',
      description: `Job created: ${title}`,
      created_by: caller.id,
    })
  }

  return Response.json(data)
}

export async function GET(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const role = caller.app_metadata?.role || 'normal'
  let query = supabaseQuotes.from('jobs').select('*').order('created_at', { ascending: false })
  if (role !== 'admin') query = query.eq('created_by', caller.id)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data || [])
}
