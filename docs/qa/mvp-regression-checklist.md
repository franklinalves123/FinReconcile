# FinReconcile — Checklist de Regressão MVP

> **Agente:** @qa (QA Gate)
> **Data:** 2026-02-21
> **Versão do app:** commit `3ff6be4` (branch `main`)
> **Modo:** Manual (sem framework de testes automatizados no MVP)
> **Critério de aprovação:** Todos os itens CRÍTICOS passando. Itens MÉDIO documentados como débito.

---

## Pré-condições

- [ ] `.env.local` configurado com chaves válidas (ver `.env.local.example`)
- [ ] `npm run dev` inicia sem erros de compilação
- [ ] Supabase acessível (testar com `curl $VITE_SUPABASE_URL/rest/v1/`)
- [ ] Conta de teste criada (ex: `qa+test@finreconcile.dev`)

---

## 1. Autenticação

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 1.1 | Login com e-mail e senha corretos redireciona para Dashboard | CRÍTICO | ☐ PASS ☐ FAIL |
| 1.2 | Login com senha incorreta exibe mensagem de erro (não trava UI) | CRÍTICO | ☐ PASS ☐ FAIL |
| 1.3 | Logout encerra sessão e redireciona para tela de Auth | CRÍTICO | ☐ PASS ☐ FAIL |
| 1.4 | Usuário não autenticado não acessa rotas protegidas | CRÍTICO | ☐ PASS ☐ FAIL |
| 1.5 | Session persiste ao recarregar a página (F5) | MÉDIO | ☐ PASS ☐ FAIL |

---

## 2. Upload e Extração de Fatura (Gemini)

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 2.1 | Upload de PDF válido (< 15 MB) inicia extração sem erro | CRÍTICO | ☐ PASS ☐ FAIL |
| 2.2 | Extração Gemini retorna ao menos 1 transação (PDF real de fatura) | CRÍTICO | ☐ PASS ☐ FAIL |
| 2.3 | Upload de PDF > 15 MB exibe mensagem de erro claro (não trava) | MÉDIO | ☐ PASS ☐ FAIL |
| 2.4 | Upload de arquivo não-PDF exibe erro de validação | MÉDIO | ☐ PASS ☐ FAIL |
| 2.5 | Seletor de emissor (`CardIssuer`) pré-preenche prompt do Gemini | BAIXO | ☐ PASS ☐ FAIL |
| 2.6 | Falha de rede na chamada Gemini exibe mensagem e não trava UI | MÉDIO | ☐ PASS ☐ FAIL |

**Nota:** Com `VITE_USE_EDGE_FUNCTION=false` (padrão MVP), a chave Gemini está no bundle — aceitável apenas em ambiente local/dev.

---

## 3. Revisão e Edição de Transações

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 3.1 | Transações extraídas aparecem na tela de Revisão | CRÍTICO | ☐ PASS ☐ FAIL |
| 3.2 | Editar descrição de uma transação salva o novo valor | CRÍTICO | ☐ PASS ☐ FAIL |
| 3.3 | Editar valor numérico salva corretamente (separador decimal) | CRÍTICO | ☐ PASS ☐ FAIL |
| 3.4 | Editar data salva no formato YYYY-MM-DD | MÉDIO | ☐ PASS ☐ FAIL |
| 3.5 | Excluir uma transação remove do estado local | MÉDIO | ☐ PASS ☐ FAIL |
| 3.6 | Confirmar/finalizar revisão persiste transações no Supabase | CRÍTICO | ☐ PASS ☐ FAIL |

---

## 4. Persistência no Supabase

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 4.1 | Transações salvas aparecem na lista após recarregar a página | CRÍTICO | ☐ PASS ☐ FAIL |
| 4.2 | Usuário A não visualiza transações do usuário B (RLS) | CRÍTICO | ☐ PASS ☐ FAIL |
| 4.3 | Fatura salva aparece na tela de Invoices | CRÍTICO | ☐ PASS ☐ FAIL |
| 4.4 | Falha de conexão com Supabase exibe erro — não exibe tela em branco | MÉDIO | ☐ PASS ☐ FAIL |

**Nota P-08:** RLS não auditado formalmente. Teste 4.2 é cobertura mínima manual.

---

## 5. Dashboard

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 5.1 | Dashboard carrega sem erro de runtime no console | CRÍTICO | ☐ PASS ☐ FAIL |
| 5.2 | Totais (receita/despesa) refletem transações salvas no Supabase | CRÍTICO | ☐ PASS ☐ FAIL |
| 5.3 | Gráficos (Recharts) renderizam sem overflow ou sobreposição | MÉDIO | ☐ PASS ☐ FAIL |
| 5.4 | Sem transações: estado vazio exibido (sem crash) | MÉDIO | ☐ PASS ☐ FAIL |

---

## 6. Relatórios

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 6.1 | Tela de Relatórios carrega sem erro | CRÍTICO | ☐ PASS ☐ FAIL |
| 6.2 | Filtro por período retorna transações corretas | MÉDIO | ☐ PASS ☐ FAIL |
| 6.3 | Agrupamento por ciclo (data upload) consistente com Dashboard | MÉDIO | ☐ PASS ☐ FAIL |

---

## 7. Entrada Manual

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 7.1 | Formulário de entrada manual salva transação no Supabase | CRÍTICO | ☐ PASS ☐ FAIL |
| 7.2 | Campos obrigatórios vazios impedem submit (validação client-side) | MÉDIO | ☐ PASS ☐ FAIL |
| 7.3 | Transação salva aparece no Dashboard e Relatórios | MÉDIO | ☐ PASS ☐ FAIL |

---

## 8. Configurações

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 8.1 | Tela de Configurações carrega sem erro | MÉDIO | ☐ PASS ☐ FAIL |
| 8.2 | Preferências salvas persistem após recarregar (Supabase `user_settings`) | MÉDIO | ☐ PASS ☐ FAIL |

---

## 9. Navegação e Acessibilidade Básica

| # | Cenário | Severidade | Resultado |
|---|---------|-----------|-----------|
| 9.1 | Todas as rotas do menu lateral carregam sem erro 404/500 | CRÍTICO | ☐ PASS ☐ FAIL |
| 9.2 | Nenhum erro não tratado no console do browser (Error boundary) | MÉDIO | ☐ PASS ☐ FAIL |
| 9.3 | Layout funcional em viewport 1280×800 (desktop mínimo) | BAIXO | ☐ PASS ☐ FAIL |

---

## Itens Fora de Escopo (Aceitos como Débito Técnico)

| Item | Story que resolve |
|------|------------------|
| `categorizeTransactions` retorna 'Outros' (stub) | Story 1.3 |
| `window.prompt/alert/confirm` em uso (bloqueia UI mobile) | Story 1.5 |
| Sem `Error Boundary` React para erros inesperados | Story 1.5 |
| Sem prevenção de fatura duplicada | Story 1.4 |
| `deleteInvoice` sem cascade delete de transações | Story 1.4 |
| Gemini key visível no bundle compilado (Layer 1) | Resolvido em prod com Story 1.2 Layer 2 |
| RLS não auditado formalmente | P-08 (pendente @dev + @qa) |

---

## Resultado Final

| Métrica | Valor |
|---------|-------|
| Total de testes CRÍTICOS | 22 |
| PASS | — |
| FAIL | — |
| **Veredito** | ☐ PASS ☐ CONCERNS ☐ FAIL |

**Executado por:** _______________
**Data de execução:** _______________
**Observações:** _______________
