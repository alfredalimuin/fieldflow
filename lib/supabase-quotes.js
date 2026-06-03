import { createClient } from '@supabase/supabase-js'

// Client-side (public pages like /q/[token])
export const supabaseQuotes = createClient(
  process.env.NEXT_PUBLIC_QUOTES_SUPABASE_URL,
  process.env.NEXT_PUBLIC_QUOTES_SUPABASE_ANON_KEY
)
