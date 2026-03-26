
/**
 * Prompts centralizados e versionados para o módulo de IA.
 * Nenhum arquivo de services/ai/ deve conter strings de prompt inline.
 */
import type { CategoryPattern } from './types.ts';

/**
 * Prompt para extração de transações a partir de PDF de fatura.
 * Blindado para layouts problemáticos (Porto Bank, Santander, Itaú, Bradesco, etc.).
 */
export function buildExtractInvoicePrompt(issuer: string): string {
  return `Você é um extrator preciso de dados de faturas de cartão de crédito brasileiro.

Emissor desta fatura: ${issuer}

TAREFA: Extraia TODAS as transações de compra listadas nesta fatura e retorne no formato JSON exigido.

REGRAS OBRIGATÓRIAS — leia com atenção:
1. Inclua CADA linha que representa uma compra, serviço, assinatura ou despesa debitada ao titular.
2. IGNORE completamente: pagamentos de fatura, saldo anterior, créditos, estornos, IOF separado, encargos de atraso, multas por atraso, subtotais, totais de seção e linhas de separação visual. INCLUA anuidade e tarifas bancárias — são despesas reais cobradas ao titular.
3. Para faturas do ${issuer} ou qualquer layout confuso com colunas misturadas: analise a estrutura da tabela com cuidado. Cada item de compra deve virar uma transação separada.
4. Campos obrigatórios por transação:
   - purchaseDate: data da compra no formato YYYY-MM-DD. Converta de DD/MM/AA → YYYY-MM-DD ou DD/MM/AAAA → YYYY-MM-DD. Se a data de compra não estiver visível, use a data de lançamento/processamento.
   - description: nome limpo do estabelecimento ou serviço. Remova: códigos internos numéricos longos, asteriscos isolados, espaços duplos, prefixos de 2 letras sem sentido. Mantenha o nome reconhecível pelo titular.
   - amount: valor numérico positivo em reais com ponto decimal (ex: 49.90). Sem "R$", sem pontos de milhar, sem sinal negativo, sem vírgula decimal.
5. Transações parceladas: inclua como transação individual com o valor da parcela (não o total). CRÍTICO: sempre incorpore o número da parcela na descrição no formato "NOME (XX/YY)". Exemplos: "SCHWARTZMOVEIS (04/10)", "OTICAS PARIS LTDA (03/05)", "IUGU*CLINTHUB (08/12)". Faturas como Santander exibem a parcela numa coluna separada — você deve concatenar descrição + parcela. Isso é obrigatório para que parcelas mensais de uma mesma compra sejam tratadas como transações distintas.
6. Se uma descrição estiver truncada ou com caracteres estranhos, limpe ao máximo e inclua mesmo assim — não descarte.
6a. ⚠️ TRANSAÇÕES IDÊNTICAS REPETIDAS — NUNCA ELIMINE: Se o mesmo estabelecimento aparece múltiplas vezes na mesma data com o mesmo valor (ex: 4× "MyFunded Futures" R$ 593,85 em 17/02), inclua CADA ocorrência como transação separada. Plataformas de trading, assinaturas e serviços recorrentes cobram o mesmo valor múltiplas vezes no mesmo dia — isso é legítimo, não é erro de formatação. Eliminar ocorrências idênticas é uma falha crítica que causa divergência no total da fatura.
7. NUNCA retorne transactions como array vazio se houver itens visíveis no PDF. Isso é uma falha crítica.

⚠️ CRÍTICO — REGRAS ANTI-TRUNCAMENTO (violação resulta em dados financeiros incorretos):
8. Você deve percorrer o documento PDF do início ao fim, página por página, sem parar antes do final. É ESTRITAMENTE PROIBIDO resumir, pular páginas, pular seções ou interromper a extração antes de processar a última transação do documento.
9. MULTI-CARTÃO / MULTI-SEÇÃO (regra universal — aplica-se a TODOS os bancos): Faturas frequentemente contêm várias seções independentes, cada uma com seu próprio subtotal. Exemplos de formatos:
   - Inter: seções nomeadas como "CARTÃO 5364****2107", "CARTÃO 2306****9352", "CARTÃO 5364****5274" — cada cartão (titular ou adicional) tem sua própria seção
   - Porto Bank: seções por portador ("Daiana P Coelho (final *518)", "Franklin A C No (final *113)") com subseções nacionais/internacionais
   - Santander/Itaú: blocos TITULAR, ADICIONAIS, VIRTUAIS
   Você DEVE extrair as transações de TODAS as seções e de TODOS os cartões listados. Ignorar qualquer seção ou cartão é uma falha crítica que causa divergência no total. ATENÇÃO: linhas de subtotal como "Total CARTÃO XXXX R$ X.XXX,XX" e pagamentos de fatura ("+R$ X.XXX,XX") devem ser IGNORADAS — apenas as transações individuais de compra devem ser incluídas.
10. ⚠️ PORTO BANK — TRANSAÇÕES INTERNACIONAIS (regra crítica de valor): As seções "Lançamentos Internacionais" do Porto Bank exibem DUAS colunas numéricas por linha: a primeira é o valor em moeda estrangeira (USD, EUR, etc.) e a segunda é o valor JÁ CONVERTIDO EM REAIS. Você DEVE usar SEMPRE o segundo valor (BRL convertido), que é o maior número da linha. Usar o valor em moeda estrangeira é uma falha crítica que causa divergência de R$ milhares.
    Exemplo correto: "13/02 LUCID TRADING NJ  78,00  428,20" → amount: 428.20 (NÃO 78.00)
    Exemplo correto: "17/02 MyFunded Futures TX  107,00  587,40" → amount: 587.40 (NÃO 107.00)
    Exceção: se o Dólar de Conversão for R$ 0,0000, a transação já está em BRL — use o valor diretamente.
11. IGNORE completamente as linhas "DEVOLUCAO IOF COMPRA INTERNACIONAL" (são créditos/estornos, valor negativo) e "PAGAMENTO PIX" (pagamento de fatura). Também ignore a linha "IOF TRANSACOES INTERNACIONAIS" (encargo financeiro separado). Ignore linhas de subtotal como "Lançamentos no cartão (final *XXX) X.XXX,XX".
12. A soma dos campos "amount" do seu output DEVE ser aproximadamente igual ao total de "Despesas/débitos" informado no resumo da fatura (não ao "Saldo" que inclui ajustes). Se o total calculado for muito inferior, você esqueceu transações — revise e complete.
13. Para faturas grandes (mais de 30 transações), continue gerando o JSON até o fim. Não há limite de itens no array.

Retorne APENAS o JSON no formato exato solicitado, sem texto introdutório ou explicativo.`;
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
  availableCategories: string[],
  historicalPatterns?: CategoryPattern[]
): string {
  const categoriesList = availableCategories.join(', ');
  const transactionsList = descriptions
    .map((d, i) => `${i + 1}. "${d}"`)
    .join('\n');

  const historicalSection = historicalPatterns && historicalPatterns.length > 0
    ? `\nHISTÓRICO DE CATEGORIZAÇÕES DO USUÁRIO (referência prioritária — se uma transação nova for similar a uma do histórico, use a mesma categoria):\n${
        historicalPatterns.map(p => {
          const sub = p.subcategory ? ` / ${p.subcategory}` : '';
          return `- "${p.description}" → ${p.category}${sub}`;
        }).join('\n')
      }\n`
    : '';

  return `Você é um categorizador especialista de gastos pessoais brasileiros. Classifique as transações de cartão de crédito abaixo com precisão e consistência.${historicalSection}

CATEGORIAS DISPONÍVEIS — use EXATAMENTE estes nomes, sem variações ortográficas:
${categoriesList}

REGRAS ESTRITAS — obrigatórias:
1. Toda transação DEVE receber uma categoria da lista acima. É PROIBIDO inventar ou sugerir categorias novas.
2. Se não tiver certeza, use "Outros" com confidence 0.3. Nunca deixe suggestedCategory vazio ou nulo.
3. confidence: número de 0.0 a 1.0. Use valores abaixo de 0.4 apenas com "Outros".
4. suggestedSubcategory: preencha quando o nome deixar clara a subcategoria (ex: "UBER" → "Transporte por App"; "MCDONALDS" → "Fast Food"; "NETFLIX" → "Streaming"). Omita quando não for evidente.
5. ⚠️ CRÍTICO DE ÍNDICE: O array "suggestions" de saída DEVE ter EXATAMENTE ${descriptions.length} itens, na MESMA ORDEM das transações listadas abaixo. O item de índice 0 do output corresponde à transação 1 da entrada, o índice 1 à transação 2, e assim por diante. Qualquer desvio de ordem ou item faltando invalida todo o resultado.
6. O campo "description" de cada item do output deve ser IDÊNTICO ao texto de entrada correspondente — não altere, não traduza, não resuma.
7. Contexto brasileiro — referências comuns: IFOOD/RAPPI/UBER EATS → Alimentação; UBER/99/CABIFY → Transporte; NETFLIX/SPOTIFY/PRIME → Assinaturas; RENNER/RIACHUELO/ZARA → Vestuário; MERCADOLIVRE/AMAZON/AMERICANAS → Compras Online; FARMÁCIAS/ULTRAFARMA → Saúde; POSTO/SHELL/PETROBRAS → Transporte.
8. Faturas do Porto Bank frequentemente contêm prefixos/sufixos de identificação numérica antes ou depois do nome — ignore-os e foque no nome do estabelecimento para categorizar.

TRANSAÇÕES PARA CATEGORIZAR:
${transactionsList}

Retorne APENAS o JSON no formato exato solicitado, sem texto adicional.`;
}
