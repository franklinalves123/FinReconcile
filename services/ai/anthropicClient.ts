
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

const ANTHROPIC_MODEL_EXTRACT = 'claude-sonnet-4-6'; // Sonnet 4.6 para extração de PDF — parser mais flexível que Opus 4.6 (que rejeitou faturas com "PDF not valid")
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

/** Código de erro definitivo: o PDF está incompleto/ilegível (ex.: só a página de resumo).
 *  O orquestrador NÃO deve tentar outros provedores — nenhum extrator lê transações
 *  que não estão no arquivo. */
export const INCOMPLETE_DOCUMENT_CODE = 'INCOMPLETE_DOCUMENT';

function incompleteDocumentError(prose: string): Error {
  const e = new Error(
    'A fatura enviada parece incompleta ou ilegível (provável PDF com páginas faltando — ' +
    'só a página de resumo). O modelo respondeu: "' +
    prose.replace(/\s+/g, ' ').trim().slice(0, 300) + '"'
  );
  (e as Error & { code?: string }).code = INCOMPLETE_DOCUMENT_CODE;
  return e;
}

/** Localiza o primeiro objeto JSON balanceado no texto, ciente de strings e escapes
 *  (não se confunde com chaves dentro de valores string). Retorna null se truncado. */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null; // chaves desbalanceadas → resposta truncada antes de fechar o JSON
}

/**
 * Converte a resposta textual do Claude em transações, tolerando prosa e cercas markdown.
 * Substitui o `JSON.parse(text)` ingênuo, que quebrava com "unexpected character at line 1
 * column 1" sempre que o modelo prefixava qualquer texto antes do JSON.
 *
 * - JSON puro ou em cerca markdown → extrai normalmente (caminho feliz).
 * - Explicação longa + pouquíssimas transações → o modelo está avisando que o PDF está
 *   incompleto; lança erro definitivo com a explicação (NÃO importa o JSON parcial:
 *   num app de reconciliação, dado incompleto é pior que erro explícito).
 * - JSON truncado (não fecha) → erro pedindo nova tentativa.
 */
export function parseInvoiceTransactions(text: string): ExtractedTransaction[] {
  const cleaned = stripCodeFences(text || '');

  // Caminho feliz: a resposta é (essencialmente) JSON puro.
  try {
    const r = JSON.parse(cleaned);
    if (Array.isArray(r.transactions)) return r.transactions;
  } catch { /* segue para extração tolerante a prosa */ }

  // Resposta com prosa em volta do JSON.
  const jsonStr = extractFirstJsonObject(cleaned) ?? extractFirstJsonObject(text);
  if (jsonStr) {
    let txs: ExtractedTransaction[] | null = null;
    try {
      const r = JSON.parse(jsonStr);
      if (Array.isArray(r.transactions)) txs = r.transactions;
    } catch { /* JSON malformado → cai para o erro abaixo */ }

    const prose = text.replace(jsonStr, '').replace(/```(?:json)?/gi, '').trim();
    // Explicação longa + quase nenhuma transação = aviso de PDF incompleto/recusa.
    // (Uma fatura completa retorna muitas transações e ~nenhuma prosa.)
    if (prose.length > 80 && (!txs || txs.length <= 2)) throw incompleteDocumentError(prose);
    if (txs) return txs;
  }

  // Nada utilizável.
  if (/^[[{]/.test(cleaned)) {
    throw new Error('Resposta da IA truncada antes de fechar o JSON (fatura muito grande?). Tente novamente.');
  }
  throw incompleteDocumentError(text.trim() || '(resposta vazia)');
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

  const text = await callAnthropic(messages, 16384, ANTHROPIC_MODEL_EXTRACT);
  return parseInvoiceTransactions(text);
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
  // Claude não tem JSON mode: pode prefixar prosa/cercas. JSON.parse direto quebraria
  // em "line 1 column 1" — extrai o objeto balanceado antes de parsear (reusa o helper).
  const jsonStr = extractFirstJsonObject(text || '') ?? '{"suggestions":[]}';
  const result = JSON.parse(jsonStr);
  const suggestions: CategorySuggestion[] = result.suggestions || [];

  // Mapeia por índice com description original — não depende de string match.
  return descriptions.map((desc, i) => ({
    description: desc,
    suggestedCategory: suggestions[i]?.suggestedCategory || 'Outros',
    suggestedSubcategory: suggestions[i]?.suggestedSubcategory,
    confidence: suggestions[i]?.confidence ?? 0,
  }));
}
