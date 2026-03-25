
import { GoogleGenAI } from "@google/genai";
import type { AIModuleConfig } from './types.ts';

/**
 * Único ponto de configuração do cliente Gemini para o módulo services/ai/.
 * Nenhum outro arquivo dentro deste módulo deve instanciar GoogleGenAI diretamente.
 *
 * Layer 1 (default/dev): VITE_GEMINI_API_KEY — chave no bundle compilado (apenas desenvolvimento)
 * Layer 2 (produção):    VITE_USE_EDGE_FUNCTION=true — chave no servidor Supabase (seguro)
 */
export const apiKey: string = import.meta.env.VITE_GEMINI_API_KEY as string || '';
export const useEdgeFunction: boolean = import.meta.env.VITE_USE_EDGE_FUNCTION === 'true';

export const ai = new GoogleGenAI({ apiKey });

export const aiConfig: AIModuleConfig = {
  apiKey,
  useEdgeFunction,
  model: 'gemini-2.5-flash-preview-05-20',
};
