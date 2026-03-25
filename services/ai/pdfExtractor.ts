
import { Type } from "@google/genai";
import { supabase } from '../../lib/supabase.ts';
import { ai, apiKey, useEdgeFunction, aiConfig } from './client.ts';
import { buildExtractInvoicePrompt } from './prompts.ts';
import { extractInvoiceDataWithOpenAI } from './openaiClient.ts';
import { extractInvoiceDataWithAnthropic } from './anthropicClient.ts';
import type { ExtractedTransaction } from './types.ts';

/**
 * Extrai transações de um PDF de fatura.
 *
 * Cadeia de fallback (Layer 1 — chamada direta):
 *   1. Gemini   — suporte nativo a PDF inline; chave: VITE_GEMINI_API_KEY
 *   2. OpenAI   — não suporta PDF inline; lança imediatamente para acionar o próximo
 *   3. Anthropic — suporte nativo a PDF via document blocks; chave: VITE_ANTHROPIC_API_KEY
 *
 * Layer 2 (VITE_USE_EDGE_FUNCTION=true): chamada via Edge Function Supabase.
 *   O fallback multi-IA NÃO se aplica neste modo — a chave fica no servidor.
 *
 * @throws Se todos os provedores falharem ou nenhuma chave estiver configurada.
 */
export async function extractInvoiceData(
  fileBase64: string,
  issuer: string
): Promise<ExtractedTransaction[]> {
  // Verificação de disponibilidade de providers
  const openaiKey = (import.meta.env.VITE_OPENAI_API_KEY as string) || '';
  const anthropicKey = (import.meta.env.VITE_ANTHROPIC_API_KEY as string) || '';

  if (!apiKey && !useEdgeFunction && !openaiKey && !anthropicKey) {
    throw new Error(
      'Nenhuma chave de IA configurada. Configure pelo menos uma entre: ' +
      'VITE_GEMINI_API_KEY, VITE_OPENAI_API_KEY ou VITE_ANTHROPIC_API_KEY.'
    );
  }

  // Layer 2: Edge Function (chave nunca chega ao browser)
  if (useEdgeFunction) {
    const { data: { session } } = await supabase.auth.getSession();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const res = await fetch(`${supabaseUrl}/functions/v1/gemini-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ fileBase64, issuer }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `Erro na Edge Function: ${res.status}`);
    }

    const result = await res.json();
    return result.transactions || [];
  }

  // Layer 1: Fallback chain — Gemini → OpenAI → Anthropic
  const errors: string[] = [];

  // Provider 1: Gemini
  if (apiKey) {
    try {
      return await extractWithGemini(fileBase64, issuer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[AI Fallback] Gemini falhou na extração, tentando OpenAI:', msg);
      errors.push(`Gemini: ${msg}`);
    }
  }

  // Provider 2: OpenAI (lança imediatamente — PDF inline não suportado)
  if (openaiKey) {
    try {
      return await extractInvoiceDataWithOpenAI(fileBase64, issuer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[AI Fallback] OpenAI falhou na extração, tentando Anthropic:', msg);
      errors.push(`OpenAI: ${msg}`);
    }
  }

  // Provider 3: Anthropic (suporte nativo a PDF)
  if (anthropicKey) {
    try {
      return await extractInvoiceDataWithAnthropic(fileBase64, issuer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Anthropic: ${msg}`);
    }
  }

  console.error('[AI Fallback] Todos os provedores falharam na extração:', errors);
  throw new Error(
    `Falha na extração de PDF após tentar todos os provedores disponíveis:\n${errors.join('\n')}`
  );
}

async function extractWithGemini(
  fileBase64: string,
  issuer: string
): Promise<ExtractedTransaction[]> {
  const prompt = buildExtractInvoicePrompt(issuer);

  const response = await ai.models.generateContent({
    model: aiConfig.model,
    contents: {
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: fileBase64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
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
                description:  { type: Type.STRING },
                amount:       { type: Type.NUMBER }
              }
            }
          }
        }
      }
    }
  });

  const text = response.text;
  const result = JSON.parse(text || '{"transactions":[]}');
  return result.transactions || [];
}
