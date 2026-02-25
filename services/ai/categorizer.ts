
import { Type } from "@google/genai";
import { ai, aiConfig } from './client.ts';
import { buildCategorizePrompt } from './prompts.ts';
import { categorizeTransactionsWithOpenAI } from './openaiClient.ts';
import { categorizeTransactionsWithAnthropic } from './anthropicClient.ts';
import type { CategorySuggestion } from './types.ts';

/**
 * Categoriza um lote de descrições de transações.
 *
 * Cadeia de fallback: Gemini → OpenAI (gpt-4o-mini) → Anthropic (Claude Haiku)
 * Nunca lança exceção — fallback final retorna 'Outros' com confidence 0.
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

  // Provider 1: Gemini
  try {
    return await categorizeWithGemini(descriptions, availableCategories);
  } catch (error) {
    console.warn(
      '[AI Fallback] Gemini falhou na categorização, tentando OpenAI:',
      error instanceof Error ? error.message : error
    );
  }

  // Provider 2: OpenAI
  try {
    return await categorizeTransactionsWithOpenAI(descriptions, availableCategories);
  } catch (error) {
    console.warn(
      '[AI Fallback] OpenAI falhou na categorização, tentando Anthropic:',
      error instanceof Error ? error.message : error
    );
  }

  // Provider 3: Anthropic
  try {
    return await categorizeTransactionsWithAnthropic(descriptions, availableCategories);
  } catch (error) {
    console.error(
      '[AI Fallback] Todos os provedores falharam na categorização:',
      error instanceof Error ? error.message : error
    );
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
  const result = JSON.parse(text || '{"suggestions":[]}');
  const suggestions: CategorySuggestion[] = result.suggestions || [];

  // Garantir que o array de retorno tem o mesmo tamanho que descriptions.
  if (suggestions.length !== descriptions.length) {
    return descriptions.map((desc, i) => suggestions[i] ?? {
      description: desc,
      suggestedCategory: 'Outros',
      confidence: 0,
    });
  }

  return suggestions;
}
