import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function callRpc<T>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
  successMsg: string,
): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    toast.error(error.message, { duration: 8000 })
    return null
  }
  toast.success(successMsg)
  return data as T
}