
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from '../lib/supabase.ts';

/**
 * SEGURANÇA — Camadas de proteção da chave Gemini:
 *
 * Camada 1 (atual — MVP): VITE_GEMINI_API_KEY em .env.local
 *   A chave NÃO está no source code/git. Porém, após `npm run build`,
 *   ela é injetada no bundle compilado e fica visível no JS do cliente.
 *   Risco: quem inspecionar o bundle pode extraí-la.
 *
 * Camada 2 (recomendada — produção segura): Supabase Edge Function
 *   O cliente chama /functions/v1/gemini-proxy (autenticado via JWT).
 *   A chave fica exclusivamente no ambiente do servidor Supabase.
 *   Scaffold disponível em: supabase/functions/gemini-proxy/index.ts
 *   Para ativar: definir VITE_USE_EDGE_FUNCTION=true no .env.local
 *
 * Copie .env.local.example → .env.local e preencha os valores.
 */
const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string || '';
const useEdgeFunction = import.meta.env.VITE_USE_EDGE_FUNCTION === 'true';

const ai = new GoogleGenAI({ apiKey });

export interface ExtractedTransaction {
  purchaseDate: string;
  description: string;
  amount: number;
}

export const extractInvoiceData = async (
  fileBase64: string,
  issuer: string
): Promise<ExtractedTransaction[]> => {
  if (!apiKey && !useEdgeFunction) {
    throw new Error("Chave Gemini não encontrada. Configure VITE_GEMINI_API_KEY no .env.local ou ative VITE_USE_EDGE_FUNCTION=true.");
  }

  // Camada 2: Edge Function (chave nunca chega ao browser)
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
      throw new Error(err.error || `Erro na Edge Function: ${res.status}`);
    }

    const result = await res.json();
    return result.transactions || [];
  }

  // Camada 1: chamada direta ao Gemini (key no bundle — apenas MVP/dev local)
  const prompt = `Extraia despesas do ${issuer}. Retorne JSON com data (YYYY-MM-DD), descrição e valor.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: fileBase64 } },
          { text: prompt }
        ]
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
                  amount: { type: Type.NUMBER }
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
  } catch (error) {
    console.error("Erro Gemini:", error);
    throw error;
  }
};

export const categorizeTransactions = async (descriptions: string[]) => {
  const map: Record<string, string> = {};
  descriptions.forEach(d => map[d] = 'Outros');
  return map;
};

export const generateInsights = async (transactions: any[]) => "Insights em breve.";
