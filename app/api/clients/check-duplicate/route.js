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

  const { company_name } = await request.json()
  if (!company_name) return Response.json({ error: 'company_name required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, company_name')
    .ilike('company_name', `%${company_name}%`)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ duplicates: data, found: data.length > 0 })
}
