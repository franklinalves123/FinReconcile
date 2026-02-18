
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings as SettingsIcon, PieChart, LogOut, Upload as UploadIcon, PlusSquare, CreditCard } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { Upload } from './components/Upload.tsx';
import { Review } from './components/Review.tsx';
import { Reconciliation } from './components/Reconciliation.tsx';
import { Settings } from './components/Settings.tsx';
import { ManualEntry } from './components/ManualEntry.tsx';
import { Reports } from './components/Reports.tsx';
import { Invoices } from './components/Invoices.tsx';
import { Auth } from './components/Auth.tsx';
import { dataService } from './services/dataService.ts';
import { categorizeTransactions, extractInvoiceData } from './services/geminiService.ts';
import { Transaction, InvoiceFile, Category, Tag, CardIssuer, MatchStatus, SystemTransaction } from './types.ts';

const INITIAL_CATEGORIES: Category[] = [
    { id: 'c1', name: 'Alimentação', subcategories: ['Restaurante', 'Mercado'], color: '#EF4444' },
    { id: 'c2', name: 'Transporte', subcategories: ['Uber/99', 'Combustível'], color: '#F59E0B' },
    { id: 'c3', name: 'Compras', subcategories: ['Roupas', 'Eletrônicos'], color: '#3B82F6' },
    { id: 'c4', name: 'Saúde', subcategories: ['Médico', 'Farmácia'], color: '#10B981' },
    { id: 'c5', name: 'Educação', subcategories: ['Cursos', 'Livros'], color: '#8B5CF6' },
    { id: 'c6', name: 'Viagem', subcategories: ['Hospedagem', 'Passagem'], color: '#EC4899' },
    { id: 'c7', name: 'Serviços', subcategories: ['Assinaturas', 'Manutenção'], color: '#6366F1' },
    { id: 'c8', name: 'Outros', subcategories: [], color: '#9CA3AF' },
];

const DEFAULT_TAGS: Tag[] = [
  { id: 'tag-pessoal', name: 'Despesas Pessoais', color: 'bg-blue-100 text-blue-700' },
  { id: 'tag-empresa', name: 'Empresa', color: 'bg-purple-100 text-purple-700' },
];

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileEntry, setCurrentFileEntry] = useState<InvoiceFile | null>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [txs, invoices, settings] = await Promise.all([
        dataService.getTransactions(user.id),
        dataService.getInvoices(user.id),
        dataService.getUserSettings(user.id)
      ]);

      if (txs) setAllHistoryTransactions(txs);
      if (invoices) setFiles(invoices);
      
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
      const aiCategories = await categorizeTransactions(extractedData.map(d => d.description));

      const newTransactions: Transaction[] = extractedData.map((item, i) => ({
        id: `t-${Date.now()}-${i}`,
        date: item.purchaseDate,
        purchaseDate: item.purchaseDate,
        description: item.description,
        amount: item.amount,
        category: aiCategories[item.description] || 'Outros',
        invoiceId: invoiceId,
        cardIssuer: issuer,
        status: MatchStatus.UNMATCHED,
        tags: ['Despesas Pessoais']
      }));

      setTransactions(newTransactions);
      setCurrentFileEntry({ ...newFileEntry, status: 'parsed', transactionCount: newTransactions.length });
    } catch (error) {
      console.error("Erro Gemini:", error);
      alert("Erro ao processar arquivo. Verifique se é um PDF de fatura válido.");
      navigate('/upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!user) return;
    if (!confirm("Apagar esta fatura permanentemente?")) return;
    
    try {
      setIsProcessing(true);
      await dataService.deleteInvoice(invoiceId, user.id);
      await loadData();
    } catch (e) {
      alert("Erro ao excluir.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFinalizeExtraction = async () => {
    if (!user || !currentFileEntry || transactions.length === 0) return;
    
    setIsProcessing(true);
    try {
      // Marcar todas como conciliadas automaticamente
      const finalizedTransactions = transactions.map(t => ({
        ...t,
        status: MatchStatus.MATCHED
      }));

      // Salvar a fatura
      await dataService.saveInvoice({
        ...currentFileEntry,
        transactionCount: finalizedTransactions.length
      }, user.id);

      // Salvar todas as transações de uma vez
      await dataService.saveTransactions(finalizedTransactions, user.id);
      
      // Recarregar histórico e limpar estados temporários
      await loadData();
      setTransactions([]);
      setCurrentFileEntry(null);
      
      // Voltar para o Dashboard
      navigate('/');
    } catch (e: any) {
      console.error("Erro ao finalizar automaticamente:", e);
      alert("Erro ao salvar os lançamentos: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-white font-bold text-primary">Carregando FinReconcile...</div>;
  if (!user) return <Auth />;

  return (
    <div className="flex h-screen bg-[#F6F7FB] overflow-hidden">
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">F</div>
          <span className="text-xl font-bold">FinReconcile</span>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <SidebarItem to="/" icon={<LayoutDashboard size={20}/>} label="Dashboard" active={location.pathname === '/'} />
          <SidebarItem to="/upload" icon={<UploadIcon size={20}/>} label="Importar" active={location.pathname === '/upload'} />
          <SidebarItem to="/invoices" icon={<FileText size={20}/>} label="Faturas" active={location.pathname === '/invoices'} />
          <SidebarItem to="/manual" icon={<PlusSquare size={20}/>} label="Manual" active={location.pathname === '/manual'} />
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
             <Route path="/invoices" element={<Invoices files={files} onDelete={handleDeleteInvoice} />} />
             <Route path="/manual" element={<ManualEntry categories={categories} tags={tags} onAddTransaction={async (t) => {
               setIsProcessing(true);
               try {
                 await dataService.saveTransactions([t], user.id);
                 await loadData();
                 navigate('/');
               } catch (e: any) {
                 alert("Erro: " + e.message);
               } finally {
                 setIsProcessing(false);
               }
             }} onCancel={() => navigate('/')} />} />
             <Route path="/review" element={<Review 
                transactions={transactions} 
                categories={categories} 
                tags={tags} 
                onConfirm={handleAutoFinalizeExtraction} 
                onUpdateTransaction={(id, up) => setTransactions(p => p.map(t => t.id === id ? {...t, ...up} : t))} 
                onDeleteTransaction={(id) => setTransactions(p => p.filter(t => t.id !== id))}
                onUpdateCategories={handleUpdateCategories}
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
             <Route path="/reports" element={<Reports allTransactions={allHistoryTransactions} categories={categories} tags={tags} files={files} />} />
             <Route path="/settings" element={<Settings currentUserEmail={user.email} categories={categories} tags={tags} onUpdateCategories={handleUpdateCategories} onUpdateTags={handleUpdateTags} />} />
           </Routes>
        </div>
      </main>
    </div>
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
