import { createClient } from '@supabase/supabase-js'

// Quotes DB — public access (no auth required for viewing/signing)
const supabaseQuotes = createClient(
  process.env.NEXT_PUBLIC_QUOTES_SUPABASE_URL,
  process.env.QUOTES_SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return Response.json({ error: 'Token required.' }, { status: 400 })

  const { data, error } = await supabaseQuotes
    .from('quotes')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) return Response.json({ error: 'Quote not found.' }, { status: 404 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()
  const { token, action, signature_data, decline_reason } = body
  if (!token) return Response.json({ error: 'Token required.' }, { status: 400 })

  if (action === 'view') {
    const { data: existing } = await supabaseQuotes.from('quotes').select('opened_at').eq('token', token).single()
    if (!existing?.opened_at) {
      await supabaseQuotes.from('quotes').update({ opened_at: new Date().toISOString(), status: 'viewed' }).eq('token', token)
    }
    return Response.json({ success: true })
  }

  if (action === 'sign') {
    if (!signature_data) return Response.json({ error: 'Signature required.' }, { status: 400 })
    const { error } = await supabaseQuotes.from('quotes').update({
      signature_data,
      signed_at: new Date().toISOString(),
      status: 'accepted',
    }).eq('token', token)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'decline') {
    const { error } = await supabaseQuotes.from('quotes').update({
      decline_reason: decline_reason || null,
      status: 'declined',
    }).eq('token', token)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 })
}
