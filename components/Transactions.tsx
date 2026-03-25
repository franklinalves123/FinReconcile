
import React, { useState, useMemo, useRef } from 'react';
import { Trash2, List, UploadCloud, Search, X, Pencil, Save } from 'lucide-react';
import { Transaction, Category } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { parseBRLAmount } from '../services/dataService.ts';

interface TransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onUpdateTransaction: (transaction: Transaction) => Promise<void>;
  onNavigateToUpload: () => void;
}

interface EditDraft {
  type: 'expense' | 'income';
  description: string;
  amount: string;
  purchaseDate: string;
  category: string;
  subcategory: string;
  cardIssuer: string;
}

export const Transactions: React.FC<TransactionsProps> = ({
  transactions,
  categories,
  onDeleteTransaction,
  onUpdateTransaction,
  onNavigateToUpload,
}) => {
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [auditFilter, setAuditFilter] = useState<'all' | 'no-category' | 'no-subcategory'>('all');
  const [editingTx, setEditingTx]     = useState<Transaction | null>(null);
  const [editDraft, setEditDraft]     = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving]   = useState(false);
  const descRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = [...transactions].sort((a, b) =>
      (b.purchaseDate || b.date).localeCompare(a.purchaseDate || a.date)
    );
    let result = q
      ? base.filter(t =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.cardIssuer || '').toLowerCase().includes(q)
        )
      : base;
    if (auditFilter === 'no-category') {
      result = result.filter(t => !t.category || t.category === 'Outros');
    } else if (auditFilter === 'no-subcategory') {
      result = result.filter(t => t.category && t.category !== 'Outros' && !t.subcategory?.trim());
    }
    return result;
  }, [transactions, search, auditFilter]);

  const handleDelete = async (t: Transaction) => {
    const confirmed = window.confirm(
      `Excluir "${t.description}" (${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})?`
    );
    if (!confirmed) return;
    setDeletingId(t.id);
    try {
      await onDeleteTransaction(t.id);
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (t: Transaction) => {
    setEditingTx(t);
    setEditDraft({
      type:         t.type === 'income' ? 'income' : 'expense',
      description:  t.description,
      amount:       t.amount.toFixed(2).replace('.', ','),
      purchaseDate: t.purchaseDate || t.date,
      category:     t.category || '',
      subcategory:  t.subcategory || '',
      cardIssuer:   t.cardIssuer || '',
    });
    setTimeout(() => descRef.current?.focus(), 60);
  };

  const handleSaveEdit = async () => {
    if (!editingTx || !editDraft) return;
    setEditSaving(true);
    try {
      const updated: Transaction = {
        ...editingTx,
        type:         editDraft.type,
        description:  editDraft.description.trim(),
        amount:       parseBRLAmount(editDraft.amount),
        purchaseDate: editDraft.purchaseDate,
        date:         editDraft.purchaseDate,
        category:     editDraft.category.trim() || 'Outros',
        subcategory:  editDraft.subcategory.trim() || undefined,
        cardIssuer:   (editDraft.cardIssuer.trim() || undefined) as any,
      };
      await onUpdateTransaction(updated);
      setEditingTx(null);
      setEditDraft(null);
    } catch {
      // toast handled by App.tsx
    } finally {
      setEditSaving(false);
    }
  };

  // Safe date formatter — no Date object, no TZ shift
  const formatDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const totalFiltered = filtered.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Transações</h2>
          <p className="text-neutral-500 text-sm">
            {transactions.length} lançamento{transactions.length !== 1 ? 's' : ''} no total
          </p>
        </div>
        {transactions.length > 0 && (
          <Button onClick={onNavigateToUpload} variant="outline" size="sm">
            <UploadCloud size={15} className="mr-2" /> Importar Fatura
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-24 flex flex-col items-center gap-5 text-center px-8">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
              <List size={36} className="text-primary opacity-60" />
            </div>
            <div>
              <p className="text-neutral-800 font-semibold text-lg">Nenhum lançamento ainda</p>
              <p className="text-neutral-400 text-sm mt-1 max-w-xs mx-auto">
                Importe uma fatura ou adicione um lançamento manual para começar.
              </p>
            </div>
            <Button onClick={onNavigateToUpload} className="mt-2">
              <UploadCloud size={16} className="mr-2" /> Importar Fatura
            </Button>
          </div>
        ) : (
          <>
            {/* Search bar */}
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
              <Search size={15} className="text-neutral-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por descrição, categoria ou banco…"
                className="flex-1 text-sm outline-none placeholder:text-neutral-400 bg-transparent"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-neutral-300 hover:text-neutral-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Audit filter pills */}
            <div className="px-4 py-2 border-b border-neutral-100 flex items-center gap-2 flex-wrap">
              {([
                { id: 'all',            label: 'Todas' },
                { id: 'no-category',    label: 'Sem Categoria' },
                { id: 'no-subcategory', label: 'Sem Subcategoria' },
              ] as const).map(f => (
                <button
                  key={f.id}
                  onClick={() => setAuditFilter(f.id)}
                  className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                    auditFilter === f.id
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Table header */}
            <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-2.5 grid grid-cols-12 gap-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <div className="col-span-2">Data</div>
              <div className="col-span-4">Descrição</div>
              <div className="col-span-2 text-right">Valor</div>
              <div className="col-span-2">Categoria</div>
              <div className="col-span-1">Banco</div>
              <div className="col-span-1 text-center">Ações</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-neutral-50 max-h-[calc(100vh-320px)] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-neutral-400 py-12">
                  Nenhum resultado para os filtros aplicados.
                </p>
              ) : (
                filtered.map(t => {
                  const isDeleting = deletingId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm transition-colors ${
                        isDeleting ? 'opacity-40 bg-red-50' : 'hover:bg-neutral-50/80'
                      }`}
                    >
                      <div className="col-span-2 text-xs text-neutral-500 font-medium whitespace-nowrap">
                        {formatDate(t.purchaseDate || t.date)}
                      </div>
                      <div className="col-span-4 text-neutral-800 truncate" title={t.description}>
                        {t.description}
                      </div>
                      <div className={`col-span-2 text-right font-bold ${t.type === 'income' ? 'text-green-600' : 'text-neutral-900'}`}>
                        {t.type === 'income' ? '+' : ''}{formatBRL(t.amount)}
                      </div>
                      <div className="col-span-2 flex flex-col gap-0.5">
                        <span className="inline-block bg-neutral-100 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-full">
                          {t.category || '—'}
                        </span>
                        {t.category && t.category !== 'Outros' && !t.subcategory?.trim() && (
                          <span className="inline-block bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            Sem subcategoria
                          </span>
                        )}
                      </div>
                      <div className="col-span-1 text-[10px] font-bold uppercase text-neutral-400 truncate">
                        {t.cardIssuer || '—'}
                      </div>
                      <div className="col-span-1 flex justify-center items-center gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          title="Editar lançamento"
                          className="p-1.5 text-neutral-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          disabled={isDeleting}
                          title="Excluir lançamento"
                          className="p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:cursor-not-allowed"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 py-2.5 flex justify-between items-center text-xs text-neutral-500">
              <span>
                {filtered.length} de {transactions.length} lançamento{transactions.length !== 1 ? 's' : ''}
                {search ? ` · "${search}"` : ''}
                {auditFilter === 'no-category' ? ' · Sem Categoria' : auditFilter === 'no-subcategory' ? ' · Sem Subcategoria' : ''}
              </span>
              <span className="font-bold text-neutral-900 text-sm">
                {formatBRL(totalFiltered)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ─── Edit Modal ─── */}
      {editingTx && editDraft && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setEditingTx(null); setEditDraft(null); } }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h3 className="text-sm font-black uppercase tracking-wide text-neutral-700">Editar Lançamento</h3>
              <button
                onClick={() => { setEditingTx(null); setEditDraft(null); }}
                className="text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              {/* Type toggle */}
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1.5">Tipo</label>
                <div className="flex gap-2">
                  {(['expense', 'income'] as const).map(tp => (
                    <button
                      key={tp}
                      onClick={() => setEditDraft(d => d ? { ...d, type: tp } : d)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        editDraft.type === tp
                          ? tp === 'expense'
                            ? 'bg-red-50 border-red-300 text-red-600'
                            : 'bg-green-50 border-green-300 text-green-600'
                          : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300'
                      }`}
                    >
                      {tp === 'expense' ? 'Despesa' : 'Receita'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Descrição</label>
                <input
                  ref={descRef}
                  value={editDraft.description}
                  onChange={e => setEditDraft(d => d ? { ...d, description: e.target.value } : d)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Amount + Date (2 col) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editDraft.amount}
                    onChange={e => setEditDraft(d => d ? { ...d, amount: e.target.value } : d)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Data</label>
                  <input
                    type="date"
                    value={editDraft.purchaseDate}
                    onChange={e => setEditDraft(d => d ? { ...d, purchaseDate: e.target.value } : d)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Category + Subcategory (2 col) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Categoria</label>
                  <select
                    value={editDraft.category}
                    onChange={e => setEditDraft(d => d ? { ...d, category: e.target.value, subcategory: '' } : d)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Subcategoria</label>
                  <select
                    value={editDraft.subcategory}
                    disabled={!editDraft.category || editDraft.category === 'Outros'}
                    onChange={e => setEditDraft(d => d ? { ...d, subcategory: e.target.value } : d)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-neutral-50 disabled:text-neutral-400"
                  >
                    <option value="">Nenhuma</option>
                    {categories.find(c => c.name === editDraft.category)?.subcategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    {editDraft.subcategory && !categories.find(c => c.name === editDraft.category)?.subcategories.includes(editDraft.subcategory) && (
                      <option value={editDraft.subcategory}>{editDraft.subcategory} (Sugerido IA)</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Conta / Cartão */}
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Conta / Cartão</label>
                <input
                  value={editDraft.cardIssuer}
                  onChange={e => setEditDraft(d => d ? { ...d, cardIssuer: e.target.value } : d)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditingTx(null); setEditDraft(null); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={editSaving || !editDraft.description.trim()}
              >
                <Save size={13} className="mr-1.5" />
                {editSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
