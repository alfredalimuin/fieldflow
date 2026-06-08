import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getCaller(request) {
  const auth = request.headers.get('authorization')
  if (!auth) return null
  const { data: { user } } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
  return user
}

export async function GET(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const quoteId = searchParams.get('quote_id')

  if (!quoteId) return Response.json({ error: 'quote_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('quote_activity')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data || [])
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { quote_id, action, description } = body

  if (!quote_id || !action) {
    return Response.json({ error: 'quote_id and action required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('quote_activity')
    .insert({
      quote_id,
      action,
      description: description || '',
      created_by: caller.id,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
