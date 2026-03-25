
import React, { useMemo, useState } from 'react';
import { FileText, Trash2, Calendar, CreditCard, UploadCloud, AlertTriangle, Pencil } from 'lucide-react';
import { InvoiceFile, Transaction } from '../types.ts';
import { Button } from './ui/Button.tsx';

interface InvoicesProps {
  files: InvoiceFile[];
  allTransactions: Transaction[];
  onDelete: (id: string) => Promise<void>;
  onNavigateToUpload: () => void;
  onReviewInvoice: (transactions: Transaction[]) => void;
}

export const Invoices: React.FC<InvoicesProps> = ({
  files,
  allTransactions,
  onDelete,
  onNavigateToUpload,
  onReviewInvoice,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Computa valor total por fatura a partir das transações salvas
  const totalByInvoice = useMemo(() => {
    const map: Record<string, number> = {};
    allTransactions.forEach(t => {
      if (t.invoiceId && t.invoiceId !== 'manual-entry') {
        map[t.invoiceId] = (map[t.invoiceId] || 0) + t.amount;
      }
    });
    return map;
  }, [allTransactions]);

  const handleDeleteClick = async (file: InvoiceFile) => {
    const confirmed = window.confirm(
      `Apagar a fatura "${file.name}" e todas as suas transações permanentemente?`
    );
    if (!confirmed) return;

    setDeletingId(file.id);
    try {
      await onDelete(file.id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  const formatBRL = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Gestão de Faturas</h2>
          <p className="text-neutral-500 text-sm">Faturas importadas e conciliadas no sistema.</p>
        </div>
        {files.length > 0 && (
          <Button onClick={onNavigateToUpload} variant="outline" size="sm">
            <UploadCloud size={15} className="mr-2" /> Importar Nova
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {files.length === 0 ? (
          /* ── Empty state ── */
          <div className="py-24 flex flex-col items-center gap-5 text-center px-8">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
              <FileText size={36} className="text-primary opacity-60" />
            </div>
            <div>
              <p className="text-neutral-800 font-semibold text-lg">Nenhuma fatura importada ainda</p>
              <p className="text-neutral-400 text-sm mt-1 max-w-xs mx-auto">
                Importe seu primeiro PDF de fatura para começar a conciliar seus lançamentos.
              </p>
            </div>
            <Button onClick={onNavigateToUpload} className="mt-2">
              <UploadCloud size={16} className="mr-2" /> Importar Primeira Fatura
            </Button>
          </div>
        ) : (
          <>
            {/* ── Cabeçalho da tabela ── */}
            <div className="bg-neutral-50 border-b border-neutral-200 px-6 py-3 grid grid-cols-12 gap-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <div className="col-span-4">Arquivo</div>
              <div className="col-span-2">Data de Import.</div>
              <div className="col-span-2">Emissor</div>
              <div className="col-span-1 text-center">Qtd.</div>
              <div className="col-span-2 text-right">Valor Total</div>
              <div className="col-span-1 text-center">Ação</div>
            </div>

            {/* ── Linhas ── */}
            <div className="divide-y divide-neutral-100">
              {files.map((file) => {
                const total = totalByInvoice[file.id] ?? 0;
                const count = file.transactionCount ?? 0;
                const isDeleting = deletingId === file.id;

                return (
                  <div
                    key={file.id}
                    className={`px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors ${
                      isDeleting ? 'opacity-50 bg-red-50' : 'hover:bg-neutral-50'
                    }`}
                  >
                    {/* Nome do arquivo */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-red-50 text-red-400 rounded-lg flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <span className="text-sm font-medium text-neutral-800 truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>

                    {/* Data */}
                    <div className="col-span-2 flex items-center gap-1.5 text-sm text-neutral-500">
                      <Calendar size={13} className="shrink-0" />
                      {formatDate(file.uploadDate)}
                    </div>

                    {/* Emissor */}
                    <div className="col-span-2 flex items-center gap-1.5">
                      <CreditCard size={13} className="text-neutral-400 shrink-0" />
                      <span className="text-xs font-bold uppercase text-neutral-600">
                        {file.cardIssuer || '—'}
                      </span>
                    </div>

                    {/* Qtd transações */}
                    <div className="col-span-1 text-center">
                      <span className="inline-block bg-blue-50 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                        {count}
                      </span>
                    </div>

                    {/* Valor total */}
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-bold text-neutral-900">
                        {total > 0 ? formatBRL(total) : (
                          <span className="text-neutral-300 font-normal text-xs flex items-center justify-end gap-1">
                            <AlertTriangle size={11} /> sem dados
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Botões de ação */}
                    <div className="col-span-1 flex justify-center items-center gap-1">
                      <button
                        onClick={() => onReviewInvoice(allTransactions.filter(t => t.invoiceId === file.id))}
                        title="Revisar e re-categorizar transações"
                        className="p-2 text-neutral-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(file)}
                        disabled={isDeleting}
                        title="Excluir fatura"
                        className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:cursor-not-allowed"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Rodapé com total geral ── */}
            <div className="bg-neutral-50 border-t border-neutral-200 px-6 py-3 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-7 text-xs text-neutral-400">
                {files.length} fatura{files.length !== 1 ? 's' : ''} no total
              </div>
              <div className="col-span-1 text-center text-xs font-bold text-neutral-600">
                {files.reduce((s, f) => s + (f.transactionCount ?? 0), 0)}
              </div>
              <div className="col-span-2 text-right text-sm font-bold text-neutral-900">
                {formatBRL(Object.values(totalByInvoice).reduce((s, v) => s + v, 0))}
              </div>
              <div className="col-span-2" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
