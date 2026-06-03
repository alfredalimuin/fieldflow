import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getCaller(request) {
  const auth = request.headers.get('authorization')
  if (!auth) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(auth.replace('Bearer ', ''))
  return user
}

export async function GET(request) {
  const caller = await getCaller(request)
  if (!caller || caller.app_metadata?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ users })
}

export async function POST(request) {
  const caller = await getCaller(request)
  if (!caller || caller.app_metadata?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const { action, email, name, userId, role, banned } = body

  if (action === 'invite') {
    const origin = request.headers.get('origin') || ''
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
      data: { full_name: name || '' },
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await supabaseAdmin.auth.admin.updateUserById(data.user.id, { app_metadata: { role: 'normal' } })
    return Response.json({ success: true })
  }

  if (action === 'update') {
    const updates = {}
    if (name !== undefined) updates.user_metadata = { full_name: name }
    if (role !== undefined) updates.app_metadata = { role }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'ban') {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? '876600h' : 'none',
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'reset-password') {
    const { createClient: createAnonClient } = await import('@supabase/supabase-js')
    const client = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const origin = request.headers.get('origin') || ''
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request) {
  const caller = await getCaller(request)
  if (!caller || caller.app_metadata?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
