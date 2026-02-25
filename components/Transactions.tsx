
import React, { useState, useMemo } from 'react';
import { Trash2, List, UploadCloud, Search, X } from 'lucide-react';
import { Transaction } from '../types.ts';
import { Button } from './ui/Button.tsx';

interface TransactionsProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onNavigateToUpload: () => void;
}

export const Transactions: React.FC<TransactionsProps> = ({
  transactions,
  onDeleteTransaction,
  onNavigateToUpload,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = [...transactions].sort((a, b) =>
      (b.purchaseDate || b.date).localeCompare(a.purchaseDate || a.date)
    );
    if (!q) return base;
    return base.filter(t =>
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.cardIssuer || '').toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const handleDelete = async (t: Transaction) => {
    const confirmed = window.confirm(`Excluir "${t.description}" (${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})?`);
    if (!confirmed) return;
    setDeletingId(t.id);
    try {
      await onDeleteTransaction(t.id);
    } finally {
      setDeletingId(null);
    }
  };

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

      {/* Cabeçalho */}
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
          /* ── Empty state ── */
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
            {/* Barra de pesquisa */}
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

            {/* Cabeçalho da tabela */}
            <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-2.5 grid grid-cols-12 gap-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <div className="col-span-2">Data</div>
              <div className="col-span-4">Descrição</div>
              <div className="col-span-2 text-right">Valor</div>
              <div className="col-span-2">Categoria</div>
              <div className="col-span-1">Banco</div>
              <div className="col-span-1 text-center">Ação</div>
            </div>

            {/* Linhas */}
            <div className="divide-y divide-neutral-50 max-h-[calc(100vh-320px)] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-neutral-400 py-12">
                  Nenhum resultado para <strong>"{search}"</strong>
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
                      <div className="col-span-2 text-right font-bold text-neutral-900">
                        {formatBRL(t.amount)}
                      </div>
                      <div className="col-span-2">
                        <span className="inline-block bg-neutral-100 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-full">
                          {t.category || '—'}
                        </span>
                      </div>
                      <div className="col-span-1 text-[10px] font-bold uppercase text-neutral-400 truncate">
                        {t.cardIssuer || '—'}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          onClick={() => handleDelete(t)}
                          disabled={isDeleting}
                          title="Excluir lançamento"
                          className="p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé */}
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 py-2.5 flex justify-between items-center text-xs text-neutral-500">
              <span>
                {filtered.length} de {transactions.length} lançamento{transactions.length !== 1 ? 's' : ''}
                {search ? ` · filtrado por "${search}"` : ''}
              </span>
              <span className="font-bold text-neutral-900 text-sm">
                {formatBRL(totalFiltered)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
