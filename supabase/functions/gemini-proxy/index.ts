/**
 * FinReconcile — Supabase Edge Function: gemini-proxy
 * Runtime: Deno (Supabase Edge Functions v2)
 *
 * Proxy seguro para a API do Gemini.
 * A chave GEMINI_API_KEY fica EXCLUSIVAMENTE no ambiente Supabase
 * (configurada via `supabase secrets set`), nunca chegando ao browser.
 *
 * ─── DEPLOY (uma única vez) ─────────────────────────────────────────────────
 *  npm install -g supabase            # ou: brew install supabase/tap/supabase
 *  supabase login
 *  supabase link --project-ref neyioqyyfefgioqgcyvq
 *  supabase secrets set GEMINI_API_KEY=<sua-nova-chave-rotacionada>
 *  supabase functions deploy gemini-proxy
 *
 * ─── ATIVAR NO CLIENT ───────────────────────────────────────────────────────
 *  No .env.local:
 *    VITE_USE_EDGE_FUNCTION=true
 *    # VITE_GEMINI_API_KEY pode ser removida (não precisa mais)
 *
 * ─── ENDPOINT ───────────────────────────────────────────────────────────────
 *  POST https://neyioqyyfefgioqgcyvq.supabase.co/functions/v1/gemini-proxy
 *  Headers:
 *    Authorization: Bearer <supabase-user-jwt>
 *    apikey: <VITE_SUPABASE_ANON_KEY>
 *    Content-Type: application/json
 *  Body: { fileBase64: string, issuer: string }
 */

import {
  GoogleGenAI,
  Type,
} from "https://esm.sh/@google/genai@1.34.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Autenticação via JWT do Supabase ──────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // O JWT é verificado automaticamente pelo runtime Supabase.
    // Para validação extra de usuário, use: createClient + auth.getUser()

    // ── Body ─────────────────────────────────────────────────────────────
    let body: { fileBase64?: string; issuer?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, issuer } = body;

    if (!fileBase64 || !issuer) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: fileBase64, issuer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Tamanho máximo: ~20 MB em base64 ≈ ~15 MB de PDF
    if (fileBase64.length > 27_000_000) {
      return new Response(
        JSON.stringify({ error: "Arquivo muito grande. Máximo 15 MB." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Gemini — chave nunca sai deste ambiente ───────────────────────────
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      console.error("GEMINI_API_KEY não configurada. Execute: supabase secrets set GEMINI_API_KEY=...");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const prompt =
      `Extraia despesas do ${issuer}. Retorne JSON com data (YYYY-MM-DD), descrição e valor.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "application/pdf", data: fileBase64 } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["transactions"],
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["purchaseDate", "description", "amount"],
                properties: {
                  purchaseDate: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                },
              },
            },
          },
        },
      },
    });

    const result = JSON.parse(response.text || '{"transactions":[]}');

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function gemini-proxy:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar a fatura" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
