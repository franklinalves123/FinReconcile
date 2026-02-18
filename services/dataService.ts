
import { supabase } from '../lib/supabase.ts';
import { Transaction, Category, Tag, InvoiceFile } from '../types.ts';

/**
 * SERVIÇO DE DADOS RESILIENTE
 * Usamos mapeamento explícito para evitar erros de 'schema cache' do Supabase
 */

export const dataService = {
  async getTransactions(userId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, invoice_id, purchase_date, description, amount, category, subcategory, tags, status, card_issuer, notes')
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
      tags: Array.isArray(t.tags) ? t.tags : [],
      invoiceId: t.invoice_id || 'manual-entry',
      status: t.status,
      cardIssuer: t.card_issuer || 'Outros',
      notes: t.notes || ''
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
      amount: t.amount,
      category: t.category,
      subcategory: t.subcategory,
      tags: t.tags || [],
      status: t.status,
      card_issuer: t.cardIssuer,
      notes: t.notes
    }));

    const { error } = await supabase.from('transactions').insert(txsToSave);
    if (error) {
      console.error("Erro Supabase ao inserir transações:", error.message);
      // Se o erro persistir dizendo que a coluna não existe, o Passo 1 (SQL) é obrigatório
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

  async deleteInvoice(invoiceId: string, userId: string) {
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
  }
};
