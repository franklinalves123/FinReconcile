# FinReconcile — Estado Atual da Arquitetura

> Gerado por: Brownfield Discovery — @architect
> Data: 2026-02-20
> Versão analisada: commit `2548105` (branch `main`)

---

## 1. Visão Geral do Produto

FinReconcile é uma **ferramenta de conciliação de finanças pessoais** que permite ao usuário:

1. Importar faturas de cartão de crédito em PDF (múltiplos bancos brasileiros)
2. Extrair transações automaticamente via Google Gemini AI
3. Revisar, categorizar e taggear os lançamentos extraídos
4. Registrar lançamentos manuais
5. Visualizar gastos por ciclo de pagamento (dashboard)
6. Analisar despesas com filtros avançados (relatórios)
7. Gerenciar categorias, subcategorias e tags

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão | Observação |
|--------|-----------|--------|------------|
| Frontend | React | 19.2.3 | Hooks, sem class components |
| Linguagem | TypeScript | 5.8.2 | Sem strict mode habilitado |
| Roteamento | React Router DOM | 7.11.0 | — |
| Build | Vite | 7.3 (dep) / **6.2 (devDep)** | **CONFLITO DE VERSÃO** |
| Estilização | Tailwind CSS | CDN (não npm) | Sem purging; extensões via `tailwind.config` inline |
| Ícones | Lucide React | 0.562.0 | — |
| Gráficos | Recharts | 3.6.0 | — |
| BaaS / Auth | Supabase | 2.89.0 | PostgreSQL + Auth email/password |
| AI | Google Gemini | @google/genai 1.34 | Modelo: `gemini-3-flash-preview` (verificar nome) |
| Hospedagem | cPanel (Apache) | — | SPA via `.htaccess` rewrite |

---

## 3. Estrutura de Pastas

```
FinReconcile/
├── index.html               # Shell HTML (Tailwind CDN, API_KEY exposta, importmap ESM)
├── index.tsx                # Entry point React
├── App.tsx                  # Raiz: roteamento, estado global, data loading
├── types.ts                 # Todos os tipos/interfaces TypeScript
├── vite.config.ts           # Build config (base: './', chunks manuais)
├── package.json             # Dependências
├── .gitignore               # Existe, mas não exclui ._* files
├── .htaccess                # Apache SPA rewrite rules
│
├── context/
│   └── AuthContext.tsx      # Provider Supabase auth (session, user, signOut)
│
├── lib/
│   └── supabase.ts          # Cliente Supabase (credenciais hardcoded + mock fallback)
│
├── services/
│   ├── dataService.ts       # CRUD: transactions, invoices, user_settings
│   └── geminiService.ts     # AI: extractInvoiceData (real) | categorizeTransactions (STUB)
│
└── components/
    ├── Auth.tsx             # Tela de login/cadastro
    ├── Dashboard.tsx        # KPIs + gráfico de barras + pie chart por categoria
    ├── Upload.tsx           # Upload PDF + seletor de emissor
    ├── Review.tsx           # Tabela de revisão + modal de edição inline
    ├── Reconciliation.tsx   # Tela de conciliação (FLUXO BYPASS — não utilizada no caminho feliz)
    ├── Invoices.tsx         # Lista de faturas importadas + exclusão
    ├── ManualEntry.tsx      # Formulário de lançamento manual
    ├── Reports.tsx          # Analytics: gráficos + tabela analítica com filtros
    ├── Settings.tsx         # Categorias, tags, gestão de usuários (SIMULADA via localStorage)
    └── ui/
        └── Button.tsx       # Componente Button reutilizável
```

---

## 4. Fluxo Principal (Happy Path)

```
[Login] ──► [App.loadData()] ──► [Dashboard]
                │
         [Upload PDF]
                │
         [Gemini extractInvoiceData()]
                │
         [Review: categorizar/editar]
                │
         [handleAutoFinalizeExtraction()]
                │
         [dataService.saveInvoice() + saveTransactions()]
                │
         [Dashboard atualizado]
```

**Fluxo de lançamento manual:**

```
[Manual Entry form] ──► [dataService.saveTransactions()] ──► [Dashboard]
```

---

## 5. Entidades do Domínio

### Transaction (core)
```typescript
{
  id: string
  date: string               // data de referência (geralmente = purchaseDate)
  purchaseDate: string       // data da compra (YYYY-MM-DD)
  description: string
  amount: number
  category: string           // ex: "Alimentação"
  subcategory?: string       // ex: "Restaurante"
  tags?: string[]            // ex: ["Despesas Pessoais"]
  invoiceId: string          // FK para InvoiceFile | 'manual-entry'
  status: MatchStatus        // UNMATCHED | SUGGESTED | MATCHED | IGNORED
  cardIssuer?: CardIssuer    // Inter | Santander | Bradesco | BRB | Porto Bank | Itaú | Outros
  confidence?: number        // (não utilizado ativamente)
  matchedTransactionId?: string // (reservado para reconciliação real)
  notes?: string
}
```

### InvoiceFile
```typescript
{
  id: string
  name: string               // nome do arquivo PDF
  size: number               // bytes
  uploadDate: Date
  status: 'pending' | 'processing' | 'parsed' | 'error'
  transactionCount?: number
  cardIssuer?: CardIssuer
}
```

### Category
```typescript
{ id, name, subcategories: string[], color? }
```

### Tag
```typescript
{ id, name, color }          // color é uma classe Tailwind
```

### AppUser
```typescript
{ id, email, role: 'master' | 'user', createdAt }
```

### SystemTransaction (mock — banco de dados sistema)
```typescript
{ id, date, description, amount, account }
```

### CardIssuer (enum-like)
`'Inter' | 'Santander' | 'Bradesco' | 'BRB' | 'Porto Bank' | 'Itaú' | 'Outros'`

### MatchStatus (enum)
`UNMATCHED | SUGGESTED | MATCHED | IGNORED`

---

## 6. Integração com Banco de Dados (Supabase)

**Tabelas inferidas** (via `dataService.ts`):

| Tabela | Colunas | Operações |
|--------|---------|-----------|
| `transactions` | id, user_id, invoice_id, purchase_date, description, amount, category, subcategory, tags[], status, card_issuer, notes | SELECT, INSERT |
| `invoices` | id, user_id, name, size, upload_date, status, transaction_count, card_issuer | SELECT, INSERT, DELETE |
| `user_settings` | user_id, categories (JSON), tags (JSON), updated_at | SELECT, UPSERT |

**Observações críticas:**
- Não há verificação de RLS no código-fonte
- DELETE de invoice **não** deleta as transactions relacionadas (risco de órfãos no banco)
- `saveTransactions` usa `INSERT` (sem `upsert`) — reimport da mesma fatura cria duplicatas

---

## 7. Integração com AI (Gemini)

**`extractInvoiceData(fileBase64, issuer)`** — REAL
- Envia PDF em base64 + prompt para Gemini
- Usa `responseSchema` estruturado (JSON mode) para extrair: `purchaseDate`, `description`, `amount`
- Modelo: `gemini-3-flash-preview` (verificar se o nome está correto — pode ser `gemini-2.0-flash`)

**`categorizeTransactions(descriptions[])`** — **STUB** (não implementado)
- Retorna `'Outros'` para todos os itens
- Deve ser implementado para categorização automática real

**`generateInsights(transactions[])`** — **STUB**
- Retorna string estática "Insights em breve."

**Configuração de chave:**
- API_KEY exposta em `index.html` no `window.process.env.API_KEY` → **CRÍTICO**

---

## 8. Rotas da Aplicação

| Path | Componente | Descrição |
|------|-----------|-----------|
| `/` | Dashboard | KPIs + gráficos por ciclo |
| `/upload` | Upload | Upload de PDF + seleção de emissor |
| `/review` | Review | Revisão/edição das transações extraídas |
| `/reconcile` | Reconciliation | Conciliação manual (BYPASS no fluxo atual) |
| `/invoices` | Invoices | Lista de faturas importadas |
| `/manual` | ManualEntry | Lançamento manual |
| `/reports` | Reports | Analytics com filtros |
| `/settings` | Settings | Categorias, tags, usuários |

---

## 9. Dívida Técnica — Mapeamento Prioritário

### CRÍTICO (bloqueante para produção segura)

| ID | Problema | Localização | Impacto |
|----|---------|------------|---------|
| TD-01 | API_KEY Gemini hardcoded no HTML | `index.html:19` | Exposição da chave para qualquer visitante |
| TD-02 | Supabase anon key hardcoded no TS | `lib/supabase.ts:9` | Exposto no bundle JS |
| TD-03 | `._*` files rastreados pelo git | root (staged) | Ruído no repo, possível corrupção |

### ALTO (impacta funcionalidade core)

| ID | Problema | Localização | Impacto |
|----|---------|------------|---------|
| TD-04 | `categorizeTransactions` é stub | `services/geminiService.ts:73` | Todas as transações ficam como "Outros" |
| TD-05 | `systemTransactions` são mock hardcoded | `App.tsx:74-77` | Conciliação real impossível |
| TD-06 | DELETE de invoice não remove transactions | `dataService.ts:103` | Dados órfãos acumulam no banco |
| TD-07 | Reimport gera duplicatas (INSERT sem upsert) | `dataService.ts:57` | Dados duplicados |
| TD-08 | Sem error boundaries | App.tsx global | Crash silencioso |
| TD-09 | `gemini-3-flash-preview` pode ser modelo inválido | `geminiService.ts:34` | Falha na extração |

### MÉDIO (qualidade e UX)

| ID | Problema | Localização | Impacto |
|----|---------|------------|---------|
| TD-10 | Conflito de versão Vite 7.3 vs 6.2 | `package.json` | Build instável |
| TD-11 | Tailwind via CDN (não npm) | `index.html:10` | Bundle grande, sem purging |
| TD-12 | `window.prompt()` / `window.confirm()` | Review.tsx, App.tsx | UX ruim, não customizável |
| TD-13 | Gestão de usuários via localStorage | Settings.tsx | Não persiste entre dispositivos |
| TD-14 | Tabela limitada a 100 linhas | Reports.tsx:340 | Dados truncados sem aviso claro |
| TD-15 | `getCycleInfo` duplicado | Dashboard.tsx + Reports.tsx | Violação DRY |
| TD-16 | Uso extensivo de `any` | AuthContext.tsx, App.tsx | Sem segurança de tipos |

### BAIXO (melhorias)

| ID | Problema | Notas |
|----|---------|-------|
| TD-17 | Sem TypeScript strict mode | `tsconfig.json` |
| TD-18 | `._*` no `.gitignore` ausente | `.gitignore` |
| TD-19 | Export PDF usa `window.print()` | Reports.tsx |
| TD-20 | Sem skeleton loading / placeholders | App-wide |
| TD-21 | Sem testes unitários | — |
| TD-22 | Sem paginação nas transações | Reports.tsx |

---

## 10. Diagrama de Dependências

```
index.html (shell, API_KEY)
    └── index.tsx
            └── App.tsx
                    ├── context/AuthContext.tsx ──► lib/supabase.ts
                    ├── services/dataService.ts ──► lib/supabase.ts
                    ├── services/geminiService.ts ──► @google/genai
                    ├── types.ts
                    └── components/
                            ├── Auth.tsx
                            ├── Dashboard.tsx ──► recharts, types
                            ├── Upload.tsx ──── types
                            ├── Review.tsx ───── types
                            ├── Reconciliation.tsx
                            ├── Invoices.tsx
                            ├── ManualEntry.tsx
                            ├── Reports.tsx ──── recharts, types
                            ├── Settings.tsx
                            └── ui/Button.tsx
```

---

## 11. Premissas de Implantação (cPanel)

- `vite.config.ts`: `base: './'` para paths relativos
- `index.html`: importmap ESM aponta para `esm.sh` (sem bundle local em dev)
- `.htaccess`: rewrite all → `index.html` para SPA routing
- Não há server-side code — puramente client-side SPA
- Supabase funciona como BaaS completo (auth + DB)

---

*Documento gerado automaticamente via Brownfield Discovery — não editar manualmente a seção de Dívida Técnica sem atualizar a tabela.*
