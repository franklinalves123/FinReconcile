# FinReconcile — Decision Log

> Formato: cada entrada registra uma decisão arquitetural ou de processo tomada pelo squad AIOS.
> Append-only. Nunca remover entradas existentes.

---

## 2026-02-21 — AIOS-ONLY Rule

**Contexto:** Durante a sessão de hardenização (Story 1.2 + Edge Function), foram feitas
modificações de código e infra diretamente por Claude sem passar pelos squads AIOS formais.
Isso violou o princípio de governança do framework.

**Decisão:** A partir desta sessão, todas as implementações DEVEM seguir o fluxo de squads:
`@sm *draft → @po *validate → @dev *develop → @qa *qa-gate → @devops *push`

**Impacto:** Qualquer modificação de código ou infra fora desse fluxo é bloqueada.
Documentação e leitura continuam permitidas sem squad formal.

**Aprovado por:** Usuário (instrução explícita na sessão de 2026-02-21)

---

## 2026-02-21 — Decisão de Segurança: Two-Layer Gemini Key

**Contexto:** A `GEMINI_API_KEY` estava hardcoded em `index.html` (Story 1.2).

**Opções avaliadas:**
1. Mover para `VITE_GEMINI_API_KEY` em `.env.local` (key ainda no bundle compilado)
2. Supabase Edge Function proxy (key nunca chega ao browser)
3. Manter no HTML (inaceitável)

**Decisão:** Implementar ambas as camadas simultaneamente:
- **Camada 1** (default/MVP): `VITE_GEMINI_API_KEY` — key fora do source code, no bundle
- **Camada 2** (produção segura): `VITE_USE_EDGE_FUNCTION=true` + Edge Function deploy

**Motivação:** Camada 1 resolve o risco imediato (key no git/source). Camada 2 é o path
para risco zero quando a URL for compartilhada publicamente. O toggle `VITE_USE_EDGE_FUNCTION`
permite migração gradual sem breaking changes.

**Arquivos afetados:**
- `services/geminiService.ts` — lógica de roteamento dual
- `supabase/functions/gemini-proxy/index.ts` — scaffold da Edge Function
- `.env.local.example` — documentação do toggle

**Status:** Camada 1 implementada e em produção (commit `3ff6be4`).
Camada 2 scaffold pronto, pendente de deploy autorizado pelo @devops.

---

## 2026-02-21 — Edge Function: Reescrita para Deno.serve()

**Contexto:** O scaffold original usava `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`,
API legada incompatível com Supabase Edge Functions v2.

**Decisão:** Reescrever para `Deno.serve()` (API nativa do Deno 1.35+, requerida pelo Supabase).

**Status:** Modificação local em `supabase/functions/gemini-proxy/index.ts`.
**NÃO commitada** — aguarda autorização de commit via fluxo AIOS (@dev → @devops).

---

## 2026-02-21 — Replanejamento MVP: Top 5 Prioridades (@sm)

**Contexto:** 12 stories planejadas. Story 1.1 parcialmente feita. Story 1.2 entregue.
Story 1.1 não removeu o conflito de versão do Vite no `package.json`.

**Decisão de reordenação** (detalhamento na seção @sm abaixo):

| Posição | Story | Razão da Prioridade |
|---------|-------|---------------------|
| 1 | 1.1 (completar) | Vite conflict bloqueia build confiável; 30 min, zero risco |
| 2 | 1.4 (cascade delete + duplicatas) | Integridade de dados crítica — dados órfãos acumulam |
| 3 | 1.5 (error handling + UX) | `window.prompt/alert` bloqueiam UI; crashes sem boundary |
| 4 | 1.3 (AI categorization real) | Proposta de valor core está quebrada (stub retorna "Outros") |
| 5 | 1.11 (Tailwind CDN → npm) | Importmap + Tailwind CDN criam ambiguidade no build; resolver antes de 1.3 para ter build limpo |

**Stories rebaixadas temporariamente:**
- 1.7 (parcelamentos): V1 — não bloqueia MVP funcional
- 1.9 (user management real): V1 — localStorage aceitável para MVP pessoal
- 1.10 (AI insights): V1 — nice-to-have, não crítico

---

## 2026-02-21 — Itens Pendentes Detectados na Auditoria

| ID | Item | Responsável | Urgência |
|----|------|-------------|---------|
| P-01 | `supabase/functions/gemini-proxy/index.ts` não commitado | @dev | Alta |
| P-02 | `._*` files em `supabase/` (filesystem, não git) | @dev (junto com P-01) | Baixa |
| P-03 | `package.json` Vite conflict (^7.3 deps / ^6.2 devDeps) | @dev (Story 1.1) | Alta |
| P-04 | Script `typecheck` ausente no `package.json` | @dev | Média |
| P-05 | `supabase/config.toml` ausente | @devops | Alta (pré-deploy) |
| P-06 | Supabase CLI não instalado localmente | @devops | Alta (pré-deploy) |
| P-07 | Chaves Gemini + Supabase não rotacionadas | Usuário | Crítica |
| P-08 | RLS do Supabase não auditado | @dev + @qa | Crítica |

---
