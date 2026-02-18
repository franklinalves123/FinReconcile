
import React, { useState } from 'react';
import { Transaction, MatchStatus, SystemTransaction } from '../types.ts';
import { Check, AlertTriangle, Link as LinkIcon, Plus, Layers } from 'lucide-react';
import { Button } from './ui/Button.tsx';

interface ReconciliationProps {
  transactions: Transaction[];
  systemTransactions: SystemTransaction[];
  onComplete: () => Promise<void>;
  onCreateSystemMatch: (transactionId: string) => void;
}

export const Reconciliation: React.FC<ReconciliationProps> = ({ 
  transactions, 
  systemTransactions, 
  onComplete,
  onCreateSystemMatch 
}) => {
  const [items, setItems] = useState(transactions);
  const [isFinishing, setIsFinishing] = useState(false);
  
  const handleMatch = (id: string) => {
    setItems(prev => prev.map(t => t.id === id ? { ...t, status: MatchStatus.MATCHED } : t));
  };

  const handleCreateAndMatch = (id: string) => {
    handleMatch(id);
    onCreateSystemMatch(id);
  };

  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
        await onComplete();
    } catch (e) {
        console.error("Erro ao finalizar:", e);
        alert("Ocorreu um erro ao salvar a conciliação.");
    } finally {
        setIsFinishing(false);
    }
  };

  const matchedCount = items.filter(t => t.status === MatchStatus.MATCHED).length;
  const progress = Math.round((matchedCount / items.length) * 100) || 0;

  return (
    <div className="h-full flex flex-col animate-fade-in pb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Conciliação Bancária</h2>
          <p className="text-neutral-500 text-sm">Combine itens da fatura com registros do sistema.</p>
        </div>
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-xs font-bold text-neutral-500 uppercase block">Progresso</span>
                <span className="text-lg font-bold text-primary">{progress}%</span>
             </div>
             <div className="w-32 h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }}></div>
             </div>
             <Button 
                onClick={handleFinish} 
                disabled={progress < 100 || isFinishing} 
                isLoading={isFinishing}
                className="bg-primary min-w-[180px] shadow-lg shadow-blue-100"
             >
                {isFinishing ? 'Salvando...' : 'Finalizar Conciliação'}
             </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {items.map((t) => {
            const potentialMatch = systemTransactions.find(st => 
                st.amount === t.amount || 
                (st.amount === t.amount && Math.abs(new Date(st.date).getTime() - new Date(t.purchaseDate).getTime()) < 86400000 * 5)
            );

            const isMatched = t.status === MatchStatus.MATCHED;

            return (
                <div key={t.id} className={`bg-white rounded-lg shadow-sm border transition-all duration-300 ${isMatched ? 'border-green-200 bg-green-50/10' : 'border-neutral-200 hover:shadow-md'}`}>
                    <div className="flex min-h-[120px]">
                        <div className="flex-1 p-5 border-r border-neutral-100">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Item da Fatura</span>
                                <span className="text-[10px] text-neutral-400 font-medium">{t.purchaseDate}</span>
                            </div>
                            <h4 className="font-bold text-neutral-900 text-sm leading-tight">{t.description}</h4>
                            <div className="flex justify-between items-end mt-3">
                                <span className="text-xl font-black text-neutral-900">
                                    {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[9px] bg-neutral-100 px-2 py-0.5 rounded-full text-neutral-600 font-bold uppercase">{t.category}</span>
                                    {t.subcategory && (
                                        <span className="text-[8px] bg-blue-50 px-2 py-0.5 rounded-full text-primary font-bold uppercase border border-blue-100 flex items-center gap-1">
                                            <Layers size={8}/> {t.subcategory}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="w-20 flex flex-col items-center justify-center bg-neutral-50/50 p-2 gap-3">
                            {isMatched ? (
                                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-100 animate-fade-in">
                                    <Check size={20} strokeWidth={3} />
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handleMatch(t.id)}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                        potentialMatch 
                                        ? 'bg-primary text-white hover:bg-blue-600 shadow-md shadow-blue-200 scale-110' 
                                        : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                    }`}
                                    disabled={!potentialMatch}
                                >
                                    <LinkIcon size={18} />
                                </button>
                            )}
                        </div>

                        <div className={`flex-1 p-5 ${isMatched ? 'bg-green-50/30' : 'bg-white'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Sistema</span>
                            </div>
                            
                            {isMatched ? (
                                <div className="h-full flex flex-col items-center justify-center text-green-600 animate-fade-in">
                                    <Check size={24} className="mb-1" />
                                    <span className="text-xs font-bold uppercase tracking-tighter">Conciliado</span>
                                </div>
                            ) : potentialMatch ? (
                                <>
                                    <h4 className="font-bold text-neutral-700 text-sm leading-tight">{potentialMatch.description}</h4>
                                    <div className="flex justify-between items-end mt-3">
                                        <span className="text-xl font-bold text-neutral-600">
                                            {potentialMatch.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                        <div className="text-right">
                                          <p className="text-[10px] text-neutral-400 font-bold">{potentialMatch.date}</p>
                                          <p className="text-[10px] text-primary font-bold">{potentialMatch.account}</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-2 border-2 border-dashed border-neutral-100 rounded-xl p-2">
                                    <AlertTriangle size={20} className="text-neutral-300" />
                                    <span className="text-[10px] font-bold uppercase text-center leading-tight">Não encontrado</span>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="mt-1 h-7 text-[10px] font-bold"
                                      onClick={() => handleCreateAndMatch(t.id)}
                                    >
                                      <Plus size={10} className="mr-1"/> Criar e Conciliar
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};
