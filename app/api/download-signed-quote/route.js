import { createClient } from '@supabase/supabase-js'
import jsPDF from 'jspdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const quoteId = searchParams.get('quote_id')

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    // Fetch quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 })
    }

    if (!quote.signature_data) {
      return new Response(JSON.stringify({ error: 'Quote has not been signed' }), { status: 400 })
    }

    // Fetch client
    const { data: client } = await supabase
      .from('clients')
      .select('company_name, contact_email, contact_phone, address')
      .eq('id', quote.client_id)
      .single()

    // Calculate totals
    const items = (quote.packages && quote.packages.length > 0) ? quote.packages[0].items : quote.items
    const subtotal = (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
    const discountAmount = quote.discount_type === 'percentage'
      ? subtotal * (Number(quote.discount_value) || 0) / 100
      : Number(quote.discount_value) || 0
    const taxable = Math.max(0, subtotal - discountAmount)
    const taxAmount = taxable * (Number(quote.tax_rate) || 0) / 100
    const total = Math.max(0, subtotal - discountAmount) + taxAmount

    // Create PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPos = 20

    // LVJR Header
    doc.setFontSize(16)
    doc.setFont(undefined, 'bold')
    doc.text('LVJR Service Solutions', 20, yPos)
    yPos += 8

    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text('Facilities never sleep. Neither do we.', 20, yPos)
    yPos += 6
    doc.text('Houston, TX | Phone: (XXX) XXX-XXXX', 20, yPos)
    yPos += 12

    // Quote header
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text(`SIGNED QUOTE - Q-${String(quote.quote_number || 0).padStart(4, '0')}`, 20, yPos)
    yPos += 10

    // Client info
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('Bill To:', 20, yPos)
    yPos += 6
    doc.setFont(undefined, 'normal')
    doc.text(client?.company_name || 'Client', 20, yPos)
    yPos += 4
    if (client?.contact_email) doc.text(`Email: ${client.contact_email}`, 20, yPos), (yPos += 4)
    if (client?.contact_phone) doc.text(`Phone: ${client.contact_phone}`, 20, yPos), (yPos += 4)
    if (client?.address) doc.text(`Address: ${client.address}`, 20, yPos), (yPos += 4)

    yPos += 4
    doc.setFont(undefined, 'bold')
    doc.text(`Quote Date: ${new Date(quote.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 20, yPos)
    yPos += 10

    // Line items
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    const col1 = 20, col2 = 100, col3 = 150, col4 = 180
    doc.text('Description', col1, yPos)
    doc.text('Qty', col2, yPos)
    doc.text('Unit Price', col3, yPos)
    doc.text('Amount', col4, yPos)
    yPos += 6
    doc.setDrawColor(200)
    doc.line(20, yPos, pageWidth - 20, yPos)
    yPos += 4

    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)
    items?.forEach(item => {
      const amount = (Number(item.qty) || 0) * (Number(item.unit_price) || 0)
      doc.text(item.description || '', col1, yPos)
      doc.text(String(item.qty || 0), col2, yPos)
      doc.text(`$${(Number(item.unit_price) || 0).toFixed(2)}`, col3, yPos)
      doc.text(`$${amount.toFixed(2)}`, col4, yPos)
      yPos += 5
    })

    yPos += 4
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, col3, yPos)
    yPos += 5

    if (discountAmount > 0) {
      doc.text(`Discount: -$${discountAmount.toFixed(2)}`, col3, yPos)
      yPos += 5
    }

    if (taxAmount > 0) {
      doc.text(`Tax (${(quote.tax_rate || 0).toFixed(1)}%): $${taxAmount.toFixed(2)}`, col3, yPos)
      yPos += 5
    }

    doc.setFont(undefined, 'bold')
    doc.setFontSize(10)
    doc.text(`Total: $${total.toFixed(2)}`, col3, yPos)
    yPos += 10

    // Signature section
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Client Signature:', 20, yPos)
    yPos += 12

    // Add signature image
    if (quote.signature_data) {
      try {
        doc.addImage(quote.signature_data, 'PNG', 20, yPos, 80, 30)
        yPos += 35
      } catch (e) {
        doc.text('[Signature]', 20, yPos)
        yPos += 10
      }
    }

    // Signature date
    doc.setFontSize(8)
    doc.setFont(undefined, 'normal')
    doc.text(`Signed on: ${new Date(quote.signed_at || quote.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 20, yPos)

    // Save PDF
    const filename = `Q-${String(quote.quote_number || 0).padStart(4, '0')}-signed.pdf`
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Download signed quote error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
