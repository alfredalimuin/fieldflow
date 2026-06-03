import { createClient } from '@supabase/supabase-js'

const supabaseMain = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const supabaseQuotes = createClient(
  process.env.NEXT_PUBLIC_QUOTES_SUPABASE_URL,
  process.env.QUOTES_SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const auth = request.headers.get('authorization')
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseMain.auth.getUser(auth.replace('Bearer ', ''))
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file) return Response.json({ error: 'No file provided.' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: 'Only JPEG, PNG, WebP or GIF images allowed.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop().toLowerCase()
  const filename = `${user.id}/${Date.now()}.${ext}`

  const { error } = await supabaseQuotes.storage.from('quote-photos').upload(filename, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseQuotes.storage.from('quote-photos').getPublicUrl(filename)
  return Response.json({ url: publicUrl })
}
