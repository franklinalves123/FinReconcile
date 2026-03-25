
/**
 * Cliente Anthropic (Claude) para o módulo services/ai/
 * Usa fetch direto (sem SDK) — compatível com browser/Vite.
 *
 * Capacidades:
 * - Extração de PDF via document blocks (base64) ✓ — Claude suporta nativamente
 * - Categorização de transações (text → JSON) ✓
 *
 * Configuração: VITE_ANTHROPIC_API_KEY no .env.local
 *
 * ATENÇÃO — segurança:
 *   A chave fica no bundle compilado (igual à VITE_GEMINI_API_KEY).
 *   Para produção segura, mova a chamada para uma Edge Function
 *   e reutilize o padrão VITE_USE_EDGE_FUNCTION já existente.
 */
import { buildCategorizePrompt, buildExtractInvoicePrompt } from './prompts.ts';
import type { CategorySuggestion, CategoryPattern, ExtractedTransaction } from './types.ts';

const ANTHROPIC_MODEL_EXTRACT = 'claude-sonnet-4-6'; // Sonnet para extração de PDF (maior capacidade)
const ANTHROPIC_MODEL_CATEGORIZE = 'claude-haiku-4-5-20251001'; // Haiku para categorização (velocidade/custo)
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function getAnthropicKey(): string {
  return (import.meta.env.VITE_ANTHROPIC_API_KEY as string) || '';
}

/** Remove markdown code fences que o Claude às vezes insere no output JSON. */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function callAnthropic(
  messages: object[],
  maxTokens = 2048,
  model = ANTHROPIC_MODEL_CATEGORIZE
): Promise<string> {
  const key = getAnthropicKey();
  if (!key) throw new Error('VITE_ANTHROPIC_API_KEY não configurada.');

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
      // Necessário para chamadas diretas do browser (chave exposta no bundle).
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Anthropic ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`
    );
  }

  const data = await res.json();
  const content = (data.content?.[0]?.text as string) || '';
  return stripCodeFences(content);
}

/**
 * Extrai transações de um PDF usando Claude (suporta document blocks em base64).
 * Lança em caso de erro — o orquestrador trata o fallback.
 */
export async function extractInvoiceDataWithAnthropic(
  fileBase64: string,
  issuer: string
): Promise<ExtractedTransaction[]> {
  const basePrompt = buildExtractInvoicePrompt(issuer);
  const prompt = `${basePrompt}
Retorne SOMENTE um JSON válido, sem texto adicional nem blocos de código markdown:
{"transactions": [{"purchaseDate": "YYYY-MM-DD", "description": "...", "amount": 0.00}]}`;

  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: fileBase64,
          },
        },
        {
          type: 'text',
          text: prompt,
        },
      ],
    },
  ];

  const text = await callAnthropic(messages, 8192, ANTHROPIC_MODEL_EXTRACT);
  const result = JSON.parse(text || '{"transactions":[]}');
  return result.transactions || [];
}

/**
 * Categoriza transações usando Claude Haiku.
 * Lança em caso de erro — o orquestrador trata o fallback.
 */
export async function categorizeTransactionsWithAnthropic(
  descriptions: string[],
  availableCategories: string[],
  historicalPatterns?: CategoryPattern[]
): Promise<CategorySuggestion[]> {
  const basePrompt = buildCategorizePrompt(descriptions, availableCategories, historicalPatterns);
  const prompt = `${basePrompt}

Retorne SOMENTE um JSON válido, sem texto adicional nem blocos de código markdown:
{"suggestions": [{"description": "...", "suggestedCategory": "...", "confidence": 0.0}]}`;

  const messages = [{ role: 'user', content: prompt }];
  const text = await callAnthropic(messages, 4096, ANTHROPIC_MODEL_CATEGORIZE);
  console.log(`[Categorizer] Anthropic raw response (${descriptions.length} items):`, text?.slice(0, 200));
  const result = JSON.parse(text || '{"suggestions":[]}');
  const suggestions: CategorySuggestion[] = result.suggestions || [];

  // Mapeia por índice com description original — não depende de string match.
  return descriptions.map((desc, i) => ({
    description: desc,
    suggestedCategory: suggestions[i]?.suggestedCategory || 'Outros',
    suggestedSubcategory: suggestions[i]?.suggestedSubcategory,
    confidence: suggestions[i]?.confidence ?? 0,
  }));
}
