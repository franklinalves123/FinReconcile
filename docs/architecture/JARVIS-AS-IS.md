# JARVIS-AS-IS — FinReconcile: Estado Atual do Sistema

> **Documento:** Brownfield Analysis — As-Is State
> **Gerado por:** @architect (Aria) + @po (Pax)
> **Data:** 2026-02-24
> **Versão:** 1.0
> **Foco:** Leitura de PDFs e categorização — isolamento para crescimento modular

---

## 1. Visão Geral do Sistema

FinReconcile é um SPA (Single Page Application) React que permite a usuários importar faturas de cartão de crédito em formato PDF, extrair transações via IA, revisá-las e categorizá-las manualmente, e visualizar relatórios financeiros.

**Stack Atual:**
| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 5.8 + Vite 7 |
| UI | Tailwind CSS (CDN) + Lucide Icons + Recharts |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| IA | Google Gemini 1.5 Flash (`@google/genai` v1.34) |
| Deploy | Vercel (Serverless Functions) + cPanel (Apache) |
| Roteamento | React Router DOM v7 |

---

## 2. Mapa de Arquivos e Responsabilidades

```
FinReconcile/
├── index.tsx                    # Entry point React
├── App.tsx                      # Orquestrador global: estado, roteamento, fluxos
├── types.ts                     # Todos os tipos TypeScript do domínio
│
├── services/
│   ├── geminiService.ts         # ★ NÚCLEO: extração PDF + categorização (STUB)
│   └── dataService.ts           # CRUD Supabase (transactions, invoices, settings)
│
├── components/
│   ├── Upload.tsx               # Seleção de arquivo PDF + emissor do cartão
│   ├── Review.tsx               # Revisão e edição manual de transações extraídas
│   ├── Dashboard.tsx            # KPIs, gráficos de ciclo e categoria
│   ├── Reports.tsx              # Analytics avançado com filtros
│   ├── Invoices.tsx             # Lista de faturas importadas
│   ├── ManualEntry.tsx          # Entrada manual de transação
│   ├── Reconciliation.tsx       # Conciliação manual (fora do happy path)
│   ├── Settings.tsx             # Gerenciar categorias, tags, usuários
│   └── Auth.tsx                 # Login/signup
│
├── context/
│   └── AuthContext.tsx          # Supabase Auth Provider + sessão JWT
│
├── lib/
│   └── supabase.ts              # Supabase client init + mock fallback
│
├── api/
│   └── login.ts                 # Vercel Serverless: autenticação segura
│
└── supabase/functions/
    └── gemini-proxy/index.ts    # Deno Edge Function: proxy seguro para Gemini
```

---

## 3. Fluxo Principal: PDF → Transações → Banco

```
[Usuário seleciona PDF + emissor]
        ↓
Upload.tsx
  └─ Emite: onUploadComplete(File[], CardIssuer)
        ↓
App.tsx::handleUploadComplete()  [linha 109]
  ├─ Cria InvoiceFile temporário com status 'processing'
  ├─ Navega para /review (UI responsiva imediata)
  ├─ FileReader.readAsDataURL() → base64
  ├─ geminiService.extractInvoiceData(base64, issuer)
  ├─ geminiService.categorizeTransactions(descriptions)   ← STUB
  └─ Cria Transaction[] com status UNMATCHED + categoria 'Outros'
        ↓
Review.tsx
  ├─ Usuário edita categoria/subcategoria/tags por transação
  ├─ Usuário pode deletar transações indesejadas
  └─ Botão "Finalizar e Salvar Tudo"
        ↓
App.tsx::handleAutoFinalizeExtraction()  [linha 175]
  ├─ Marca todas as transações como MATCHED
  ├─ dataService.saveInvoice() → INSERT invoices
  ├─ dataService.saveTransactions() → INSERT transactions
  └─ Navega para Dashboard
```

---

## 4. Módulo de IA: geminiService.ts (★ PONTO CRÍTICO)

**Arquivo:** `services/geminiService.ts`

### 4.1 Função: extractInvoiceData (IMPLEMENTADA)

```typescript
// Assinatura atual
export const extractInvoiceData = async (
  fileBase64: string,
  issuer: string
): Promise<ExtractedTransaction[]>

// Tipo retornado
export interface ExtractedTransaction {
  purchaseDate: string;  // YYYY-MM-DD
  description: string;
  amount: number;
}
```

**Arquitetura de segurança em 2 camadas:**

| Camada | Ativação | Segurança | Observação |
|--------|----------|-----------|------------|
| **Layer 1** (padrão/MVP) | `VITE_USE_EDGE_FUNCTION=false` | Chave injetada no bundle JS | Chave exposta para inspeção |
| **Layer 2** (produção) | `VITE_USE_EDGE_FUNCTION=true` | Chave no servidor Supabase | Segura — chave nunca chega ao browser |

**Implementação Layer 1 (linha 65-107):**
- Envia PDF como `inlineData` (base64, `mimeType: 'application/pdf'`)
- Modelo: `gemini-1.5-flash`
- Prompt: `"Extraia despesas do ${issuer}. Retorne JSON com data, descrição e valor."`
- Output forçado via `responseSchema` (structured JSON output)
- Retorna array de `{ purchaseDate, description, amount }`

**Implementação Layer 2 (linha 40-63):**
- POST para `${VITE_SUPABASE_URL}/functions/v1/gemini-proxy`
- Autenticado via JWT do usuário logado
- Supabase Edge Function (Deno) faz a chamada real ao Gemini
- Scaffold disponível em `supabase/functions/gemini-proxy/index.ts`

### 4.2 Função: categorizeTransactions (STUB — NÃO IMPLEMENTADA)

```typescript
// Implementação atual (linha 109-113)
export const categorizeTransactions = async (descriptions: string[]) => {
  const map: Record<string, string> = {};
  descriptions.forEach(d => map[d] = 'Outros');  // STUB: sempre retorna 'Outros'
  return map;
};
```

**Estado:** Função existe mas não faz nada útil. Todas as transações recebem categoria `'Outros'` independente da descrição.

**Onde é chamada:** `App.tsx:134` — logo após `extractInvoiceData()`

**Impacto:** O usuário precisa categorizar 100% das transações manualmente na tela Review.

### 4.3 Função: generateInsights (STUB)

```typescript
export const generateInsights = async (transactions: any[]) => "Insights em breve.";
```

---

## 5. Categorização: Como Funciona Hoje

### 5.1 Categorias Padrão (hardcoded em App.tsx:19-28)

```typescript
const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Alimentação',   subcategories: ['Restaurante', 'Mercado'],     color: '#EF4444' },
  { id: 'c2', name: 'Transporte',    subcategories: ['Uber/99', 'Combustível'],     color: '#F59E0B' },
  { id: 'c3', name: 'Compras',       subcategories: ['Roupas', 'Eletrônicos'],      color: '#3B82F6' },
  { id: 'c4', name: 'Saúde',         subcategories: ['Médico', 'Farmácia'],         color: '#10B981' },
  { id: 'c5', name: 'Educação',      subcategories: ['Cursos', 'Livros'],           color: '#8B5CF6' },
  { id: 'c6', name: 'Viagem',        subcategories: ['Hospedagem', 'Passagem'],     color: '#EC4899' },
  { id: 'c7', name: 'Serviços',      subcategories: ['Assinaturas', 'Manutenção'], color: '#6366F1' },
  { id: 'c8', name: 'Outros',        subcategories: [],                             color: '#9CA3AF' },
];
```

### 5.2 Pontos de Atribuição de Categoria

| Ponto | Local | Mecanismo |
|-------|-------|-----------|
| **Automático pós-extração** | `App.tsx:142` | `aiCategories[item.description] \|\| 'Outros'` (sempre 'Outros' pelo STUB) |
| **Edição manual pelo usuário** | `Review.tsx:181-194` | Dropdown com lista de categorias |
| **Criação de nova subcategoria** | `Review.tsx` | `handleCreateSubcategory()` — cria e persiste via Settings |
| **Entrada manual** | `ManualEntry.tsx:19` | Campo obrigatório no formulário |

### 5.3 Persistência de Categorias

- Salvas na tabela `user_settings` como JSONB (por usuário)
- Carregadas ao login em `App.tsx::loadData()` (linha 53-80)
- Sincronizadas via `dataService.updateUserSettings()`

---

## 6. Modelo de Dados

### 6.1 Tipo Transaction (types.ts:13-28)

```typescript
export interface Transaction {
  id: string;
  date: string;              // Igual a purchaseDate (campo legado)
  purchaseDate: string;      // YYYY-MM-DD — data real da compra
  description: string;       // Texto livre da fatura
  amount: number;            // Valor em R$
  category: string;          // Nome da categoria (e.g., "Alimentação")
  subcategory?: string;      // Nome da subcategoria (e.g., "Restaurante")
  tags?: string[];           // Array de nomes de tags
  invoiceId: string;         // FK para InvoiceFile ou 'manual-entry'
  status: MatchStatus;       // UNMATCHED | SUGGESTED | MATCHED | IGNORED
  cardIssuer?: CardIssuer;   // Emissor do cartão
  confidence?: number;       // Campo existente mas não usado
  matchedTransactionId?: string; // Para conciliação manual
  notes?: string;            // Notas livres
}
```

### 6.2 Tabelas Supabase (inferido de dataService.ts)

**transactions:**
```sql
id            uuid PRIMARY KEY
user_id       uuid → auth.users
invoice_id    uuid NULLABLE → invoices.id  -- NULL para entrada manual
purchase_date date
description   text
amount        numeric
category      text
subcategory   text NULLABLE
tags          jsonb  -- string[]
status        text   -- UNMATCHED|SUGGESTED|MATCHED|IGNORED
card_issuer   text
notes         text NULLABLE
```

**invoices:**
```sql
id                uuid PRIMARY KEY
user_id           uuid → auth.users
name              text   -- nome do arquivo PDF
size              integer -- bytes
upload_date       timestamp
status            text   -- pending|processing|parsed|error
transaction_count integer NULLABLE
card_issuer       text
```

**user_settings:**
```sql
user_id     uuid PRIMARY KEY → auth.users
categories  jsonb  -- Category[]
tags        jsonb  -- Tag[]
updated_at  timestamp
```

---

## 7. Diagnóstico de Acoplamento Atual

O sistema tem **alto acoplamento** entre as responsabilidades de extração, categorização e orquestração:

```
App.tsx (GOD COMPONENT)
  ├─ Estado global: transactions, files, categories, tags, user, isProcessing
  ├─ Orquestra fluxo PDF: chama geminiService, constrói Transaction[], navega
  ├─ Persiste dados: chama dataService direto
  ├─ Gerencia categorias: handleUpdateCategories, handleUpdateTags
  └─ Controla todas as rotas e callbacks de filhos
```

**Problema:** `geminiService.ts` mistura duas responsabilidades distintas:
1. **Extração de dados do PDF** (via Gemini Vision) — bem implementada
2. **Categorização de transações** (via Gemini Text) — apenas stub

---

## 8. Proposta de Isolamento em Módulo Independente

Para suportar o crescimento do sistema, a lógica de IA deve ser isolada em um módulo dedicado. A estrutura recomendada é:

```
services/
├── ai/                          ← NOVO MÓDULO ISOLADO
│   ├── index.ts                 # Exports públicos do módulo
│   ├── pdfExtractor.ts          # extractInvoiceData() — MIGRAR de geminiService.ts
│   ├── categorizer.ts           # categorizeTransactions() — IMPLEMENTAR aqui
│   ├── insightsEngine.ts        # generateInsights() — IMPLEMENTAR aqui
│   ├── geminiClient.ts          # GoogleGenAI client, config, segurança
│   └── types.ts                 # Tipos internos do módulo IA
│
├── dataService.ts               # Mantém: CRUD Supabase
└── geminiService.ts             # DEPRECAR após migração
```

**Contratos do módulo (interfaces públicas):**

```typescript
// ai/types.ts — contratos do módulo
export interface ExtractedTransaction {
  purchaseDate: string;
  description: string;
  amount: number;
}

export interface CategorySuggestion {
  description: string;
  suggestedCategory: string;
  suggestedSubcategory?: string;
  confidence: number;
}

export interface AIModuleConfig {
  apiKey: string;
  useEdgeFunction: boolean;
  model: string;
}
```

---

## 9. Dívida Técnica Identificada

### CRÍTICA (Bloqueadores de produção)

| ID | Problema | Arquivo | Linha |
|----|---------|---------|-------|
| TD-01 | Chave Gemini injetada no bundle JS | `geminiService.ts` | 21 |
| TD-02 | RLS não verificado no código cliente | `dataService.ts` | — |

### ALTA (Impacto em funcionalidade)

| ID | Problema | Arquivo | Linha |
|----|---------|---------|-------|
| TD-04 | `categorizeTransactions()` é stub — retorna sempre 'Outros' | `geminiService.ts` | 109-113 |
| TD-05 | `systemTransactions` hardcoded — conciliação não funciona em produção | `App.tsx` | 74-77 |
| TD-06 | DELETE de fatura não apaga transações (orphaned records) | `dataService.ts` | 103-111 |
| TD-07 | `saveTransactions()` usa INSERT sem UPSERT — reimport cria duplicatas | `dataService.ts` | 57 |
| TD-08 | Sem error boundaries — crashes silenciosos | `App.tsx` | — |

### MÉDIA (Qualidade)

| ID | Problema | Arquivo |
|----|---------|---------|
| TD-10 | Conflito de versão Vite (7.3 no dep vs 6.2 em devDep) | `package.json` |
| TD-12 | `window.prompt()` / `window.confirm()` — UX inadequada para produção | `App.tsx`, `Invoices.tsx` |
| TD-15 | `getCycleInfo()` duplicado entre Dashboard e Reports | `Dashboard.tsx`, `Reports.tsx` |
| TD-16 | `App.tsx` é God Component — concentra estado e lógica demais | `App.tsx` |

---

## 10. Emissores de Cartão Suportados

```typescript
type CardIssuer = 'Inter' | 'Santander' | 'Bradesco' | 'BRB' | 'Porto Bank' | 'Itaú' | 'Outros';
```

O prompt enviado ao Gemini inclui o emissor selecionado pelo usuário, o que pode melhorar a extração em PDFs com formatos específicos por banco.

---

## 11. Status de Implementação por Funcionalidade

| Funcionalidade | Status | Observação |
|---------------|--------|-----------|
| Upload de PDF | ✅ Implementado | Drag-and-drop + seleção manual |
| Extração via Gemini (Layer 1) | ✅ Implementado | Direto, chave no bundle |
| Extração via Edge Function (Layer 2) | ✅ Scaffold pronto | Ativar com `VITE_USE_EDGE_FUNCTION=true` |
| Categorização automática por IA | ❌ Stub | Sempre retorna 'Outros' |
| Revisão manual de transações | ✅ Implementado | Review.tsx completo |
| Persistência no Supabase | ✅ Implementado | INSERT simples (sem upsert) |
| Dashboard + KPIs | ✅ Implementado | Ciclos mensais, por categoria |
| Relatórios avançados | ✅ Implementado | Filtros por período, categoria, emissor |
| Conciliação bancária | ⚠️ Incompleto | Sistema mock, sem dados reais |
| Insights por IA | ❌ Stub | Retorna string fixa |
| Multi-usuário (RBAC) | ⚠️ Parcial | role: 'master' \| 'user' definido, sem enforcement |

---

## 12. Decisão de Arquitetura: Por que Isolar o Módulo de IA

### Motivação
O sistema vai crescer para incluir:
- Categorização inteligente com aprendizado por usuário
- Detecção de duplicatas
- Insights financeiros automatizados
- Suporte a novos formatos além de PDF (OFX, CSV)
- Potencialmente outros modelos além do Gemini

### Problema atual
`geminiService.ts` acumula responsabilidades que terão implementações independentes e complexas. O acoplamento atual impede:
- Testes unitários isolados
- Troca de modelo/provider de IA sem afetar extração
- Evolução independente de extração vs categorização

### Fronteira do módulo `services/ai/`

**Dentro do módulo (privado):**
- Client Gemini (instância, autenticação, retry)
- Prompts específicos por função
- Schemas de resposta estruturada
- Lógica de fallback entre Layer 1 e Layer 2

**Fora do módulo (público via `index.ts`):**
- `extractInvoiceData(base64, issuer): Promise<ExtractedTransaction[]>`
- `categorizeTransactions(descriptions, userCategories): Promise<CategorySuggestion[]>`
- `generateInsights(transactions): Promise<string>`

**O módulo NÃO deve:**
- Conhecer componentes React
- Acessar Supabase diretamente
- Gerenciar estado da aplicação
- Lidar com navegação

---

## Referências

- **Código fonte:** `services/geminiService.ts`, `App.tsx`, `types.ts`, `services/dataService.ts`
- **PRD:** `docs/prd/finreconcile-mvp.md`
- **Arquitetura atual:** `docs/architecture/current-state.md`
- **Edge Function:** `supabase/functions/gemini-proxy/index.ts`

---

*Documento gerado por @architect (Aria) + @po (Pax) via brownfield analysis — 2026-02-24*
