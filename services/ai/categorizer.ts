
import { Type } from "@google/genai";
import { ai, aiConfig } from './client.ts';
import { buildCategorizePrompt } from './prompts.ts';
import { categorizeTransactionsWithOpenAI } from './openaiClient.ts';
import { categorizeTransactionsWithAnthropic } from './anthropicClient.ts';
import type { CategorySuggestion } from './types.ts';

/** Tamanho máximo de cada lote enviado à IA. Faturas com mais itens são divididas. */
const BATCH_SIZE = 30;

/**
 * Categoriza descrições de transações em lotes para evitar truncamento em faturas longas.
 *
 * Fluxo:
 *   1. Divide descriptions em chunks de até BATCH_SIZE itens.
 *   2. Processa todos os chunks em paralelo (Promise.all).
 *   3. Cada chunk passa pela cadeia: Gemini → OpenAI → Anthropic → hard fallback 'Outros'.
 *   4. Resultados são concatenados na ordem original.
 *
 * Nunca lança exceção — o hard fallback garante retorno mesmo com todos os provedores falhando.
 *
 * @param descriptions       - Descrições das transações (exatamente como extraídas do PDF)
 * @param availableCategories - Nomes das categorias do usuário (contexto para o modelo)
 * @returns Array de sugestões na mesma ordem que descriptions.
 */
export async function categorizeTransactions(
  descriptions: string[],
  availableCategories: string[]
): Promise<CategorySuggestion[]> {
  // Fallback imediato para entradas vazias — sem chamar a API
  if (descriptions.length === 0 || availableCategories.length === 0) {
    return descriptions.map(d => ({
      description: d,
      suggestedCategory: 'Outros',
      confidence: 0,
    }));
  }

  // Divide em lotes de BATCH_SIZE para evitar truncamento do JSON em faturas longas
  const chunks: string[][] = [];
  for (let i = 0; i < descriptions.length; i += BATCH_SIZE) {
    chunks.push(descriptions.slice(i, i + BATCH_SIZE));
  }

  // Processa todos os lotes em paralelo e concatena na ordem original
  const chunkResults = await Promise.all(
    chunks.map(chunk => categorizeBatch(chunk, availableCategories))
  );

  return chunkResults.flat();
}

/**
 * Categoriza um único lote através da cadeia completa de fallback de providers.
 * Extrai a lógica de retry/fallback para que cada chunk seja independente.
 */
async function categorizeBatch(
  descriptions: string[],
  availableCategories: string[]
): Promise<CategorySuggestion[]> {
  // Provider 1: Gemini
  try {
    return await categorizeWithGemini(descriptions, availableCategories);
  } catch (error) {
    console.error('[Categorizer API Error] Gemini falhou, tentando OpenAI:', error);
  }

  // Provider 2: OpenAI
  try {
    return await categorizeTransactionsWithOpenAI(descriptions, availableCategories);
  } catch (error) {
    console.error('[Categorizer API Error] OpenAI falhou, tentando Anthropic:', error);
  }

  // Provider 3: Anthropic
  try {
    return await categorizeTransactionsWithAnthropic(descriptions, availableCategories);
  } catch (error) {
    console.error('[Categorizer API Error] Todos os provedores falharam:', error);
  }

  // Hard fallback — nunca propaga a exceção
  return descriptions.map(d => ({
    description: d,
    suggestedCategory: 'Outros',
    confidence: 0,
  }));
}

async function categorizeWithGemini(
  descriptions: string[],
  availableCategories: string[]
): Promise<CategorySuggestion[]> {
  const prompt = buildCategorizePrompt(descriptions, availableCategories);

  const response = await ai.models.generateContent({
    model: aiConfig.model,
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      responseSchema: {
        type: Type.OBJECT,
        required: ["suggestions"],
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["description", "suggestedCategory", "confidence"],
              properties: {
                description:          { type: Type.STRING },
                suggestedCategory:    { type: Type.STRING },
                suggestedSubcategory: { type: Type.STRING },
                confidence:           { type: Type.NUMBER },
              }
            }
          }
        }
      }
    }
  });

  const text = response.text;
  console.log(`[Categorizer] Gemini raw response (${descriptions.length} items):`, text?.slice(0, 200));
  const result = JSON.parse(text || '{"suggestions":[]}');
  const suggestions: CategorySuggestion[] = result.suggestions || [];

  // Sempre mapeia por índice usando a description original — ignora o que a IA
  // devolveu no campo "description" para evitar falhas de match por string alterada.
  return descriptions.map((desc, i) => ({
    description: desc,
    suggestedCategory: suggestions[i]?.suggestedCategory || 'Outros',
    suggestedSubcategory: suggestions[i]?.suggestedSubcategory,
    confidence: suggestions[i]?.confidence ?? 0,
  }));
}
