
/**
 * Cliente OpenAI para o módulo services/ai/
 * Usa fetch direto (sem SDK) — compatível com browser/Vite.
 *
 * Capacidades:
 * - Categorização de transações (text → JSON) ✓
 * - Extração de PDF: ✗ gpt-4o-mini não suporta inline PDF via Chat Completions.
 *   A função exportada lança erro imediatamente para acionar o próximo provedor.
 *
 * Configuração: VITE_OPENAI_API_KEY no .env.local
 */
import { buildCategorizePrompt } from './prompts.ts';
import type { CategorySuggestion, ExtractedTransaction } from './types.ts';

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

function getOpenAIKey(): string {
  return (import.meta.env.VITE_OPENAI_API_KEY as string) || '';
}

async function callOpenAIChat(prompt: string): Promise<string> {
  const key = getOpenAIKey();
  if (!key) throw new Error('VITE_OPENAI_API_KEY não configurada.');

  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `OpenAI ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`
    );
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content as string) || '';
}

/**
 * Extração de PDF não suportada pelo gpt-4o-mini via Chat Completions.
 * Lança imediatamente para acionar o próximo provedor na cadeia de fallback.
 */
export async function extractInvoiceDataWithOpenAI(
  _fileBase64: string,
  _issuer: string
): Promise<ExtractedTransaction[]> {
  throw new Error(
    'OpenAI gpt-4o-mini não suporta extração de PDF inline via Chat Completions. Delegando para próximo provedor.'
  );
}

/**
 * Categoriza transações usando gpt-4o-mini.
 * Retorna array na mesma ordem de `descriptions`.
 * Lança em caso de erro — o orquestrador trata o fallback.
 */
export async function categorizeTransactionsWithOpenAI(
  descriptions: string[],
  availableCategories: string[]
): Promise<CategorySuggestion[]> {
  const prompt = buildCategorizePrompt(descriptions, availableCategories);
  const text = await callOpenAIChat(prompt);
  const result = JSON.parse(text || '{"suggestions":[]}');
  const suggestions: CategorySuggestion[] = result.suggestions || [];

  if (suggestions.length !== descriptions.length) {
    return descriptions.map((desc, i) => suggestions[i] ?? {
      description: desc,
      suggestedCategory: 'Outros',
      confidence: 0,
    });
  }

  return suggestions;
}
