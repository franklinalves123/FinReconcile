# FinReconcile — Product Requirements Document (MVP)

> Responsável: @pm (Morgan)
> Data: 2026-02-20
> Status: Draft
> Versão: 1.0

---

## 1. Contexto e Problema

### Problema
Profissionais e famílias brasileiras possuem múltiplos cartões de crédito em bancos diferentes (Inter, Bradesco, Santander, Itaú, BRB, Porto Bank). Conciliar e categorizar manualmente as despesas mensais é:

- **Demorado** — cópia manual de cada lançamento das faturas em PDF
- **Propenso a erros** — valores e datas transcritos incorretamente
- **Sem visibilidade** — difícil enxergar padrões de gasto entre múltiplos cartões
- **Sem classificação inteligente** — planilhas genéricas não entendem "Uber", "iFood", "Decolar"

### Solução
FinReconcile usa IA (Google Gemini) para **extrair automaticamente** as transações de faturas PDF, **categorizar inteligentemente** os lançamentos, e fornecer **visibilidade consolidada** dos gastos por ciclo de pagamento.

### Público-alvo (MVP)
- Usuário primário: pessoa física, classe média/alta, múltiplos cartões brasileiros
- Perfil técnico: não-técnico, usa smartphone e computador
- Frequência de uso: 1-2x por mês (ao receber faturas)

---

## 2. Visão e Roadmap

### Visão de Longo Prazo
Ser o **assistente financeiro pessoal mais inteligente do Brasil**, capaz de reconciliar automaticamente qualquer fatura de qualquer banco, detectar gastos anômalos, e sugerir economias com base em padrões reais de consumo.

### Roadmap de Fases

#### MVP (Fase 1) — Extração + Categorização Confiável
**Meta:** Usuário consegue importar uma fatura, ter os lançamentos corretamente extraídos e categorizados, e salvar no histórico em menos de 2 minutos.

Inclui:
- Upload PDF por banco
- Extração via Gemini (confiável, com tratamento de erro)
- Categorização automática via AI
- Revisão e edição manual
- Lançamento manual
- Dashboard básico (ciclos)
- Relatórios com filtros
- Auth segura

**NÃO inclui no MVP:**
- Reconciliação com extrato bancário (OFX/CSV)
- Importação automática (Open Finance)
- Mobile app nativo
- Múltiplos usuários por conta (family sharing)
- Orçamento/metas por categoria
- Notificações/alertas
- Parcelamentos automáticos detectados
- Integração com contabilidade

#### V1 (Fase 2) — Conciliação Real + Parcelamentos
- Reconciliação com extrato bancário (upload OFX/CSV)
- Detecção e tracking de parcelamentos
- Export CSV/Excel real
- Orçamento mensal por categoria com alertas
- Insights automáticos via AI

#### V2 (Fase 3) — Inteligência + Colaboração
- Open Finance (conexão direta com bancos)
- Family sharing (conta master + sub-usuários reais)
- AI insights avançados: anomalias, benchmarks, sugestões
- App mobile PWA
- Integração contábil (DRE simplificado pessoa jurídica)

---

## 3. Escopo do MVP

### IN SCOPE (MVP)

| ID | Funcionalidade |
|----|---------------|
| RF-01 | Autenticação segura via Supabase (email/senha) |
| RF-02 | Upload de fatura PDF + seleção de banco emissor |
| RF-03 | Extração de transações via Gemini AI com tratamento de erros |
| RF-04 | Categorização automática via AI (implementar stub atual) |
| RF-05 | Revisão de transações: editar categoria, subcategoria, tag, valor, data |
| RF-06 | Criar/gerenciar categorias e subcategorias pelo usuário |
| RF-07 | Criar/gerenciar tags pelo usuário |
| RF-08 | Finalizar importação e salvar no Supabase |
| RF-09 | Lançamento manual de transação |
| RF-10 | Dashboard: gastos por ciclo de importação (últimos 6 ciclos) |
| RF-11 | Dashboard: breakdown por categoria do ciclo atual |
| RF-12 | Relatórios: filtros por ciclo, tag, busca por descrição |
| RF-13 | Relatórios: visualização gráfica + tabela analítica |
| RF-14 | Gestão de faturas: listar e excluir (com cascade delete das transactions) |
| RF-15 | Configurações: gerenciar categorias, subcategorias, tags |
| RF-16 | Credenciais externalizadas (sem keys hardcoded no código) |
| RF-17 | Prevenção de duplicatas na importação de faturas |

### OUT OF SCOPE (MVP)

- Reconciliação com extrato bancário (OFX/CSV)
- Detecção automática de parcelamentos
- Export CSV/Excel (apenas window.print para PDF)
- Gestão multi-usuário real (Supabase invite system)
- Notificações por email ou push
- Open Finance / conexão direta com bancos
- Mobile app
- Orçamento/metas

---

## 4. Requisitos Funcionais Detalhados

### RF-01: Autenticação
- **Dado** que o usuário acessa o app sem sessão ativa
- **Quando** ele inserir email e senha válidos
- **Então** ele deve ser autenticado via Supabase Auth e redirecionado ao Dashboard
- Login, cadastro, logout
- Sessão persistida (sem logout ao fechar aba)

### RF-02: Upload de Fatura
- Suporte a drag-and-drop e seleção via diálogo
- Filtro: apenas arquivos `.pdf`
- Tamanho máximo: 15MB por arquivo
- Seleção obrigatória do banco emissor antes do upload
- Feedback visual de progresso durante processamento

### RF-03: Extração via Gemini
- Enviar PDF em base64 para Gemini com prompt estruturado por emissor
- Retornar lista de: `purchaseDate`, `description`, `amount`
- Timeout máximo de 60s com mensagem de erro clara ao usuário
- Se Gemini falhar: mostrar tela de erro com opção de tentar novamente ou lançar manualmente
- Validar que o modelo correto está sendo usado (`gemini-2.0-flash` ou equivalente atual)

### RF-04: Categorização Automática
- Após extração, chamar Gemini para categorizar cada descrição
- Usar lista de categorias do usuário como contexto no prompt
- Exibir badge de confiança (alta/média/baixa) na tela de revisão
- Manter `'Outros'` como fallback se Gemini não souber categorizar

### RF-05: Revisão de Transações
- Tabela ordenável (data, valor)
- Edição inline de categoria e subcategoria via dropdown
- Modal de edição completa: data, valor, descrição, banco, categoria, subcategoria, tags
- Excluir transação individualmente antes de confirmar
- Contador de transações: total, total em R$

### RF-08: Salvar Importação
- Verificar se fatura com mesmo nome+banco+data já foi importada (prevenção de duplicatas)
- Salvar fatura + transactions atomicamente
- Se falhar: rollback e exibir mensagem de erro específica
- Após salvar: redirecionar para Dashboard com atualização automática

### RF-14: Exclusão de Fatura
- Confirmar via modal (não `window.confirm()`)
- Excluir fatura E todas as transactions vinculadas (cascade)
- Exibir feedback de sucesso/erro

### RF-16: Segurança de Credenciais
- `GEMINI_API_KEY`: injetar via variável de ambiente no build (`import.meta.env.VITE_GEMINI_API_KEY`)
- `SUPABASE_URL` e `SUPABASE_ANON_KEY`: idem (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Arquivo `.env.local` com instruções claras no README
- `.env.local` adicionado ao `.gitignore`

---

## 5. Requisitos Não-Funcionais

| ID | Requisito | Critério de Aceite |
|----|----------|-------------------|
| RNF-01 | Performance de extração | Extração + categorização em < 30s para faturas de até 100 itens |
| RNF-02 | Disponibilidade | App funciona offline para leitura de dados já carregados |
| RNF-03 | Segurança | Nenhuma chave de API exposta no bundle/HTML em produção |
| RNF-04 | Segurança | RLS do Supabase garante isolamento de dados por usuário |
| RNF-05 | Usabilidade | Fluxo de importação completo em < 5 cliques após upload |
| RNF-06 | Compatibilidade | Funciona em Chrome/Safari/Firefox (últimas 2 versões) |
| RNF-07 | Build | `npm run build` sem erros ou warnings críticos |
| RNF-08 | Manutenibilidade | Sem TypeScript errors (`npm run typecheck` clean) |

---

## 6. Métricas de Sucesso do MVP

| Métrica | Meta | Período |
|---------|------|---------|
| Tempo médio de importação completa | < 2 minutos | Por sessão |
| Taxa de sucesso da extração Gemini | > 85% das faturas | Mensal |
| Precisão da categorização AI | > 70% corretas sem edição | Por importação |
| Transações duplicadas salvas | 0 | Por importação |
| Crashes reportados pelo usuário | 0 críticos | Semanal |

---

## 7. Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|----------|
| Gemini falha em interpretar PDF de banco X | Média | Alto | Prompt customizado por emissor; fallback manual |
| PDF criptografado/protegido | Baixa | Médio | Validar antes do envio; mensagem clara |
| Custo API Gemini escala com volume | Média | Médio | Cache de resultados; batch requests |
| Supabase RLS mal configurado | Baixa | Crítico | Auditoria de policies antes do lançamento |
| Modelo Gemini descontinuado | Baixa | Alto | Parametrizar modelo; atualização rápida |
| Dados duplicados por reimport | Alta (atual) | Médio | Hash de fatura + check antes de inserir |

---

## 8. Plano de Fases (MVP)

As stories estão ordenadas por **menor risco + maior impacto**:

### Fase 0 — Fundação (Bloqueantes de Segurança)
- Story 1.1: Sanidade do repo (._* files, .gitignore, vite version)
- Story 1.2: Externalizar credenciais (env vars, sem hardcode)

### Fase 1 — Core Funcional Completo
- Story 1.3: Categorização AI real (implementar stub)
- Story 1.4: Prevenção de duplicatas + cascade delete
- Story 1.5: Error handling e UX (boundaries, modais, sem window.prompt)

### Fase 2 — Qualidade e Dados
- Story 1.6: Paginação e performance de listagens
- Story 1.7: Parcelamentos básicos na extração
- Story 1.8: Export real (CSV)

### Fase 3 — Gestão e Administração
- Story 1.9: Gestão de usuários real (Supabase)
- Story 1.10: Insights AI (implementar generateInsights)

### Fase 4 — Qualidade de Código
- Story 1.11: Migrar Tailwind de CDN para npm
- Story 1.12: Testes unitários (Vitest)

---

## 9. Definição de Pronto (DoD) — MVP

Uma story está PRONTA quando:

- [ ] Todos os critérios de aceite verificados manualmente
- [ ] `npm run build` sem erros
- [ ] TypeScript sem erros (`tsc --noEmit`)
- [ ] Sem `console.error` não tratados no fluxo feliz
- [ ] Código revisado (sem secrets hardcoded)
- [ ] Story file atualizado (checkboxes marcados, File List atualizado)
- [ ] Testado em Chrome e Safari

---

*FinReconcile MVP PRD v1.0 — gerado por Brownfield Discovery*
