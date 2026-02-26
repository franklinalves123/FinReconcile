
import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet as WalletIcon, CreditCard as CreditCardIcon,
  Trash2, Building2, Banknote, TrendingUp, Coins, Plus,
} from 'lucide-react';
import { Account, CreditCard } from '../types.ts';
import { dataService, parseBRLAmount } from '../services/dataService.ts';
import { Button } from './ui/Button.tsx';

interface WalletProps {
  userId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

type AccountType = Account['type'];
type Tab = 'accounts' | 'cards';

const ACCOUNT_LABELS: Record<AccountType, string> = {
  checking:   'Corrente',
  savings:    'Poupança',
  investment: 'Investimento',
  wallet:     'Carteira',
};

const ACCOUNT_COLORS: Record<AccountType, string> = {
  checking:   'bg-blue-50 text-blue-600',
  savings:    'bg-green-50 text-green-600',
  investment: 'bg-purple-50 text-purple-600',
  wallet:     'bg-amber-50 text-amber-600',
};

const AccountIcon: React.FC<{ type: AccountType }> = ({ type }) => {
  if (type === 'checking')   return <Building2 size={16} />;
  if (type === 'savings')    return <Banknote size={16} />;
  if (type === 'investment') return <TrendingUp size={16} />;
  return <Coins size={16} />;
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const Wallet: React.FC<WalletProps> = ({ userId, onToast }) => {
  const [tab, setTab] = useState<Tab>('accounts');

  // ── Accounts ──────────────────────────────────────────────
  const [accounts, setAccounts]           = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccts] = useState(true);
  const [accName, setAccName]             = useState('');
  const [accType, setAccType]             = useState<AccountType>('checking');
  const [accBalance, setAccBalance]       = useState('');
  const [savingAcc, setSavingAcc]         = useState(false);
  const [deletingAccId, setDeletingAccId] = useState<string | null>(null);

  // ── Credit cards ──────────────────────────────────────────
  const [cards, setCards]                 = useState<CreditCard[]>([]);
  const [loadingCards, setLoadingCards]   = useState(true);
  const [cardName, setCardName]           = useState('');
  const [cardLimit, setCardLimit]         = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('');
  const [cardDueDay, setCardDueDay]       = useState('');
  const [savingCard, setSavingCard]       = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // ── Loaders ───────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    try {
      setLoadingAccts(true);
      setAccounts(await dataService.getAccounts(userId));
    } catch (e: any) {
      onToast('Erro ao carregar contas: ' + (e.message || ''), 'error');
    } finally {
      setLoadingAccts(false);
    }
  }, [userId, onToast]);

  const loadCards = useCallback(async () => {
    try {
      setLoadingCards(true);
      setCards(await dataService.getCreditCards(userId));
    } catch (e: any) {
      onToast('Erro ao carregar cartões: ' + (e.message || ''), 'error');
    } finally {
      setLoadingCards(false);
    }
  }, [userId, onToast]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadCards(); },    [loadCards]);

  // ── Accounts CRUD ─────────────────────────────────────────
  const handleAddAccount = async () => {
    if (!accName.trim()) return;
    const newAcc: Account = {
      id:        crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      name:      accName.trim(),
      type:      accType,
      balance:   parseBRLAmount(accBalance) || 0,
    };
    setSavingAcc(true);
    try {
      await dataService.saveAccount(newAcc, userId);
      setAccounts(prev => [...prev, newAcc]);
      setAccName(''); setAccBalance(''); setAccType('checking');
      onToast('Conta adicionada com sucesso!', 'success');
    } catch (e: any) {
      onToast('Erro ao salvar conta: ' + (e.message || ''), 'error');
    } finally {
      setSavingAcc(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Excluir esta conta permanentemente?')) return;
    setDeletingAccId(id);
    try {
      await dataService.deleteAccount(id, userId);
      setAccounts(prev => prev.filter(a => a.id !== id));
      onToast('Conta excluída.', 'success');
    } catch (e: any) {
      onToast('Erro ao excluir conta: ' + (e.message || ''), 'error');
    } finally {
      setDeletingAccId(null);
    }
  };

  // ── Credit cards CRUD ─────────────────────────────────────
  const handleAddCard = async () => {
    if (!cardName.trim()) return;
    const newCard: CreditCard = {
      id:           crypto.randomUUID(),
      userId,
      createdAt:    new Date().toISOString(),
      name:         cardName.trim(),
      limitAmount:  parseBRLAmount(cardLimit) || 0,
      closingDay:   Math.min(31, Math.max(1, parseInt(cardClosingDay) || 1)),
      dueDay:       Math.min(31, Math.max(1, parseInt(cardDueDay) || 10)),
    };
    setSavingCard(true);
    try {
      await dataService.saveCreditCard(newCard, userId);
      setCards(prev => [...prev, newCard]);
      setCardName(''); setCardLimit(''); setCardClosingDay(''); setCardDueDay('');
      onToast('Cartão adicionado com sucesso!', 'success');
    } catch (e: any) {
      onToast('Erro ao salvar cartão: ' + (e.message || ''), 'error');
    } finally {
      setSavingCard(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!window.confirm('Excluir este cartão permanentemente?')) return;
    setDeletingCardId(id);
    try {
      await dataService.deleteCreditCard(id, userId);
      setCards(prev => prev.filter(c => c.id !== id));
      onToast('Cartão excluído.', 'success');
    } catch (e: any) {
      onToast('Erro ao excluir cartão: ' + (e.message || ''), 'error');
    } finally {
      setDeletingCardId(null);
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalLimit   = cards.reduce((s, c) => s + c.limitAmount, 0);

  // ── Input class ───────────────────────────────────────────
  const input = 'w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none';

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Carteira</h2>
        <p className="text-neutral-500 text-sm mt-1">Gerencie suas contas bancárias e cartões de crédito.</p>
      </div>

      {/* Tab container */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-neutral-200">
          {(['accounts', 'cards'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                tab === t
                  ? 'text-primary border-b-2 border-primary bg-blue-50/40'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {t === 'accounts' ? 'Contas Bancárias' : 'Cartões de Crédito'}
              {t === 'accounts' && accounts.length > 0 && (
                <span className="ml-2 text-[10px] bg-blue-100 text-primary rounded-full px-2 py-0.5">{accounts.length}</span>
              )}
              {t === 'cards' && cards.length > 0 && (
                <span className="ml-2 text-[10px] bg-blue-100 text-primary rounded-full px-2 py-0.5">{cards.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-8">

          {/* ═══════════════ ACCOUNTS TAB ═══════════════ */}
          {tab === 'accounts' && (
            <>
              {/* Form */}
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">Adicionar Conta</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Nome da Conta *</label>
                    <input
                      type="text"
                      value={accName}
                      onChange={e => setAccName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && accName.trim() && handleAddAccount()}
                      placeholder="Ex: Nubank, Itaú Corrente…"
                      className={input}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Tipo</label>
                    <select
                      value={accType}
                      onChange={e => setAccType(e.target.value as AccountType)}
                      className={input + ' bg-white'}
                    >
                      <option value="checking">Corrente</option>
                      <option value="savings">Poupança</option>
                      <option value="investment">Investimento</option>
                      <option value="wallet">Carteira</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Saldo Inicial</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={accBalance}
                      onChange={e => setAccBalance(e.target.value)}
                      placeholder="Ex: 1.500,00"
                      className={input}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleAddAccount}
                      disabled={!accName.trim()}
                      isLoading={savingAcc}
                      className="w-full"
                    >
                      <Plus size={15} className="mr-1.5" /> Adicionar Conta
                    </Button>
                  </div>
                </div>
              </div>

              {/* List */}
              {loadingAccounts ? (
                <div className="text-center py-10 text-neutral-400 text-sm">Carregando...</div>
              ) : accounts.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-neutral-400">
                  <WalletIcon size={36} className="opacity-25" />
                  <p className="text-sm">Nenhuma conta cadastrada ainda.</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Suas Contas</h3>
                    <span className="text-xs text-neutral-500">
                      Total: <span className="font-black text-neutral-900">{formatBRL(totalBalance)}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {accounts.map(acc => {
                      const isDeleting = deletingAccId === acc.id;
                      return (
                        <div
                          key={acc.id}
                          className={`flex items-start justify-between p-4 rounded-xl border transition-all ${
                            isDeleting ? 'opacity-40 bg-red-50 border-red-100' : 'bg-neutral-50 border-neutral-100 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ACCOUNT_COLORS[acc.type]}`}>
                              <AccountIcon type={acc.type} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-neutral-800 leading-tight">{acc.name}</p>
                              <span className={`mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${ACCOUNT_COLORS[acc.type]}`}>
                                {ACCOUNT_LABELS[acc.type]}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className={`text-sm font-black ${acc.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {formatBRL(acc.balance)}
                            </p>
                            <button
                              onClick={() => handleDeleteAccount(acc.id)}
                              disabled={isDeleting}
                              title="Excluir conta"
                              className="p-1 text-neutral-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════ CARDS TAB ═══════════════ */}
          {tab === 'cards' && (
            <>
              {/* Form */}
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">Adicionar Cartão</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Nome do Cartão *</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && cardName.trim() && handleAddCard()}
                      placeholder="Ex: Nubank Roxinho, Inter Gold…"
                      className={input}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Limite</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cardLimit}
                      onChange={e => setCardLimit(e.target.value)}
                      placeholder="Ex: 5.000,00"
                      className={input}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Dia de Fechamento</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cardClosingDay}
                      onChange={e => setCardClosingDay(e.target.value)}
                      placeholder="Ex: 20"
                      className={input}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Dia de Vencimento</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cardDueDay}
                      onChange={e => setCardDueDay(e.target.value)}
                      placeholder="Ex: 5"
                      className={input}
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      onClick={handleAddCard}
                      disabled={!cardName.trim()}
                      isLoading={savingCard}
                    >
                      <Plus size={15} className="mr-1.5" /> Adicionar Cartão
                    </Button>
                  </div>
                </div>
              </div>

              {/* List */}
              {loadingCards ? (
                <div className="text-center py-10 text-neutral-400 text-sm">Carregando...</div>
              ) : cards.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-neutral-400">
                  <CreditCardIcon size={36} className="opacity-25" />
                  <p className="text-sm">Nenhum cartão cadastrado ainda.</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Seus Cartões</h3>
                    <span className="text-xs text-neutral-500">
                      Limite total: <span className="font-black text-neutral-900">{formatBRL(totalLimit)}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cards.map(card => {
                      const isDeleting = deletingCardId === card.id;
                      return (
                        <div
                          key={card.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isDeleting ? 'opacity-40 bg-red-50 border-red-100' : 'bg-neutral-50 border-neutral-100 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                                <CreditCardIcon size={16} />
                              </div>
                              <p className="text-sm font-bold text-neutral-800">{card.name}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteCard(card.id)}
                              disabled={isDeleting}
                              title="Excluir cartão"
                              className="p-1 text-neutral-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white rounded-lg p-2 border border-neutral-100">
                              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">Limite</p>
                              <p className="text-xs font-black text-neutral-900 mt-0.5">{formatBRL(card.limitAmount)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-neutral-100">
                              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">Fechamento</p>
                              <p className="text-xs font-black text-neutral-900 mt-0.5">Dia {card.closingDay}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-neutral-100">
                              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">Vencimento</p>
                              <p className="text-xs font-black text-neutral-900 mt-0.5">Dia {card.dueDay}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
