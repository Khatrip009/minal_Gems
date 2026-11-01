import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  try {
    // 1. Fetch live rates (goldprice.dev — no key required)
    const res = await fetch('https://api.goldprice.dev/v1/carat?currency=INR')
    if (!res.ok) throw new Error(`API returned ${res.status}`)

    const data = await res.json()

    const rates: Record<string, number> = {
      '24K': Number(data.price_gram_24k),
      '22K': Number(data.price_gram_22k),
      '18K': Number(data.price_gram_18k),
      '14K': Number(data.price_gram_14k),
    }

    // 2. Write to metal_rates
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: purities, error: purityErr } = await supabase
      .from('metal_purities')
      .select('id, code')
      .eq('is_active', true)

    if (purityErr) throw purityErr

    const now = new Date().toISOString()

    for (const p of purities ?? []) {
      // Map purity code to rate: 24K-ROSE → 24K, 22K-WHITE → 22K, etc.
      const base = p.code.split('-')[0] // '24K-ROSE' → '24K'
      const rate = rates[base]
      if (!rate || rate <= 0) continue

      await supabase.from('metal_rates').insert({
        purity_id: p.id,
        rate_per_gram: rate,
        effective_from: now,
        source: 'goldprice.dev',
      })
    }

    return new Response(JSON.stringify({ ok: true, rates }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})