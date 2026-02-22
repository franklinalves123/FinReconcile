export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const { email, password } = await req.json().catch(() => ({} as any))

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Missing email or password' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (!supabaseUrl || !supabaseAnonKey) {
        return new Response(JSON.stringify({ error: 'Server missing Supabase env vars' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const url = `${supabaseUrl}/auth/v1/token?grant_type=password`

    const r = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ email, password }),
    })

    const data = await r.json().catch(() => ({}))
    return new Response(JSON.stringify(data), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' },
    })
}