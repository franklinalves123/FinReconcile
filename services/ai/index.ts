
/**
 * Ponto de entrada público do módulo services/ai/
 *
 * Consumidores externos devem importar APENAS daqui.
 * Os sub-arquivos (client.ts, prompts.ts, types.ts internos) são privados ao módulo.
 */
export { extractInvoiceData } from './pdfExtractor.ts';
export { categorizeTransactions } from './categorizer.ts';
export type { ExtractedTransaction, CategorySuggestion, CategoryPattern } from './types.ts';
