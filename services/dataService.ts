
import { supabase } from '../lib/supabase.ts';
import { Transaction, Category, Tag, InvoiceFile, Account, CreditCard, Project, Task, Habit, HabitLog, Note } from '../types.ts';

/**
 * Converte valor monetário em formato BR para number.
 * Exemplos:
 *   'R$ 1.500,00' → 1500.00
 *   '1.500,50'    → 1500.50
 *   1500          → 1500
 *   '1500.00'     → 1500.00  (formato EN também funciona)
 */
export function parseBRLAmount(value: unknown): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value !== 'string') return 0;
  const cleaned = value
    .replace(/R\$\s*/g, '')   // remove prefixo "R$ "
    .replace(/\s/g, '')        // remove espaços restantes
    .replace(/\./g, '')        // remove separador de milhar BR
    .replace(',', '.');        // converte decimal BR → decimal EN
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * SERVIÇO DE DADOS RESILIENTE
 * Usamos mapeamento explícito para evitar erros de 'schema cache' do Supabase
 */

export const dataService = {
  async getTransactions(userId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, invoice_id, purchase_date, description, amount, category, subcategory, tags, status, card_issuer, notes, type, account_id, installment_id')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false });
    
    if (error) {
      console.error("Erro ao buscar transações:", error);
      throw error;
    }
    
    return data?.map(t => ({
      id: t.id,
      date: t.purchase_date, 
      purchaseDate: t.purchase_date,
      description: t.description || '',
      amount: Number(t.amount || 0),
      category: t.category || 'Outros',
      subcategory: t.subcategory || '',
      tags: Array.isArray(t.tags) ? t.tags.map((tag: string) => tag === 'Pessoal' ? 'Pessoais' : tag) : [],
      invoiceId: t.invoice_id || 'manual-entry',
      status: t.status,
      cardIssuer: t.card_issuer || 'Outros',
      notes: t.notes || '',
      type: (t.type as 'expense' | 'income') || 'expense',
      accountId: t.account_id || undefined,
      installmentId: t.installment_id || undefined,
    })) || [];
  },

  async saveTransactions(transactions: Transaction[], userId: string) {
    if (!transactions || transactions.length === 0) return;

    const txsToSave = transactions.map(t => ({
      user_id: userId,
      // Se for manual ou não tiver ID de fatura, salvamos como nulo no banco
      invoice_id: (t.invoiceId === 'manual-entry' || !t.invoiceId) ? null : t.invoiceId,
      purchase_date: t.purchaseDate,
      description: t.description,
      // parseBRLAmount garante número limpo independente do formato da IA
      amount: parseBRLAmount(t.amount),
      category: t.category,
      subcategory: t.subcategory,
      tags: t.tags || [],
      status: t.status,
      card_issuer: t.cardIssuer,
      notes: t.notes,
      type: t.type || 'expense',
      account_id: t.accountId || null,
      installment_id: t.installmentId || null,
    }));

    const { error } = await supabase
      .from('transactions')
      .upsert(txsToSave, {
        onConflict: 'user_id,purchase_date,description,amount',
        ignoreDuplicates: true
      });
    if (error) {
      console.error("Erro Supabase ao inserir transações:", error.message);
      throw error;
    }
  },

  async getInvoices(userId: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('upload_date', { ascending: false });
    
    if (error) throw error;
    
    return data?.map(inv => ({
      id: inv.id,
      name: inv.name,
      size: inv.size,
      uploadDate: new Date(inv.upload_date),
      status: inv.status,
      transactionCount: inv.transaction_count,
      cardIssuer: inv.card_issuer
    })) || [];
  },

  async saveInvoice(invoice: InvoiceFile, userId: string) {
    const { error } = await supabase.from('invoices').insert({
      id: invoice.id,
      user_id: userId,
      name: invoice.name,
      size: invoice.size,
      upload_date: invoice.uploadDate.toISOString(),
      status: invoice.status,
      transaction_count: invoice.transactionCount,
      card_issuer: invoice.cardIssuer
    });
    
    if (error) {
      console.error("Erro Supabase ao salvar fatura:", error.message);
      throw error;
    }
  },

  async updateTransaction(transaction: Transaction, userId: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .update({
        purchase_date:  transaction.purchaseDate,
        description:    transaction.description,
        amount:         parseBRLAmount(transaction.amount),
        category:       transaction.category,
        subcategory:    transaction.subcategory,
        tags:           transaction.tags || [],
        status:         transaction.status,
        card_issuer:    transaction.cardIssuer,
        notes:          transaction.notes,
        type:           transaction.type || 'expense',
        account_id:     transaction.accountId  || null,
        installment_id: transaction.installmentId || null,
      })
      .eq('id', transaction.id)
      .eq('user_id', userId);
    if (error) {
      console.error('Erro ao atualizar transação:', error.message);
      throw error;
    }
  },

  async deleteTransaction(transactionId: string, userId: string) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', userId);

    if (error) {
      console.error("Erro Supabase ao excluir transação:", error.message);
      throw error;
    }
  },

  async deleteInvoice(invoiceId: string, userId: string) {
    // Apaga transações associadas antes da fatura (guard para ambientes sem ON DELETE CASCADE)
    await supabase
      .from('transactions')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('user_id', userId);

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async getUserSettings(userId: string) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('categories, tags')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) return null;
    return data;
  },

  async updateUserSettings(userId: string, settings: { categories?: Category[], tags?: Tag[] }) {
    const payload: any = {
      user_id: userId,
      updated_at: new Date().toISOString()
    };

    if (settings.categories) payload.categories = settings.categories;
    if (settings.tags) payload.tags = settings.tags;

    const { error } = await supabase.from('user_settings').upsert(
      payload,
      { onConflict: 'user_id' }
    );

    if (error) throw error;
  },

  // ============================================================
  // ACCOUNTS
  // ============================================================

  async getAccounts(userId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, user_id, created_at, name, type, balance')
      .eq('user_id', userId)
      .order('name');
    if (error) { console.error('Erro ao buscar contas:', error); throw error; }
    return (data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      name: r.name,
      type: r.type,
      balance: Number(r.balance ?? 0),
    }));
  },

  async saveAccount(account: Account, userId: string): Promise<void> {
    const { error } = await supabase.from('accounts').upsert(
      { id: account.id, user_id: userId, name: account.name, type: account.type, balance: account.balance },
      { onConflict: 'id' }
    );
    if (error) { console.error('Erro ao salvar conta:', error); throw error; }
  },

  async deleteAccount(accountId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('accounts').delete()
      .eq('id', accountId).eq('user_id', userId);
    if (error) { console.error('Erro ao excluir conta:', error); throw error; }
  },

  // ============================================================
  // CREDIT CARDS
  // ============================================================

  async getCreditCards(userId: string): Promise<CreditCard[]> {
    const { data, error } = await supabase
      .from('credit_cards')
      .select('id, user_id, created_at, name, limit_amount, closing_day, due_day')
      .eq('user_id', userId)
      .order('name');
    if (error) { console.error('Erro ao buscar cartões:', error); throw error; }
    return (data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      name: r.name,
      limitAmount: Number(r.limit_amount ?? 0),
      closingDay: r.closing_day,
      dueDay: r.due_day,
    }));
  },

  async saveCreditCard(card: CreditCard, userId: string): Promise<void> {
    const { error } = await supabase.from('credit_cards').upsert(
      { id: card.id, user_id: userId, name: card.name, limit_amount: card.limitAmount, closing_day: card.closingDay, due_day: card.dueDay },
      { onConflict: 'id' }
    );
    if (error) { console.error('Erro ao salvar cartão:', error); throw error; }
  },

  async deleteCreditCard(cardId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('credit_cards').delete()
      .eq('id', cardId).eq('user_id', userId);
    if (error) { console.error('Erro ao excluir cartão:', error); throw error; }
  },

  // ============================================================
  // PROJECTS
  // ============================================================

  async getProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('id, user_id, created_at, name, status, progress, description, due_date')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.error('Erro ao buscar projetos:', error); throw error; }
    return (data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      name: r.name,
      status: r.status,
      progress: Number(r.progress ?? 0),
      description: r.description ?? undefined,
      dueDate: r.due_date ?? undefined,
    }));
  },

  async saveProject(project: Project, userId: string): Promise<void> {
    const { error } = await supabase.from('projects').upsert(
      {
        id: project.id,
        user_id: userId,
        name: project.name,
        status: project.status,
        progress: project.progress,
        description: project.description ?? null,
        due_date: project.dueDate ?? null,
      },
      { onConflict: 'id' }
    );
    if (error) { console.error('Erro ao salvar projeto:', error); throw error; }
  },

  async deleteProject(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('projects').delete()
      .eq('id', projectId).eq('user_id', userId);
    if (error) { console.error('Erro ao excluir projeto:', error); throw error; }
  },

  // ============================================================
  // TASKS
  // ============================================================

  async getTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, user_id, created_at, title, description, status, priority, due_date, project_id')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) { console.error('Erro ao buscar tarefas:', error); throw error; }
    return (data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      title: r.title,
      description: r.description ?? undefined,
      status: r.status,
      priority: r.priority,
      dueDate: r.due_date ?? undefined,
      projectId: r.project_id ?? undefined,
    }));
  },

  async saveTask(task: Task, userId: string): Promise<void> {
    const { error } = await supabase.from('tasks').upsert(
      { id: task.id, user_id: userId, title: task.title, description: task.description, status: task.status, priority: task.priority, due_date: task.dueDate ?? null, project_id: task.projectId ?? null },
      { onConflict: 'id' }
    );
    if (error) { console.error('Erro ao salvar tarefa:', error); throw error; }
  },

  async deleteTask(taskId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks').delete()
      .eq('id', taskId).eq('user_id', userId);
    if (error) { console.error('Erro ao excluir tarefa:', error); throw error; }
  },

  // ============================================================
  // HABITS
  // ============================================================

  async getHabits(userId: string): Promise<Habit[]> {
    const { data, error } = await supabase
      .from('habits')
      .select('id, user_id, created_at, name, frequency')
      .eq('user_id', userId)
      .order('name');
    if (error) { console.error('Erro ao buscar hábitos:', error); throw error; }
    return (data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      name: r.name,
      frequency: r.frequency,
    }));
  },

  async saveHabit(habit: Habit, userId: string): Promise<void> {
    const { error } = await supabase.from('habits').upsert(
      { id: habit.id, user_id: userId, name: habit.name, frequency: habit.frequency },
      { onConflict: 'id' }
    );
    if (error) { console.error('Erro ao salvar hábito:', error); throw error; }
  },

  async deleteHabit(habitId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('habits').delete()
      .eq('id', habitId).eq('user_id', userId);
    if (error) { console.error('Erro ao excluir hábito:', error); throw error; }
  },

  // ============================================================
  // HABIT LOGS
  // ============================================================

  async getHabitLogs(userId: string, habitId?: string): Promise<HabitLog[]> {
    let query = supabase
      .from('habit_logs')
      .select('id, user_id, created_at, habit_id, date, completed')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (habitId) query = query.eq('habit_id', habitId);
    const { data, error } = await query;
    if (error) { console.error('Erro ao buscar logs de hábito:', error); throw error; }
    return (data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      habitId: r.habit_id,
      date: r.date,
      completed: r.completed,
    }));
  },

  async saveHabitLog(log: HabitLog, userId: string): Promise<void> {
    const { error } = await supabase.from('habit_logs').upsert(
      { id: log.id, user_id: userId, habit_id: log.habitId, date: log.date, completed: log.completed },
      { onConflict: 'habit_id,date' }
    );
    if (error) { console.error('Erro ao salvar log de hábito:', error); throw error; }
  },

  async deleteHabitLog(logId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('habit_logs').delete()
      .eq('id', logId).eq('user_id', userId);
    if (error) { console.error('Erro ao excluir log de hábito:', error); throw error; }
  },

  // ============================================================
  // NOTES
  // ============================================================

  async getNotes(userId: string, typeNote?: Note['typeNote']): Promise<Note[]> {
    let query = supabase
      .from('notes')
      .select('id, user_id, created_at, title, content, type_note')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (typeNote) query = query.eq('type_note', typeNote);
    const { data, error } = await query;
    if (error) { console.error('Erro ao buscar notas:', error); throw error; }
    return (data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      title: r.title ?? undefined,
      content: r.content ?? undefined,
      typeNote: r.type_note,
    }));
  },

  async saveNote(note: Note, userId: string): Promise<void> {
    const { error } = await supabase.from('notes').upsert(
      { id: note.id, user_id: userId, title: note.title ?? null, content: note.content ?? null, type_note: note.typeNote },
      { onConflict: 'id' }
    );
    if (error) { console.error('Erro ao salvar nota:', error); throw error; }
  },

  async deleteNote(noteId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('notes').delete()
      .eq('id', noteId).eq('user_id', userId);
    if (error) { console.error('Erro ao excluir nota:', error); throw error; }
  },
};
