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

function calcTotal(items, packages, discountType, discountValue, taxRate) {
  let subtotal = 0
  if (packages && packages.length > 0) {
    // Use min package subtotal
    subtotal = Math.min(...packages.map(p =>
      (p.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
    ))
  } else {
    subtotal = (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  }
  const discount = discountType === 'percentage'
    ? subtotal * (Number(discountValue) || 0) / 100
    : Number(discountValue) || 0
  const taxable = subtotal - discount
  const tax = taxable * (Number(taxRate) || 0) / 100
  return Math.max(0, taxable + tax)
}

export async function GET(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const role = caller.app_metadata?.role || 'normal'
  let query = supabaseQuotes.from('quotes').select('*').order('created_at', { ascending: false })
  if (role !== 'admin') query = query.eq('created_by', caller.id)
  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const {
    client_id, client_name, client_email, site_id, site_name,
    title, service_type, priority, items, packages,
    discount_type, discount_value, tax_rate, expires_at,
    attachments, notes, payment_terms, is_recurring, recurrence_frequency, recurrence_end_date,
  } = body
  if (!client_id) return Response.json({ error: 'Client is required.' }, { status: 400 })

  const total = calcTotal(items, packages, discount_type, discount_value, tax_rate)

  const { data, error } = await supabaseQuotes.from('quotes').insert({
    client_id, client_name, client_email, site_id, site_name,
    title, service_type, priority: priority || 'standard',
    items: items || [], packages: packages || [],
    discount_type: discount_type || 'fixed',
    discount_value: Number(discount_value) || 0,
    tax_rate: Number(tax_rate) ?? 8.25,
    expires_at: expires_at || null,
    attachments: attachments || [],
    notes, payment_terms: payment_terms || 'due_on_receipt',
    is_recurring: is_recurring || false,
    recurrence_frequency: recurrence_frequency || null,
    recurrence_end_date: recurrence_end_date || null,
    created_by: caller.id, status: 'draft', total,
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PUT(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const {
    id, client_id, client_name, client_email, site_id, site_name,
    title, service_type, priority, status, items, packages,
    discount_type, discount_value, tax_rate, expires_at,
    attachments, notes, selected_package_id, payment_terms,
    is_recurring, recurrence_frequency, recurrence_end_date, decline_reason,
  } = body
  if (!id) return Response.json({ error: 'Missing id.' }, { status: 400 })

  const total = calcTotal(items, packages, discount_type, discount_value, tax_rate)

  const { data, error } = await supabaseQuotes.from('quotes').update({
    client_id, client_name, client_email, site_id, site_name,
    title, service_type, priority, status,
    items: items || [], packages: packages || [],
    discount_type, discount_value: Number(discount_value) || 0,
    tax_rate: Number(tax_rate) ?? 8.25,
    expires_at: expires_at || null,
    attachments: attachments || [],
    notes, selected_package_id, total, payment_terms,
    is_recurring, recurrence_frequency, recurrence_end_date, decline_reason,
  }).eq('id', id).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const caller = await getCaller(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const { error } = await supabaseQuotes.from('quotes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
