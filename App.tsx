
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings as SettingsIcon, PieChart, LogOut, Upload as UploadIcon, PlusSquare, CreditCard, List, Wallet as WalletIcon, CheckSquare, Target, Briefcase } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { Upload } from './components/Upload.tsx';
import { Review } from './components/Review.tsx';
import { Reconciliation } from './components/Reconciliation.tsx';
import { Settings } from './components/Settings.tsx';
import { ManualEntry } from './components/ManualEntry.tsx';
import { Reports } from './components/Reports.tsx';
import { Invoices } from './components/Invoices.tsx';
import { Transactions } from './components/Transactions.tsx';
import { Wallet } from './components/Wallet.tsx';
import { Tasks } from './components/Tasks.tsx';
import { Habits } from './components/Habits.tsx';
import { Projects } from './components/Projects.tsx';
import { Auth } from './components/Auth.tsx';
import { dataService, parseBRLAmount } from './services/dataService.ts';
import { categorizeTransactions, extractInvoiceData, type CategorySuggestion } from './services/ai/index.ts';
import { Transaction, InvoiceFile, Category, Tag, CardIssuer, MatchStatus, SystemTransaction, Account, CreditCard as CreditCardType, Task } from './types.ts';
import { INITIAL_CATEGORIES, DEFAULT_TAGS } from './constants/initialData.ts';
import { Toast, ToastMessage } from './components/ui/Toast.tsx';

const AppContent: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [files, setFiles] = useState<InvoiceFile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allHistoryTransactions, setAllHistoryTransactions] = useState<Transaction[]>([]);
  const [systemTransactions, setSystemTransactions] = useState<SystemTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileEntry, setCurrentFileEntry] = useState<InvoiceFile | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [txs, invoices, settings, accs, cards] = await Promise.all([
        dataService.getTransactions(user.id),
        dataService.getInvoices(user.id),
        dataService.getUserSettings(user.id),
        dataService.getAccounts(user.id),
        dataService.getCreditCards(user.id),
      ]);

      if (txs) setAllHistoryTransactions(txs);
      if (invoices) setFiles(invoices);
      setAccounts(accs);
      setCreditCards(cards);
      
      if (settings) {
        if (Array.isArray(settings.categories) && settings.categories.length > 0) {
           setCategories(settings.categories);
        }
        if (Array.isArray(settings.tags) && settings.tags.length > 0) {
           setTags(settings.tags);
        }
      }

      setSystemTransactions([
        { id: 'sys1', date: '2025-12-02', description: 'CesaCentroDeVI 01/03', amount: 528.34, account: 'Itaú Personalité' },
        { id: 'sys2', date: '2025-08-28', description: 'DECOLAR COM LTDA', amount: 3070.18, account: 'BRB Visa Platinum' }
      ]);
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    }
  };

  const handleUpdateCategories = async (newCategories: Category[]) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await dataService.updateUserSettings(user.id, { categories: newCategories });
      setCategories(newCategories);
    } catch (error: any) {
      alert("Erro ao salvar categorias: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateTags = async (newTags: Tag[]) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await dataService.updateUserSettings(user.id, { tags: newTags });
      setTags(newTags);
    } catch (error: any) {
      alert("Erro ao salvar tags.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadComplete = async (uploadedFiles: File[], issuer: CardIssuer) => {
    const today = new Date().toISOString().split('T')[0];
    const invoiceId = `inv-${Date.now()}`;
    
    const newFileEntry: InvoiceFile = {
      id: invoiceId,
      name: uploadedFiles[0].name,
      size: uploadedFiles[0].size,
      uploadDate: new Date(),
      status: 'processing',
      cardIssuer: issuer
    };
    
    setCurrentFileEntry(newFileEntry);
    setIsProcessing(true);
    navigate('/review');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(uploadedFiles[0]);
      });
      const base64 = await base64Promise;
      const extractedData = await extractInvoiceData(base64, issuer);
      const aiSuggestions = await categorizeTransactions(
        extractedData.map(d => d.description),
        categories.map(c => c.name)
      );

      // Detecta se o hard fallback disparou (todos os providers de IA falharam)
      const allFallback = aiSuggestions.length > 0 &&
        aiSuggestions.every(s => s.suggestedCategory === 'Outros' && s.confidence === 0);
      if (allFallback) {
        setToast({
          message: 'Categorização automática falhou — provedores de IA indisponíveis. As despesas foram salvas como "Outros". Verifique suas chaves de API e use "Re-categorizar" na tela de revisão.',
          type: 'error',
        });
      }

      const newTransactions: Transaction[] = extractedData.map((item, i) => {
        const suggestion = aiSuggestions[i]; // index-match garante alinhamento correto
        const resolvedCategory = suggestion?.suggestedCategory || 'Outros';
        const matchedCategory = categories.find(c => c.name === resolvedCategory);
        const aiSub = suggestion?.suggestedSubcategory?.trim();

        // Match case-insensitive (ignoring spaces) against official subcategories.
        // If found → use the official casing. If not found → save AI suggestion verbatim
        // to preserve the information instead of losing it as undefined.
        let resolvedSubcategory: string | undefined;
        if (aiSub) {
          const normalizedAiSub = aiSub.toLowerCase().replace(/\s+/g, '');
          const officialMatch = matchedCategory?.subcategories.find(
            s => s.toLowerCase().replace(/\s+/g, '') === normalizedAiSub
          );
          resolvedSubcategory = officialMatch ?? aiSub;
        }

        return {
          id: `t-${Date.now()}-${i}`,
          date: item.purchaseDate,
          purchaseDate: item.purchaseDate,
          description: item.description,
          amount: parseBRLAmount(item.amount),
          category: resolvedCategory,
          subcategory: resolvedSubcategory,
          confidence: suggestion?.confidence,
          invoiceId: invoiceId,
          cardIssuer: issuer,
          status: MatchStatus.UNMATCHED,
          tags: ['Despesas Pessoais']
        };
      });

      setTransactions(newTransactions);
      setCurrentFileEntry({ ...newFileEntry, status: 'parsed', transactionCount: newTransactions.length });
    } catch (error: any) {
      console.error("Erro na extração:", error);
      const detail = error?.message || String(error);
      setToast({ message: `Falha ao extrair fatura: ${detail}`, type: 'error' });
      navigate('/upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await dataService.deleteInvoice(invoiceId, user.id);
      await loadData();
      setToast({ message: 'Fatura e transações excluídas com sucesso.', type: 'success' });
    } catch (e: any) {
      setToast({ message: 'Erro ao excluir fatura: ' + (e.message || 'verifique sua conexão.'), type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateTransaction = async (transaction: Transaction) => {
    if (!user) return;
    try {
      await dataService.updateTransaction(transaction, user.id);
      setAllHistoryTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
      setToast({ message: 'Lançamento atualizado com sucesso.', type: 'success' });
    } catch (e: any) {
      setToast({ message: 'Erro ao atualizar: ' + (e.message || 'verifique sua conexão.'), type: 'error' });
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;
    try {
      await dataService.deleteTransaction(transactionId, user.id);
      setAllHistoryTransactions(prev => prev.filter(t => t.id !== transactionId));
      setToast({ message: 'Lançamento excluído com sucesso.', type: 'success' });
    } catch (e: any) {
      setToast({ message: 'Erro ao excluir: ' + (e.message || 'verifique sua conexão.'), type: 'error' });
    }
  };

  const handleReviewInvoice = (invoiceTransactions: Transaction[]) => {
    setCurrentFileEntry(null);
    setTransactions(invoiceTransactions);
    navigate('/review');
  };

  /** Resolve categoria e subcategoria a partir de uma sugestão da IA. */
  const resolveCategory = (suggestion: CategorySuggestion | undefined) => {
    const resolvedCategory = suggestion?.suggestedCategory || 'Outros';
    const matchedCategory = categories.find(c => c.name === resolvedCategory);
    const aiSub = suggestion?.suggestedSubcategory?.trim();
    let resolvedSubcategory: string | undefined;
    if (aiSub) {
      const normalizedAiSub = aiSub.toLowerCase().replace(/\s+/g, '');
      const officialMatch = matchedCategory?.subcategories.find(
        s => s.toLowerCase().replace(/\s+/g, '') === normalizedAiSub
      );
      resolvedSubcategory = officialMatch ?? aiSub;
    }
    return { category: resolvedCategory, subcategory: resolvedSubcategory, confidence: suggestion?.confidence };
  };

  const handleRecategorize = async () => {
    if (transactions.length === 0) return;
    setIsProcessing(true);
    try {
      const aiSuggestions = await categorizeTransactions(
        transactions.map(t => t.description),
        categories.map(c => c.name)
      );
      const allFallback = aiSuggestions.length > 0 &&
        aiSuggestions.every(s => s.suggestedCategory === 'Outros' && s.confidence === 0);

      setTransactions(prev => prev.map((t, i) => ({
        ...t,
        ...resolveCategory(aiSuggestions[i]),
      })));

      setToast(allFallback
        ? { message: 'Re-categorização falhou — provedores de IA indisponíveis. Verifique suas chaves de API.', type: 'error' }
        : { message: 'Transações re-categorizadas com sucesso pela IA!', type: 'success' }
      );
    } catch (e: any) {
      setToast({ message: 'Erro ao re-categorizar: ' + (e.message || 'tente novamente.'), type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFinalizeExtraction = async () => {
    if (!user || transactions.length === 0) return;

    setIsProcessing(true);
    try {
      if (currentFileEntry) {
        // Fluxo normal: nova fatura — salva cabeçalho + transações novas
        const finalizedTransactions = transactions.map(t => ({
          ...t,
          status: MatchStatus.MATCHED
        }));
        await dataService.saveInvoice({
          ...currentFileEntry,
          transactionCount: finalizedTransactions.length
        }, user.id);
        await dataService.saveTransactions(finalizedTransactions, user.id);
        setToast({
          message: `${finalizedTransactions.length} lançamento${finalizedTransactions.length !== 1 ? 's' : ''} salvo${finalizedTransactions.length !== 1 ? 's' : ''} com sucesso!`,
          type: 'success'
        });
        navigate('/');
      } else {
        // Re-revisão de fatura existente — atualiza cada transação pelo ID
        await Promise.all(transactions.map(t => dataService.updateTransaction(t, user.id)));
        setToast({
          message: `${transactions.length} lançamento${transactions.length !== 1 ? 's' : ''} atualizado${transactions.length !== 1 ? 's' : ''} com sucesso!`,
          type: 'success'
        });
        navigate('/invoices');
      }

      await loadData();
      setTransactions([]);
      setCurrentFileEntry(null);
    } catch (e: any) {
      console.error("Erro ao finalizar extração:", e);
      setToast({
        message: 'Erro ao salvar lançamentos: ' + (e.message || 'verifique sua conexão e tente novamente.'),
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-white font-bold text-primary">Carregando FinReconcile...</div>;
  if (!user) return <Auth />;

  return (
    <>
    <div className="flex h-screen bg-[#F6F7FB] overflow-hidden">
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">F</div>
          <span className="text-xl font-bold">FinReconcile</span>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <SidebarItem to="/" icon={<LayoutDashboard size={20}/>} label="Dashboard" active={location.pathname === '/'} />
          <SidebarItem to="/tasks" icon={<CheckSquare size={20}/>} label="Tarefas" active={location.pathname === '/tasks'} />
          <SidebarItem to="/habits" icon={<Target size={20}/>} label="Hábitos" active={location.pathname === '/habits'} />
          <SidebarItem to="/projects" icon={<Briefcase size={20}/>} label="Projetos" active={location.pathname === '/projects'} />
          <SidebarItem to="/upload" icon={<UploadIcon size={20}/>} label="Importar" active={location.pathname === '/upload'} />
          <SidebarItem to="/invoices" icon={<FileText size={20}/>} label="Faturas" active={location.pathname === '/invoices'} />
          <SidebarItem to="/manual" icon={<PlusSquare size={20}/>} label="Manual" active={location.pathname === '/manual'} />
          <SidebarItem to="/transactions" icon={<List size={20}/>} label="Transações" active={location.pathname === '/transactions'} />
          <SidebarItem to="/wallet" icon={<WalletIcon size={20}/>} label="Carteira" active={location.pathname === '/wallet'} />
          <SidebarItem to="/reports" icon={<PieChart size={20}/>} label="Relatórios" active={location.pathname === '/reports'} />
        </nav>
        <div className="p-4 border-t">
          <SidebarItem to="/settings" icon={<SettingsIcon size={20}/>} label="Ajustes" active={location.pathname === '/settings'} />
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-500 hover:text-red-500 mt-2">
            <LogOut size={20}/> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between">
            <h1 className="text-lg font-semibold uppercase">{location.pathname.replace('/', '') || 'DASHBOARD'}</h1>
            <div className="text-right">
                <p className="text-xs font-bold text-neutral-900">{user.email}</p>
            </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 relative">
           {isProcessing && (
             <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="font-bold">Sincronizando Dados...</h3>
                <p className="text-xs text-neutral-500 mt-2">Garantindo que suas informações fiquem seguras no banco.</p>
             </div>
           )}
           <Routes>
             <Route path="/" element={<Dashboard files={files} allTransactions={[...allHistoryTransactions, ...transactions]} onNavigate={navigate} />} />
             <Route path="/upload" element={<Upload onUploadComplete={handleUploadComplete} onCancel={() => navigate('/')} />} />
             <Route path="/invoices" element={<Invoices files={files} allTransactions={allHistoryTransactions} onDelete={handleDeleteInvoice} onNavigateToUpload={() => navigate('/upload')} onReviewInvoice={handleReviewInvoice} />} />
             <Route path="/manual" element={<ManualEntry categories={categories} tags={tags} accounts={accounts} creditCards={creditCards} onUpdateCategories={handleUpdateCategories} onAddTransaction={async (t) => {
               setIsProcessing(true);
               try {
                 await dataService.saveTransactions([t], user.id);
                 await loadData();
                 setToast({ message: 'Lançamento salvo com sucesso!', type: 'success' });
               } catch (e: any) {
                 setToast({ message: 'Erro ao salvar: ' + (e.message || 'verifique sua conexão.'), type: 'error' });
                 throw e;
               } finally {
                 setIsProcessing(false);
               }
             }} onCancel={() => navigate('/')} />} />
             <Route path="/transactions" element={<Transactions transactions={allHistoryTransactions} categories={categories} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={handleUpdateTransaction} onNavigateToUpload={() => navigate('/upload')} />} />
             <Route path="/review" element={<Review
                transactions={transactions}
                categories={categories}
                tags={tags}
                onConfirm={handleAutoFinalizeExtraction}
                onUpdateTransaction={(id, up) => setTransactions(p => p.map(t => t.id === id ? {...t, ...up} : t))}
                onDeleteTransaction={(id) => setTransactions(p => p.filter(t => t.id !== id))}
                onUpdateCategories={handleUpdateCategories}
                onRecategorize={handleRecategorize}
                isProcessing={isProcessing}
              />} />
             <Route path="/reconcile" element={<Reconciliation transactions={transactions} systemTransactions={systemTransactions} onComplete={async () => {
               setIsProcessing(true);
               const matched = transactions.filter(t => t.status === MatchStatus.MATCHED);
               try {
                 if (currentFileEntry) {
                    await dataService.saveInvoice(currentFileEntry, user.id);
                    if (matched.length > 0) {
                      await dataService.saveTransactions(matched, user.id);
                    }
                    await loadData();
                    setTransactions([]);
                    setCurrentFileEntry(null);
                    navigate('/');
                 }
               } catch (e: any) {
                 console.error("Erro na conciliação:", e);
                 alert("Falha ao salvar: " + (e.message || "Erro de conexão."));
               } finally {
                 setIsProcessing(false);
               }
             }} onCreateSystemMatch={(id) => setTransactions(p => p.map(t => t.id === id ? {...t, status: MatchStatus.MATCHED} : t))} />} />
             <Route path="/projects" element={<Projects userId={user.id} onToast={(msg, type) => setToast({ message: msg, type })} />} />
             <Route path="/tasks" element={<Tasks userId={user.id} onToast={(msg, type) => setToast({ message: msg, type })} />} />
             <Route path="/habits" element={<Habits userId={user.id} onToast={(msg, type) => setToast({ message: msg, type })} />} />
             <Route path="/wallet" element={<Wallet userId={user.id} onToast={(msg, type) => setToast({ message: msg, type })} />} />
             <Route path="/reports" element={<Reports allTransactions={allHistoryTransactions} categories={categories} tags={tags} files={files} />} />
             <Route path="/settings" element={<Settings currentUserEmail={user.email} categories={categories} tags={tags} onUpdateCategories={handleUpdateCategories} onUpdateTags={handleUpdateTags} />} />
           </Routes>
        </div>
      </main>
    </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
};

const SidebarItem = ({ to, icon, label, active }: any) => (
  <Link to={to} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-blue-50 text-primary' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}>
    {icon} {label}
  </Link>
);

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
