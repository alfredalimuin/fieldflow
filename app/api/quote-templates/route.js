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

export async function GET(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseQuotes.from('quote_templates').select('*').eq('created_by', caller.id).order('name', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, service_type, items, packages, notes, tax_rate, payment_terms, discount_type, discount_value } = body
  if (!name) return Response.json({ error: 'Template name is required.' }, { status: 400 })

  const { data, error } = await supabaseQuotes.from('quote_templates').insert({
    name, description, service_type,
    items: items || [], packages: packages || [],
    notes, tax_rate: Number(tax_rate) ?? 8.25,
    payment_terms: payment_terms || 'due_on_receipt',
    discount_type: discount_type || 'fixed',
    discount_value: Number(discount_value) || 0,
    created_by: caller.id,
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PUT(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, name, description, service_type, items, packages, notes, tax_rate, payment_terms, discount_type, discount_value } = body
  if (!id) return Response.json({ error: 'Template ID is required.' }, { status: 400 })

  const { data, error } = await supabaseQuotes.from('quote_templates').update({
    name, description, service_type,
    items: items || [], packages: packages || [],
    notes, tax_rate: Number(tax_rate) ?? 8.25,
    payment_terms, discount_type, discount_value: Number(discount_value) || 0,
  }).eq('id', id).eq('created_by', caller.id).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const { error } = await supabaseQuotes.from('quote_templates').delete().eq('id', id).eq('created_by', caller.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
