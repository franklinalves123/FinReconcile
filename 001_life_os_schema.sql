-- ============================================================
-- 001_life_os_schema.sql
-- Life OS — Marco 1: Expansão do Banco de Dados
-- Compatível com PostgreSQL / Supabase
--
-- INSTRUÇÕES:
--   1. Acesse o Supabase Dashboard → SQL Editor
--   2. Cole este arquivo integralmente e clique em "Run"
--   3. Todas as operações são idempotentes (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
--      sendo seguro re-executar sem risco de erro.
-- ============================================================

-- ============================================================
-- PARTE 1: NOVAS TABELAS
-- (criadas antes das alterações em 'transactions' para
--  permitir a referência de FK account_id)
-- ============================================================

-- ----------------------------------------------------------
-- accounts: contas bancárias e carteiras do usuário
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  name         text        NOT NULL,
  type         text        NOT NULL DEFAULT 'checking',
  -- Valores aceitos: checking | savings | investment | wallet
  balance      numeric(14,2) NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------
-- credit_cards: cartões de crédito do usuário
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_cards (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  name           text        NOT NULL,
  limit_amount   numeric(14,2) NOT NULL DEFAULT 0,
  closing_day    smallint    NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day        smallint    NOT NULL CHECK (due_day BETWEEN 1 AND 31)
);

-- ----------------------------------------------------------
-- projects: projetos pessoais e profissionais
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  name         text        NOT NULL,
  status       text        NOT NULL DEFAULT 'active',
  -- Valores aceitos: active | paused | completed | archived
  progress     smallint    NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100)
);

-- ----------------------------------------------------------
-- tasks: tarefas vinculadas (ou não) a um projeto
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  title        text        NOT NULL,
  description  text,
  status       text        NOT NULL DEFAULT 'todo',
  -- Valores aceitos: todo | in_progress | done | cancelled
  priority     text        NOT NULL DEFAULT 'medium',
  -- Valores aceitos: low | medium | high | urgent
  due_date     date,
  project_id   uuid        REFERENCES projects(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------
-- habits: hábitos a serem rastreados
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS habits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  name         text        NOT NULL,
  frequency    text        NOT NULL DEFAULT 'daily'
  -- Valores aceitos: daily | weekly | monthly
);

-- ----------------------------------------------------------
-- habit_logs: registro diário de cada hábito
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS habit_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  habit_id     uuid        NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date         date        NOT NULL,
  completed    boolean     NOT NULL DEFAULT false,
  UNIQUE (habit_id, date)   -- evita duplicatas por dia
);

-- ----------------------------------------------------------
-- notes: diário, brain dump e caderno de notas
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  title        text,
  content      text,
  type_note    text        NOT NULL DEFAULT 'notebook'
  -- Valores aceitos: diary | brain_dump | notebook
);

-- ============================================================
-- PARTE 2: ALTERAÇÕES NA TABELA EXISTENTE 'transactions'
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS type           text DEFAULT 'expense',
  ADD COLUMN IF NOT EXISTS account_id     uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installment_id uuid;
  -- installment_id: UUID livre para agrupar parcelas entre si (sem FK)

-- ============================================================
-- PARTE 3: ROW LEVEL SECURITY (RLS)
-- Garante que cada usuário acesse apenas seus próprios dados.
-- ============================================================

-- accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "accounts: acesso exclusivo do dono"
  ON accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- credit_cards
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "credit_cards: acesso exclusivo do dono"
  ON credit_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "projects: acesso exclusivo do dono"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tasks: acesso exclusivo do dono"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- habits
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "habits: acesso exclusivo do dono"
  ON habits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- habit_logs
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "habit_logs: acesso exclusivo do dono"
  ON habit_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "notes: acesso exclusivo do dono"
  ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PARTE 4: ÍNDICES DE PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_accounts_user_id      ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id  ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id      ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id         ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id      ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date        ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_habits_user_id        ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id   ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date       ON habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_notes_user_id         ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_type_note       ON notes(type_note);
CREATE INDEX IF NOT EXISTS idx_transactions_account  ON transactions(account_id);

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
