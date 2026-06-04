import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const N8N_WEBHOOK_URL = 'http://2.25.138.71:5678/webhook/fieldflow-quote'

export async function POST(request) {
  try {
    const { quote_id } = await request.json()

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quote_id)
      .single()

    if (quoteError || !quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Fetch client
    const { data: client } = await supabase
      .from('clients')
      .select('company_name, contact_email')
      .eq('id', quote.client_id)
      .single()

    // Call n8n webhook
    const payload = {
      event_type: 'quote_send',
      quote_id: quote.id,
      client_email: client?.contact_email || '',
      client_name: client?.company_name || 'Client',
      quote_data: {
        number: `Q-${String(quote.quote_number || 0).padStart(4, '0')}`,
        total: quote.total || 0,
        title: quote.title || 'Untitled Quote',
        token: quote.token,
      },
      quote_token: quote.token,
    }

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!n8nResponse.ok) {
      console.error('n8n webhook failed:', await n8nResponse.text())
      return Response.json({ error: 'Failed to send quote' }, { status: 500 })
    }

    // Update quote status to 'sent'
    const { error: updateError } = await supabase
      .from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', quote_id)

    if (updateError) {
      return Response.json({ error: 'Failed to update quote status' }, { status: 500 })
    }

    // Log activity
    await supabase.from('quote_activity').insert({
      quote_id: quote.id,
      action: 'sent',
      description: `Quote sent to ${client?.company_name || 'client'}`,
      created_by: user.id,
      created_at: new Date().toISOString(),
    })

    return Response.json({ success: true, message: 'Quote sent successfully' })
  } catch (error) {
    console.error('Send quote error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
