
import React from 'react';
import { FileText, Trash2, Calendar, CreditCard, ChevronRight } from 'lucide-react';
import { InvoiceFile } from '../types.ts';
import { Button } from './ui/Button.tsx';

interface InvoicesProps {
  files: InvoiceFile[];
  onDelete: (id: string) => void;
}

export const Invoices: React.FC<InvoicesProps> = ({ files, onDelete }) => {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Gestão de Faturas</h2>
          <p className="text-neutral-500 text-sm">Faturas importadas e conciliadas no sistema.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {files.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-300">
                <FileText size={32} />
            </div>
            <p className="text-neutral-500 font-medium">Nenhuma fatura encontrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {files.map((file) => (
              <div key={file.id} className="p-6 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-800">{file.name}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-xs text-neutral-400">
                        <Calendar size={12}/> {new Date(file.uploadDate).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-neutral-400 font-bold uppercase">
                        <CreditCard size={12}/> {file.cardIssuer}
                      </span>
                      <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {file.transactionCount || 0} Itens Conciliados
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right mr-4">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase">Tamanho</p>
                    <p className="text-sm font-medium text-neutral-700">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(file.id)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
