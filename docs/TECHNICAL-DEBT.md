# TECHNICAL-DEBT — FinReconcile: Plano de Refatoração

> **Documento:** Auditoria de Dívida Técnica + Plano de Ação
> **Auditores:** @dev (Dex) + @qa (QA Gate)
> **Base:** JARVIS-AS-IS.md (2026-02-24)
> **Data:** 2026-02-24
> **Versão:** 1.0
> **Objetivo:** Limpar a casa e modularizar o código para receber os motores de Tarefas e Hábitos do Jarvis

---

## Sumário Executivo

O sistema está **funcional mas frágil**. O happy path (PDF → extração → revisão → salvar) funciona. Porém a arquitetura atual impede crescimento seguro: um único componente (`App.tsx`) controla estado global, orquestra chamadas de IA, persiste dados e gerencia navegação. A lógica de IA está em um único arquivo com funções stub inacabadas. Qualquer novo módulo — Tarefas, Hábitos, múltiplos providers de IA — vai aumentar o caos existente, a não ser que a casa seja organizada antes.

**Este plano é sequencial e incremental.** Cada fase é autossuficiente e entrega valor sem quebrar o que já funciona.

---

## Inventário de Dívidas (Auditoria Completa)

### Severidade CRÍTICA — Bloqueadores para produção real

| ID | Título | Arquivo | Linhas | Impacto |
|----|--------|---------|--------|---------|
| **TD-01** | Chave Gemini injetada no bundle JS compilado | `geminiService.ts` | 21 | Qualquer usuário que inspecionar o JS do deploy pode extrair a API key e fazer chamadas no seu crédito |
| **TD-02** | RLS do Supabase não verificado no código cliente | `dataService.ts` | todos os métodos | Sem garantia de isolamento de dados entre usuários em produção |

---

### Severidade ALTA — Funcionalidades quebradas ou com risco real de dados

#### TD-04 — `categorizeTransactions()` é um stub completo

**Arquivo:** `services/geminiService.ts:109-113`

```typescript
// Código atual — NÃO faz nada útil
export const categorizeTransactions = async (descriptions: string[]) => {
  const map: Record<string, string> = {};
  descriptions.forEach(d => map[d] = 'Outros');  // sempre 'Outros'
  return map;
};
```

**Impacto direto:** 100% das transações importadas chegam com categoria `'Outros'`. O usuário precisa categorizar cada transação manualmente. Isso destrói a proposta de valor do produto (o Gemini JÁ tem o contexto do PDF e poderia categorizar com alta precisão).

**Raiz do problema:** A função foi criada com a assinatura correta mas o corpo nunca foi implementado. O nome sugere IA mas não há chamada ao Gemini.

---

#### TD-05 — `systemTransactions` hardcoded em App.tsx

**Arquivo:** `App.tsx:74-77`

```typescript
setSystemTransactions([
  { id: 'sys1', date: '2025-12-02', description: 'CesaCentroDeVI 01/03', amount: 528.34, account: 'Itaú Personalité' },
  { id: 'sys2', date: '2025-08-28', description: 'DECOLAR COM LTDA', amount: 3070.18, account: 'BRB Visa Platinum' }
]);
```

**Impacto:** A tela de Reconciliação (`/reconcile`) nunca vai funcionar em produção. Dois registros mock hardcoded com datas de 2025 não representam nenhuma realidade do usuário.

---

#### TD-06 — DELETE de fatura não cascata para transações

**Arquivo:** `dataService.ts:103-111`

```typescript
async deleteInvoice(invoiceId: string, userId: string) {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('user_id', userId);
  // Nenhum delete correspondente em transactions
}
```

**Impacto:** Ao deletar uma fatura pela tela Invoices, todas as transações associadas ficam órfãs no banco (com `invoice_id` apontando para um registro que não existe mais). Esses registros fantasmas aparecem no Dashboard e Reports como se fossem válidos.

**Fix correto:** Adicionar `ON DELETE CASCADE` na FK no banco, OU fazer delete explícito das transações antes de deletar a fatura.

---

#### TD-07 — `saveTransactions()` usa INSERT sem UPSERT

**Arquivo:** `dataService.ts:57`

```typescript
const { error } = await supabase.from('transactions').insert(txsToSave);
```

**Impacto:** Se o usuário reimportar a mesma fatura (por acidente ou bug), todas as transações são inseridas duplicadas. Não há proteção contra isso. Cada importação é sempre um INSERT novo.

**Fix:** Usar `upsert` com `onConflict` em uma chave natural composta (ex: `user_id + invoice_id + description + purchase_date + amount`), ou adicionar constraint UNIQUE no banco.

---

#### TD-08 — Sem error boundaries — crashes silenciosos

**Arquivo:** `App.tsx`, `index.tsx`

Qualquer exceção não capturada em componente React derruba toda a UI sem feedback ao usuário. Os únicos tratamentos de erro são `alert()` em alguns handlers do `App.tsx` — sem logging, sem fallback visual, sem retry.

---

### Severidade MÉDIA — Qualidade e manutenibilidade

#### TD-10 — Conflito de versão Vite

**Arquivo:** `package.json`

```json
"dependencies": { "vite": "^7.3.0" },
"devDependencies": { "vite": "^6.2.0" }
```

Vite está declarado em **ambos** `dependencies` e `devDependencies` com versões incompatíveis. Isso é um erro de configuração que pode gerar comportamento imprevisível dependendo de qual versão o npm resolve. Vite deve estar apenas em `devDependencies`.

---

#### TD-12 — `window.prompt()` / `window.confirm()` em uso

**Arquivo:** `Review.tsx:62`, `Review.tsx:78`, `App.tsx:162`

```typescript
// Review.tsx
const name = window.prompt("Nome da nova categoria:");
if (exists) return alert("Esta categoria já existe.");
// App.tsx
if (!confirm("Apagar esta fatura permanentemente?")) return;
```

**Impacto:** Péssima UX (caixas de diálogo nativas do browser, não estilizáveis), bloqueia a thread principal, e em alguns ambientes (Vercel, PWA, Safari em alguns contextos) podem ser suprimidos silenciosamente.

---

#### TD-15 — `getCycleInfo()` duplicado em Dashboard e Reports

**Arquivo:** `Dashboard.tsx:32-53` e `Reports.tsx:42-61`

A função `getCycleInfo()` é **copiada literalmente** entre os dois componentes. Qualquer mudança na lógica de ciclo precisa ser aplicada em dois lugares. Já divergiu ligeiramente: Dashboard verifica `if (f.id)` antes de popular o map; Reports não. Essa inconsistência vai crescer.

```typescript
// Em Dashboard.tsx:32
const getCycleInfo = (t: Transaction) => { ... }

// Em Reports.tsx:42 — código idêntico
const getCycleInfo = (t: Transaction) => { ... }
```

**Fix:** Extrair para `lib/cycleUtils.ts` e importar nos dois componentes.

---

#### TD-16 — `App.tsx` é um God Component (★ FOCO PRINCIPAL)

**Arquivo:** `App.tsx` (318 linhas, mas com responsabilidades que crescerão indefinidamente)

**Auditoria das responsabilidades atuais de App.tsx:**

| Responsabilidade | Deveria estar em |
|-----------------|-----------------|
| Estado global: `transactions`, `files`, `categories`, `tags` | Context dedicado ou store |
| Estado temporário de upload: `currentFileEntry`, `isProcessing` | Hook `useUploadFlow` |
| Lógica de conversão base64 → File | `services/ai/pdfExtractor.ts` |
| Orquestração do fluxo PDF completo | Hook `useInvoiceImport` |
| Categorias padrão hardcoded | `constants/categories.ts` |
| Tags padrão hardcoded | `constants/tags.ts` |
| Dados mock de systemTransactions | Deve vir do banco |
| Callbacks para todos os filhos | Componentes mais autossuficientes |
| Layout global (sidebar, header) | `components/layout/AppShell.tsx` |
| Definição de todas as rotas | `router.tsx` ou `routes/index.tsx` |

**Problema para o Jarvis:** Quando os motores de Tarefas e Hábitos chegarem, cada um vai precisar de seu próprio estado, suas próprias rotas, suas próprias chamadas de serviço. Se seguirmos o padrão atual, `App.tsx` vai triplicar de tamanho e se tornar ingerenciável.

---

## Plano de Ação — Refatoração Sequencial

> Regra de ouro: **cada fase mantém o sistema 100% funcional ao final**. Nenhum passo quebra o que já funciona. A ordem importa — fases posteriores dependem das anteriores.

---

### FASE 1 — Correções Imediatas (sem refatoração estrutural)
**Esforço:** Baixo | **Risco:** Muito baixo | **Benefício:** Sistema mais seguro e correto hoje

#### 1.1 — Corrigir package.json (TD-10)
Remover `vite` de `dependencies`, manter apenas em `devDependencies` na versão correta.

```json
// ANTES
"dependencies": { "vite": "^7.3.0", ... },
"devDependencies": { "vite": "^6.2.0", ... }

// DEPOIS
"dependencies": { /* sem vite */ },
"devDependencies": { "vite": "^6.2.0", ... }
```

#### 1.2 — Corrigir cascade delete de transações (TD-06)
Adicionar SQL de migração no Supabase para criar a constraint de CASCADE, ou adicionar delete explícito antes do delete da fatura em `dataService.ts`.

**SQL de migração:**
```sql
-- Migração: adicionar cascade delete em transactions.invoice_id
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_invoice_id_fkey,
  ADD CONSTRAINT transactions_invoice_id_fkey
    FOREIGN KEY (invoice_id)
    REFERENCES invoices(id)
    ON DELETE CASCADE;
```

#### 1.3 — Corrigir UPSERT em saveTransactions (TD-07)
Substituir `insert` por `upsert` com estratégia de conflito definida.

#### 1.4 — Ativar Layer 2 (Edge Function) para chave Gemini (TD-01)
Configurar `VITE_USE_EDGE_FUNCTION=true` no ambiente de produção e garantir que a Edge Function `gemini-proxy` está deployada no Supabase.

---

### FASE 2 — Extrair Utilitários Compartilhados
**Esforço:** Baixo | **Risco:** Muito baixo | **Benefício:** Elimina duplicação, prepara para crescimento

#### 2.1 — Criar `lib/cycleUtils.ts` (resolve TD-15)
Extrair `getCycleInfo()` (e o `invoiceDateMap` builder) para uma função utilitária pura.

**Arquivo novo:** `lib/cycleUtils.ts`
```typescript
// Função pura — sem dependências React
export function buildInvoiceDateMap(files: InvoiceFile[]): Record<string, string>
export function getCycleInfo(t: Transaction, invoiceDateMap: Record<string, string>): { label: string; order: number }
```

Atualizar `Dashboard.tsx` e `Reports.tsx` para importar de `lib/cycleUtils.ts`.

#### 2.2 — Criar `constants/initialData.ts` (parte do TD-16)
Mover `INITIAL_CATEGORIES` e `DEFAULT_TAGS` para fora do `App.tsx`:

**Arquivo novo:** `constants/initialData.ts`
```typescript
export const INITIAL_CATEGORIES: Category[] = [...]
export const DEFAULT_TAGS: Tag[] = [...]
```

---

### FASE 3 — Modularizar o Módulo de IA (TD-04 + parte do TD-16)
**Esforço:** Médio | **Risco:** Baixo (sem mudança de comportamento externo) | **Benefício:** Habilita implementação real de categorização e preparação para o motor Jarvis

Esta é a fase mais importante para o futuro do sistema.

#### 3.1 — Criar estrutura `services/ai/`

```
services/ai/
├── index.ts          # Único ponto de export público do módulo
├── client.ts         # GoogleGenAI instance + config de segurança (Layer 1/2)
├── pdfExtractor.ts   # extractInvoiceData() — migrado de geminiService.ts
├── categorizer.ts    # categorizeTransactions() — IMPLEMENTAR com Gemini real
├── types.ts          # ExtractedTransaction, CategorySuggestion, AIModuleConfig
└── prompts.ts        # Prompts centralizados e versionados
```

#### 3.2 — Migrar `geminiService.ts` → `services/ai/`

| Função atual | Novo local | Status |
|-------------|-----------|--------|
| `extractInvoiceData()` | `services/ai/pdfExtractor.ts` | Migrar sem mudança |
| `categorizeTransactions()` | `services/ai/categorizer.ts` | Implementar com Gemini real |
| `generateInsights()` | `services/ai/insightsEngine.ts` | Implementar na próxima fase |
| Config de chave/edgeFunction | `services/ai/client.ts` | Centralizar |

#### 3.3 — Implementar `categorizeTransactions()` de verdade (resolve TD-04)

**Contrato da nova implementação:**
```typescript
// services/ai/categorizer.ts
export interface CategorySuggestion {
  description: string;
  suggestedCategory: string;
  suggestedSubcategory?: string;
  confidence: number;  // 0-1
}

export async function categorizeTransactions(
  descriptions: string[],
  availableCategories: string[]   // categorias do usuário como contexto
): Promise<CategorySuggestion[]>
```

**Estratégia do prompt:**
- Enviar batch de descrições (uma chamada para N transações — economiza tokens)
- Passar a lista de categorias disponíveis do usuário como contexto
- Usar `responseSchema` estruturado para garantir output válido
- Incluir campo `confidence` para que o frontend possa destacar sugestões incertas

#### 3.4 — Atualizar `App.tsx` para usar o novo módulo

```typescript
// ANTES (App.tsx:16)
import { categorizeTransactions, extractInvoiceData } from './services/geminiService.ts';

// DEPOIS
import { extractInvoiceData, categorizeTransactions } from './services/ai/index.ts';
```

A assinatura pública muda para passar `categories` como parâmetro:
```typescript
const aiCategories = await categorizeTransactions(
  extractedData.map(d => d.description),
  categories.map(c => c.name)  // contexto das categorias do usuário
);
```

#### 3.5 — Deprecar `geminiService.ts`

Manter o arquivo temporariamente como re-export do novo módulo para não quebrar nada, com comentário de deprecação:
```typescript
// DEPRECATED: Use services/ai/index.ts directly
// This file will be removed in the next cleanup cycle
export { extractInvoiceData, categorizeTransactions, generateInsights } from './ai/index.ts';
```

---

### FASE 4 — Decompor App.tsx (resolve TD-16)
**Esforço:** Alto | **Risco:** Médio (refatoração estrutural) | **Benefício:** Base sólida para Jarvis

Esta fase transforma o God Component em um orquestrador limpo.

#### 4.1 — Criar hook `useAppData()`
Extrair toda a lógica de carregamento de dados:

**Arquivo novo:** `hooks/useAppData.ts`
```typescript
// Responsabilidade: carregar e sincronizar dados do Supabase
export function useAppData(userId: string) {
  return {
    transactions,      // Transaction[]
    files,             // InvoiceFile[]
    categories,        // Category[]
    tags,              // Tag[]
    isLoading,
    loadData,
    handleUpdateCategories,
    handleUpdateTags,
  }
}
```

#### 4.2 — Criar hook `useInvoiceImport()`
Extrair todo o fluxo de importação de PDF:

**Arquivo novo:** `hooks/useInvoiceImport.ts`
```typescript
// Responsabilidade: orquestrar o fluxo PDF → extração → categorização
export function useInvoiceImport(categories: Category[]) {
  return {
    currentFileEntry,  // InvoiceFile | null
    pendingTransactions,
    isProcessing,
    handleUploadComplete,      // File[], CardIssuer → void
    handleAutoFinalize,        // void
    updatePendingTransaction,  // id, updates → void
    deletePendingTransaction,  // id → void
  }
}
```

#### 4.3 — Criar `components/layout/AppShell.tsx`
Extrair o layout estrutural (sidebar, header, loading overlay):

**Arquivo novo:** `components/layout/AppShell.tsx`
```typescript
// Responsabilidade: estrutura visual da aplicação autenticada
// Sidebar com navegação, header com título e usuário, loading overlay
```

#### 4.4 — Criar `router.tsx` (ou `routes/index.tsx`)
Mover a definição de `<Routes>` e `<Route>` para fora do `App.tsx`:

**Arquivo novo:** `routes/index.tsx`
```typescript
// Responsabilidade: mapear rotas para componentes
// Recebe os handlers via props ou context, sem conter lógica de negócio
```

#### 4.5 — `App.tsx` resultante
Após a decomposição, o `App.tsx` deve ter no máximo ~50 linhas e orquestrar sem implementar:

```typescript
// App.tsx — resultado esperado após Fase 4
const AppContent: React.FC = () => {
  const { user, signOut } = useAuth();
  const appData = useAppData(user?.id);
  const importFlow = useInvoiceImport(appData.categories);

  if (!user) return <Auth />;

  return (
    <AppShell user={user} onSignOut={signOut}>
      <AppRoutes appData={appData} importFlow={importFlow} />
    </AppShell>
  );
};
```

---

### FASE 5 — Substituir `window.prompt`/`confirm` por modais (TD-12)
**Esforço:** Médio | **Risco:** Baixo | **Benefício:** UX profissional

Criar componentes de modal reutilizáveis:

```
components/ui/
├── Button.tsx          (já existe)
├── ConfirmDialog.tsx   ← NOVO: substitui window.confirm()
└── InputDialog.tsx     ← NOVO: substitui window.prompt()
```

**`ConfirmDialog`** — para "Apagar esta fatura permanentemente?"
**`InputDialog`** — para "Nome da nova categoria:" e "Nova subcategoria para X:"

Usar state local nos componentes (não precisa de Context para isso).

---

### FASE 6 — Error Boundaries e tratamento global (TD-08)
**Esforço:** Baixo | **Risco:** Muito baixo | **Benefício:** Resiliência

#### 6.1 — Criar `components/ErrorBoundary.tsx`
```typescript
// Captura erros React e mostra UI de fallback em vez de tela branca
class ErrorBoundary extends React.Component<Props, State> {
  // Exibir mensagem amigável + botão "Recarregar"
}
```

#### 6.2 — Envolver App com ErrorBoundary em `index.tsx`
```typescript
// index.tsx
root.render(
  <ErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ErrorBoundary>
);
```

---

## Mapa de Dependências entre Fases

```
FASE 1 (Correções imediatas)
  └─ Independente — pode rodar agora

FASE 2 (Utilitários compartilhados)
  └─ Independente de Fase 1

FASE 3 (Módulo de IA)
  └─ Independente das Fases 1 e 2
  └─ Pré-requisito para Fase 4 (App.tsx precisa do novo import)

FASE 4 (Decompor App.tsx)
  └─ Requer Fase 3 completa
  └─ Requer Fase 2 completa (para usar cycleUtils e initialData)

FASE 5 (Modais)
  └─ Independente — pode rodar em paralelo com Fase 4

FASE 6 (Error Boundaries)
  └─ Independente — pode rodar a qualquer momento
```

**Ordem de execução recomendada:**
```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 + Fase 6 (paralelas)
```

---

## Preparação para os Motores Jarvis (Tarefas e Hábitos)

Após completar as 6 fases acima, a base estará pronta para receber novos módulos sem degradar o código existente. A estrutura target será:

```
FinReconcile/
├── App.tsx                          # Orquestrador limpo (~50 linhas)
├── types.ts                         # Tipos do domínio financeiro
│
├── routes/
│   └── index.tsx                    # Definição de rotas
│
├── hooks/
│   ├── useAppData.ts                # Estado global de dados
│   └── useInvoiceImport.ts          # Fluxo de importação de PDF
│
├── constants/
│   └── initialData.ts               # INITIAL_CATEGORIES, DEFAULT_TAGS
│
├── lib/
│   ├── supabase.ts                  # Client Supabase
│   └── cycleUtils.ts                # getCycleInfo, buildInvoiceDateMap
│
├── services/
│   ├── dataService.ts               # CRUD Supabase (financial)
│   ├── ai/                          # Módulo IA isolado
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── pdfExtractor.ts
│   │   ├── categorizer.ts
│   │   ├── insightsEngine.ts
│   │   ├── prompts.ts
│   │   └── types.ts
│   │
│   ├── tasks/                       ← FUTURO: Motor de Tarefas
│   │   ├── index.ts
│   │   ├── taskService.ts
│   │   └── types.ts
│   │
│   └── habits/                      ← FUTURO: Motor de Hábitos
│       ├── index.ts
│       ├── habitService.ts
│       └── types.ts
│
├── components/
│   ├── layout/
│   │   └── AppShell.tsx             # Sidebar + Header
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── ConfirmDialog.tsx        # Substitui window.confirm
│   │   ├── InputDialog.tsx          # Substitui window.prompt
│   │   └── ErrorBoundary.tsx
│   └── [features]/                  # Componentes por domínio
│
└── context/
    └── AuthContext.tsx
```

**Por que essa estrutura suporta crescimento:**
- Cada motor (financeiro, tarefas, hábitos) vive em `services/{módulo}/`
- Nenhum motor conhece os internos do outro
- `App.tsx` orquestra mas não implementa nada
- Hooks encapsulam a lógica de estado por domínio
- `services/ai/` é provider-agnóstico — pode trocar Gemini por GPT-4 ou Claude sem tocar nos componentes

---

## Checklist de Conclusão

### Fase 1
- [ ] `package.json`: remover `vite` de `dependencies`
- [ ] Supabase: adicionar `ON DELETE CASCADE` em `transactions.invoice_id`
- [ ] `dataService.ts`: substituir INSERT por UPSERT em `saveTransactions()`
- [ ] Configurar `VITE_USE_EDGE_FUNCTION=true` em produção (TD-01)

### Fase 2
- [ ] Criar `lib/cycleUtils.ts` com `buildInvoiceDateMap` e `getCycleInfo`
- [ ] Atualizar `Dashboard.tsx` para usar `cycleUtils`
- [ ] Atualizar `Reports.tsx` para usar `cycleUtils`
- [ ] Criar `constants/initialData.ts`
- [ ] Atualizar `App.tsx` para importar de `constants/initialData.ts`

### Fase 3
- [ ] Criar `services/ai/types.ts`
- [ ] Criar `services/ai/client.ts` (migrar config Gemini)
- [ ] Criar `services/ai/prompts.ts`
- [ ] Criar `services/ai/pdfExtractor.ts` (migrar `extractInvoiceData`)
- [ ] Criar `services/ai/categorizer.ts` (implementar com Gemini real)
- [ ] Criar `services/ai/index.ts` (exports públicos)
- [ ] Deprecar `services/geminiService.ts` (re-export temporário)
- [ ] Atualizar `App.tsx` para importar de `services/ai/index.ts`
- [ ] Testar: importar PDF, verificar que categorias não são mais todas 'Outros'

### Fase 4
- [ ] Criar `hooks/useAppData.ts`
- [ ] Criar `hooks/useInvoiceImport.ts`
- [ ] Criar `components/layout/AppShell.tsx`
- [ ] Criar `routes/index.tsx`
- [ ] Refatorar `App.tsx` para usar os novos hooks e componentes
- [ ] Testar: todos os fluxos funcionando após decomposição

### Fase 5
- [ ] Criar `components/ui/ConfirmDialog.tsx`
- [ ] Criar `components/ui/InputDialog.tsx`
- [ ] Substituir `window.confirm` em `App.tsx`
- [ ] Substituir `window.prompt` e `alert` em `Review.tsx`

### Fase 6
- [ ] Criar `components/ui/ErrorBoundary.tsx`
- [ ] Envolver App em `index.tsx`
- [ ] Testar: simular erro e verificar fallback

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Fase 3 quebrar extração de PDF | Baixa | Manter `geminiService.ts` como fallback até testes passarem |
| Fase 4 introduzir bug de estado | Média | Testar cada hook isoladamente antes de remover do App.tsx |
| Custo de tokens com categorização real (TD-04) | Média | Implementar batching — uma chamada Gemini por fatura, não por transação |
| Categorização real com baixa precisão | Média | Incluir `confidence` no contrato — UI destaca sugestões abaixo de 0.7 |

---

*Documento produzido por @dev (Dex) + @qa — auditoria de código 2026-02-24*
*Próximo passo recomendado: @sm criar stories para Fase 1 (correções imediatas) e Fase 3 (módulo de IA)*
