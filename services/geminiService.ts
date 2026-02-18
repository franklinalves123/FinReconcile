
import { GoogleGenAI, Type } from "@google/genai";

// Busca a chave configurada no index.html (window.process.env.API_KEY)
const getSafeApiKey = () => {
  try {
    return (window as any).process?.env?.API_KEY || '';
  } catch (e) {
    return '';
  }
};

const apiKey = getSafeApiKey();
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
  if (!apiKey) {
    throw new Error("Chave API do Gemini não encontrada. Verifique o arquivo index.html.");
  }

  const prompt = `Extraia despesas do ${issuer}. Retorne JSON com data (YYYY-MM-DD), descrição e valor.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
