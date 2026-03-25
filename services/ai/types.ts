
/**
 * Contratos públicos do módulo services/ai/
 * Estes tipos definem a API pública do módulo de IA — não expõem internos.
 */

export interface ExtractedTransaction {
  purchaseDate: string;   // YYYY-MM-DD
  description: string;
  amount: number;
}

export interface CategorySuggestion {
  description: string;           // texto original da transação (exatamente como enviado)
  suggestedCategory: string;     // nome da categoria sugerida
  suggestedSubcategory?: string; // nome da subcategoria (opcional — apenas quando óbvio)
  confidence: number;            // 0.0 a 1.0
}

export interface AIModuleConfig {
  apiKey: string;
  useEdgeFunction: boolean;
  model: string;
}

/** Padrão aprendido de categorização do histórico do usuário. */
export interface CategoryPattern {
  description: string;   // descrição original (ou prefixo normalizado)
  category: string;
  subcategory?: string;
}
