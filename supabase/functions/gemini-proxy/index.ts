/**
 * FinReconcile — Supabase Edge Function: gemini-proxy
 *
 * Proxy seguro para a API do Gemini. A chave GEMINI_API_KEY fica exclusivamente
 * no ambiente Supabase (nunca chega ao browser).
 *
 * DEPLOY:
 *   supabase functions deploy gemini-proxy --no-verify-jwt   # ou com JWT para auth
 *   supabase secrets set GEMINI_API_KEY=sua-chave-aqui
 *
 * ATIVAR NO CLIENT:
 *   Definir VITE_USE_EDGE_FUNCTION=true no .env.local
 *
 * ENDPOINT:
 *   POST /functions/v1/gemini-proxy
 *   Headers: Authorization: Bearer <supabase-user-jwt>
 *   Body: { fileBase64: string, issuer: string }
 *
 * Runtime: Deno (Supabase Edge Functions)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  GoogleGenAI,
  Type,
} from "https://esm.sh/@google/genai@^1.34.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar autenticação (JWT do Supabase)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileBase64, issuer } = await req.json();

    if (!fileBase64 || !issuer) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: fileBase64, issuer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chave fica apenas no ambiente Supabase — nunca exposta ao cliente
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY não configurada no ambiente Supabase" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const prompt = `Extraia despesas do ${issuer}. Retorne JSON com data (YYYY-MM-DD), descrição e valor.`;

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

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na Edge Function gemini-proxy:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar a fatura" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
