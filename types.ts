
export type ViewState = 'dashboard' | 'upload' | 'review' | 'reconcile' | 'reports' | 'settings' | 'manual_entry';

export enum MatchStatus {
  UNMATCHED = 'UNMATCHED',
  SUGGESTED = 'SUGGESTED',
  MATCHED = 'MATCHED',
  IGNORED = 'IGNORED'
}

export type CardIssuer = 'Inter' | 'Santander' | 'Bradesco' | 'BRB' | 'Porto Bank' | 'Itaú' | 'Outros';

export interface Transaction {
  id: string;
  date: string;
  purchaseDate: string;
  description: string;
  amount: number;
  category: string;
  subcategory?: string;
  tags?: string[];
  invoiceId: string;
  status: MatchStatus;
  cardIssuer?: CardIssuer;
  confidence?: number;
  matchedTransactionId?: string;
  notes?: string;
}

export interface SystemTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
}

export interface InvoiceFile {
  id: string;
  name: string;
  size: number;
  uploadDate: Date;
  status: 'pending' | 'processing' | 'parsed' | 'error';
  transactionCount?: number;
  cardIssuer?: CardIssuer;
}

export interface Category {
  id: string;
  name: string;
  subcategories: string[];
  color?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface AppUser {
  id: string;
  email: string;
  role: 'master' | 'user';
  createdAt: string;
}

export const MASTER_EMAIL = 'franklin.alves.carvalho@gmail.com';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: keyof Transaction | 'amount';
  direction: SortDirection;
}