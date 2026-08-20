
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
2. IGNORE completamente: pagamentos de fatura (ex: "PAG BOLETO BANCARIO", "PAGAMENTO PIX", "PAGAMENTO EFETUADO"), saldo anterior, IOF separado, encargos de atraso, multas por atraso, subtotais, totais de seção e linhas de separação visual. INCLUA anuidade e tarifas bancárias — são despesas reais cobradas ao titular.
2a. ⚠️ ESTORNOS, CRÉDITOS E DEVOLUÇÕES DE COMPRA — INCLUA, NUNCA DESCARTE: toda linha que devolve dinheiro ao titular por causa de uma compra (estorno, cancelamento, devolução, crédito de compra, reembolso) é um lançamento real e DEVE entrar no output com "type": "refund" e "amount" POSITIVO. Como identificar em cada layout:
   - Bradesco: o crédito NÃO traz sinal antes do número — traz um hífen solto DEPOIS do valor, na mesma linha ("204,99 -"). Essa é a única pista do layout; leia a linha inteira antes de decidir.
   - Demais emissores: sinal "-" antes do valor, valor entre parênteses, coluna "C"/"CRÉDITO", ou as palavras "ESTORNO", "CANCELAMENTO", "DEVOLUCAO", "CREDITO", "REEMBOLSO" na descrição.
   NÃO confunda com pagamento de fatura: "PAG BOLETO BANCARIO", "PAGAMENTO PIX", "PAGAMENTO EFETUADO" e "SALDO ANTERIOR" aparecem como crédito no mesmo layout (no Bradesco, com o mesmo hífen) e continuam FORA do output pela regra 2.
3. Para faturas do ${issuer} ou qualquer layout confuso com colunas misturadas: analise a estrutura da tabela com cuidado. Cada item de compra deve virar uma transação separada.
4. Campos obrigatórios por transação:
   - purchaseDate: data da compra no formato YYYY-MM-DD. Converta de DD/MM/AA → YYYY-MM-DD ou DD/MM/AAAA → YYYY-MM-DD. Se a data de compra não estiver visível, use a data de lançamento/processamento.
   - description: nome limpo do estabelecimento ou serviço. Remova: códigos internos numéricos longos, asteriscos isolados, espaços duplos, prefixos de 2 letras sem sentido. Mantenha o nome reconhecível pelo titular.
   - amount: valor numérico POSITIVO em reais com ponto decimal (ex: 49.90). Sem "R$", sem pontos de milhar, sem sinal negativo, sem vírgula decimal. Vale também para estornos e créditos — o sinal NÃO vai no amount, vai no campo "type".
   - type: "expense" para compras, serviços, assinaturas, anuidade e tarifas; "refund" para estornos, créditos e devoluções de compra (regra 2a). Se omitido, vale "expense". Estes são os ÚNICOS dois valores aceitos — uma fatura de cartão nunca gera receita, então NUNCA emita "income" nem qualquer outro valor.
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
11. O par encargo/devolução de IOF fica FORA do output, os dois lados juntos: ignore "IOF TRANSACOES INTERNACIONAIS" (o encargo, já excluído pela regra 2) e ignore também "DEVOLUCAO IOF COMPRA INTERNACIONAL" (a devolução desse mesmo encargo). Isso NÃO contradiz a regra 2a: a regra 2a trata de devolução de COMPRA; aqui a devolução é de um encargo que não entra no output, e incluir só um dos lados criaria um crédito sem contrapartida. Ignore também "PAGAMENTO PIX" (pagamento de fatura, regra 2) e linhas de subtotal como "Lançamentos no cartão (final *XXX) X.XXX,XX".
12. CONFERÊNCIA POR SOMA ASSINADA: some os "amount" com sinal — "expense" soma (+), "refund" soma (−). Esse resultado DEVE bater com "(+) Compras/Débitos" do resumo MENOS os estornos/créditos de compra do período, que é o "Total da fatura" quando o saldo anterior foi quitado integralmente. Se a soma assinada ficar muito ACIMA do alvo, você esqueceu estornos ou marcou um estorno como "expense". Se ficar muito ABAIXO, ou você esqueceu despesas, ou marcou como "refund" um pagamento de fatura que deveria estar fora (regra 2). Revise antes de responder.
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
