import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, CreditCard } from 'lucide-react';
import { CardIssuer } from '../types.ts';
import { Button } from './ui/Button.tsx';

interface UploadProps {
  onUploadComplete: (files: File[], issuer: CardIssuer) => void;
  onCancel: () => void;
}

const ISSUERS: CardIssuer[] = ['Inter', 'Santander', 'Bradesco', 'BRB', 'Porto Bank', 'Itaú', 'Outros'];

export const Upload: React.FC<UploadProps> = ({ onUploadComplete, onCancel }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedIssuer, setSelectedIssuer] = useState<CardIssuer>('Inter');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // Fix: Cast the array from FileList to File[] to allow property access like 'type'
        const newFiles = (Array.from(e.dataTransfer.files) as File[]).filter((f) => f.type === 'application/pdf');
        setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        // Fix: Cast the array from FileList to File[] to allow property access like 'type'
        const newFiles = (Array.from(e.target.files) as File[]).filter((f) => f.type === 'application/pdf');
        setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl mx-auto mt-8 animate-fade-in">
      <h2 className="text-2xl font-bold text-neutral-900 mb-2">Importar Fatura</h2>
      <p className="text-neutral-500 mb-8">Selecione o emissor e faça o upload da fatura em PDF.</p>

      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm mb-6">
        <label className="block text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
            <CreditCard size={18} className="text-primary"/> Selecione o Banco/Cartão
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ISSUERS.map(issuer => (
                <button
                    key={issuer}
                    onClick={() => setSelectedIssuer(issuer)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        selectedIssuer === issuer 
                        ? 'bg-primary border-primary text-white shadow-md' 
                        : 'bg-white border-neutral-200 text-neutral-600 hover:border-primary hover:text-primary'
                    }`}
                >
                    {issuer}
                </button>
            ))}
        </div>
      </div>

      <div 
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer 
            ${isDragging ? 'border-primary bg-blue-50 scale-[1.02]' : 'border-neutral-300 hover:border-primary hover:bg-neutral-50'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <UploadCloud size={32} />
        </div>
        <h3 className="text-lg font-semibold text-neutral-800">Clique ou arraste o PDF aqui</h3>
        <p className="text-neutral-500 text-sm mt-2">Fatura {selectedIssuer} em PDF (max 10MB)</p>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept=".pdf"
            onChange={handleFileSelect}
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-8 space-y-3">
            <h4 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider">Fila ({selectedFiles.length})</h4>
            {selectedFiles.map((file, idx) => (
                <div key={idx} className="bg-white border border-neutral-200 rounded-lg p-3 flex items-center justify-between shadow-sm animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-50 text-red-500 rounded flex items-center justify-center">
                            <FileText size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-neutral-800">{file.name}</p>
                            <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => removeFile(idx)}
                        className="text-neutral-400 hover:text-red-500 p-2"
                    >
                        <X size={18} />
                    </button>
                </div>
            ))}

            <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button onClick={() => onUploadComplete(selectedFiles, selectedIssuer)}>
                    Processar Fatura {selectedIssuer}
                </Button>
            </div>
        </div>
      )}
    </div>
  );
};