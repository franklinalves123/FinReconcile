
/**
 * Prompts centralizados e versionados para o módulo de IA.
 * Nenhum arquivo de services/ai/ deve conter strings de prompt inline.
 */

/**
 * Prompt para extração de transações a partir de PDF de fatura.
 * Mantém exatamente o mesmo texto que estava em geminiService.ts:66.
 */
export function buildExtractInvoicePrompt(issuer: string): string {
  return `Extraia despesas do ${issuer}. Retorne JSON com data (YYYY-MM-DD), descrição e valor.`;
}

/**
 * Prompt para categorização em lote de transações.
 * Envia todas as descrições em uma única chamada (batch) para economizar tokens.
 *
 * Diretrizes:
 * - Português BR, pois as faturas são brasileiras
 * - Usa apenas as categorias fornecidas (não inventa novas)
 * - Sugere subcategoria apenas quando for evidente
 * - confidence 0.0–1.0; se incerto, usa 'Outros' com confidence 0.3
 * - Mantém a mesma ordem do array de entrada no array de saída
 */
export function buildCategorizePrompt(
  descriptions: string[],
  availableCategories: string[]
): string {
  const categoriesList = availableCategories.join(', ');
  const transactionsList = descriptions
    .map((d, i) => `${i + 1}. "${d}"`)
    .join('\n');

  return `Você é um categorizador de transações de cartão de crédito brasileiro.

Categorias disponíveis: ${categoriesList}

Regras:
- Use APENAS as categorias da lista acima. Nunca invente uma categoria nova.
- Sugira subcategoria (campo suggestedSubcategory) apenas quando for evidente pelo nome da transação (ex: "Uber" → subcategoria "Uber/99" dentro de "Transporte").
- confidence deve ser um número entre 0.0 e 1.0. Se não souber a categoria, use "Outros" com confidence 0.3.
- Mantenha a MESMA ORDEM das transações abaixo no array de saída.
- O campo "description" de cada item do output deve ser EXATAMENTE o mesmo texto da entrada.

Transações para categorizar:
${transactionsList}`;
}
