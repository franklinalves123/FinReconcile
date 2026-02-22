export default async function handler(req: any, res: any) {
    try {
        if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: 'Method not allowed' }))
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseAnonKey) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: 'Server missing Supabase env vars' }))
        }

        // Vercel já faz parse de JSON quando Content-Type é application/json
        const { email, password } = req.body || {}

        if (!email || !password) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: 'Missing email or password' }))
        }

        // sanity check: ping supabase
        const health = await fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET' }).catch((e) => e)
        if (health instanceof Error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: 'Supabase unreachable', supabaseUrl, message: String(health.message || health) }))
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

        res.statusCode = r.status
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(data))
    } catch (e: any) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'Function crashed', message: String(e?.message || e) }))
    }
}