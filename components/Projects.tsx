
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Briefcase, Plus, Pencil, X, Save, CheckCircle2, PlayCircle, AlertTriangle,
  ArrowRight, LayoutGrid, Calendar, ListChecks, ChevronUp, ChevronDown,
  Trash2, Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Project, Task } from '../types.ts';
import { dataService } from '../services/dataService.ts';

interface ProjectsProps {
  userId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

// ─────────── Stage persistence (localStorage) ───────────

const STAGES_KEY = (uid: string) => `fr_board_stages_${uid}`;

const DEFAULT_STAGES = [
  'Backlog / Ideias',
  'Planejamento',
  'Em Andamento',
  'Aguardando Terceiros',
  'Concluído',
];

function loadStages(userId: string): string[] {
  try {
    const raw = localStorage.getItem(STAGES_KEY(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...DEFAULT_STAGES];
}

function persistStages(userId: string, stages: string[]) {
  localStorage.setItem(STAGES_KEY(userId), JSON.stringify(stages));
}

// ─────────── Color palette (cycles for unlimited columns) ───────────

const PALETTE = [
  { headerBg: 'bg-slate-50',   accent: 'border-slate-300',   dot: 'bg-slate-400' },
  { headerBg: 'bg-blue-50',    accent: 'border-blue-400',     dot: 'bg-blue-500' },
  { headerBg: 'bg-orange-50',  accent: 'border-orange-300',   dot: 'bg-orange-400' },
  { headerBg: 'bg-yellow-50',  accent: 'border-yellow-400',   dot: 'bg-yellow-500' },
  { headerBg: 'bg-green-50',   accent: 'border-green-400',    dot: 'bg-green-500' },
  { headerBg: 'bg-purple-50',  accent: 'border-purple-300',   dot: 'bg-purple-400' },
  { headerBg: 'bg-pink-50',    accent: 'border-pink-300',     dot: 'bg-pink-400' },
  { headerBg: 'bg-teal-50',    accent: 'border-teal-300',     dot: 'bg-teal-400' },
];

// ─────────── Progress bar color ───────────

function progressBarCls(pct: number): string {
  if (pct < 30) return 'bg-red-500';
  if (pct < 70) return 'bg-yellow-400';
  return 'bg-green-500';
}

// ─────────── Date helpers ───────────

function fmtDate(s?: string): string {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

const today = () => new Date().toISOString().split('T')[0];

// ─────────── Draft form ───────────

interface Draft {
  name: string;
  description: string;
  status: string;
  dueDate: string;
}

// ─────────── MetricCard ───────────

const MetricCard: React.FC<{
  label: string; value: string | number; icon: React.ReactNode; iconCls: string;
}> = ({ label, value, icon, iconCls }) => (
  <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4">
    <div className={`inline-flex p-1.5 rounded-lg mb-2 ${iconCls}`}>{icon}</div>
    <p className="text-[10px] font-bold uppercase text-neutral-400 leading-tight mb-0.5">{label}</p>
    <p className="text-xl font-black text-neutral-900">{value}</p>
  </div>
);

// ─────────── ProjectCard ───────────

interface ProjectCardProps {
  project: Project;
  progress: number;
  tasksDone: number;
  tasksTotal: number;
  onEdit: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project, progress, tasksDone, tasksTotal, onEdit, onDragStart,
}) => {
  const overdue = !!project.dueDate && project.dueDate < today();
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white rounded-lg border border-neutral-200 p-3 shadow-sm
                 hover:shadow-md transition-all duration-150 cursor-grab
                 active:cursor-grabbing active:opacity-60 select-none group"
    >
      {/* Title + edit btn */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-800 leading-snug flex-1">{project.name}</p>
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-neutral-300
                     hover:text-primary transition-all mt-0.5"
          title="Editar projeto"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Footer: date + task counter */}
      {(project.dueDate || tasksTotal > 0) && (
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {project.dueDate && (
            <span className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-neutral-400'}`}>
              <Calendar size={10} />
              {fmtDate(project.dueDate)}{overdue && ' · Em atraso'}
            </span>
          )}
          {tasksTotal > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-neutral-400">
              <ListChecks size={10} />
              {tasksDone}/{tasksTotal} Tarefas
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-2.5">
        <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
          <span>Progresso</span>
          <span className="font-bold text-neutral-600">{progress}%</span>
        </div>
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBarCls(progress)}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// ─────────── StagesModal ───────────

interface StagesModalProps {
  isOpen: boolean;
  initialStages: string[];
  onSave: (stages: string[]) => void;
  onClose: () => void;
}

const StagesModal: React.FC<StagesModalProps> = ({ isOpen, initialStages, onSave, onClose }) => {
  const [draft, setDraft] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft([...initialStages]);
      setNewName('');
      setTimeout(() => newInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...draft];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setDraft(next);
  };

  const moveDown = (i: number) => {
    if (i === draft.length - 1) return;
    const next = [...draft];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setDraft(next);
  };

  const rename = (i: number, value: string) => {
    const next = [...draft];
    next[i] = value;
    setDraft(next);
  };

  const remove = (i: number) => {
    if (draft.length <= 1) return;
    setDraft(draft.filter((_, idx) => idx !== i));
  };

  const addStage = () => {
    const name = newName.trim();
    if (!name) return;
    setDraft(prev => [...prev, name]);
    setNewName('');
    setTimeout(() => newInputRef.current?.focus(), 30);
  };

  const handleSave = () => {
    const valid = draft.map(s => s.trim()).filter(Boolean);
    if (valid.length === 0) return;
    onSave(valid);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
           style={{ maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-neutral-900">Gerenciar Colunas</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Adicione, renomeie, reordene ou exclua etapas</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Stage list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {draft.map((stage, i) => {
            const color = PALETTE[i % PALETTE.length];
            return (
              <div key={i} className="flex items-center gap-2">
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    className="text-neutral-300 hover:text-neutral-600 disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveDown(i)}
                    disabled={i === draft.length - 1}
                    className="text-neutral-300 hover:text-neutral-600 disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Color dot */}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />

                {/* Name input */}
                <input
                  value={stage}
                  onChange={e => rename(i, e.target.value)}
                  className="flex-1 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none
                             focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />

                {/* Delete */}
                <button
                  onClick={() => remove(i)}
                  disabled={draft.length <= 1}
                  title="Excluir etapa"
                  className="text-neutral-300 hover:text-red-400 disabled:opacity-20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          {/* Add new */}
          <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
            <span className="w-2 h-2 rounded-full bg-neutral-200 flex-shrink-0 ml-8" />
            <input
              ref={newInputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addStage(); }}
              placeholder="Nome da nova etapa..."
              className="flex-1 border border-dashed border-neutral-300 rounded-lg px-3 py-1.5 text-sm
                         outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
            <button
              onClick={addStage}
              disabled={!newName.trim()}
              className="flex items-center gap-1 text-sm text-primary font-semibold hover:bg-blue-50
                         px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              <Plus size={13} /> Adicionar
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-neutral-200 rounded-lg py-2.5 text-sm font-medium
                       text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white
                       rounded-lg py-2.5 text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            <Save size={14} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────── Main component ───────────

export const Projects: React.FC<ProjectsProps> = ({ userId, onToast }) => {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);
  const [boardStages, setBoardStages] = useState<string[]>(DEFAULT_STAGES);
  const [panelOpen, setPanelOpen]   = useState(false);
  const [stagesModal, setStagesModal] = useState(false);
  const [editing, setEditing]       = useState<Project | null>(null);
  const [draft, setDraft]           = useState<Draft>({ name: '', description: '', status: '', dueDate: '' });
  const [saving, setSaving]         = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // DnD refs
  const dragId = useRef<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Load stages from localStorage on mount
  useEffect(() => { setBoardStages(loadStages(userId)); }, [userId]);
  useEffect(() => { load(); }, [userId]);
  useEffect(() => {
    if (panelOpen) setTimeout(() => nameRef.current?.focus(), 60);
  }, [panelOpen]);

  const load = async () => {
    try {
      setLoading(true);
      const [projs, tsks] = await Promise.all([
        dataService.getProjects(userId),
        dataService.getTasks(userId),
      ]);
      setProjects(projs);
      setTasks(tsks);
    } catch (e: any) {
      onToast('Erro ao carregar projetos: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-progress per project ──
  const projectProgress = useMemo(() => {
    const map: Record<string, { pct: number; done: number; total: number }> = {};
    projects.forEach(p => {
      const pTasks = tasks.filter(t => t.projectId === p.id);
      if (pTasks.length === 0) {
        map[p.id] = { pct: p.progress, done: 0, total: 0 };
      } else {
        const done = pTasks.filter(t => t.status === 'done').length;
        map[p.id] = { pct: Math.round((done / pTasks.length) * 100), done, total: pTasks.length };
      }
    });
    return map;
  }, [projects, tasks]);

  // ── Metrics (dynamic based on stages) ──
  const metrics = useMemo(() => {
    const t = today();
    const lastStage = boardStages[boardStages.length - 1] ?? '';
    return {
      total:      projects.length,
      inProgress: projects.filter(p => boardStages.slice(0, -1).includes(p.status)).length,
      completed:  projects.filter(p => p.status === lastStage).length,
      overdue:    projects.filter(p => p.dueDate && p.dueDate < t && p.status !== lastStage).length,
    };
  }, [projects, boardStages]);

  // ── Stage options for select (include current status if orphaned) ──
  const statusOptions = useMemo(() => {
    if (editing && editing.status && !boardStages.includes(editing.status)) {
      return [editing.status, ...boardStages];
    }
    return boardStages;
  }, [boardStages, editing]);

  // ── Panel handlers ──
  const openCreate = () => {
    setEditing(null);
    setDraft({ name: '', description: '', status: boardStages[0] ?? '', dueDate: '' });
    setPanelOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setDraft({
      name:        project.name,
      description: project.description ?? '',
      status:      project.status,
      dueDate:     project.dueDate ?? '',
    });
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) { onToast('Nome obrigatório.', 'error'); return; }
    setSaving(true);
    try {
      const pct = editing ? (projectProgress[editing.id]?.pct ?? 0) : 0;
      const project: Project = {
        id:          editing?.id ?? crypto.randomUUID(),
        userId,
        createdAt:   editing?.createdAt ?? new Date().toISOString(),
        name:        draft.name.trim(),
        description: draft.description.trim() || undefined,
        status:      draft.status || boardStages[0] || '',
        progress:    pct,
        dueDate:     draft.dueDate || undefined,
      };
      await dataService.saveProject(project, userId);
      setProjects(prev =>
        editing ? prev.map(p => p.id === project.id ? project : p) : [...prev, project]
      );
      onToast(editing ? 'Projeto atualizado!' : 'Projeto criado!', 'success');
      closePanel();
    } catch (e: any) {
      onToast('Erro ao salvar projeto: ' + (e.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete project ──
  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm(`Excluir o projeto "${editing.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await dataService.deleteProject(editing.id, userId);
      setProjects(prev => prev.filter(p => p.id !== editing.id));
      onToast('Projeto excluído.', 'success');
      closePanel();
    } catch (e: any) {
      onToast('Erro ao excluir projeto: ' + (e.message || ''), 'error');
    }
  };

  // ── Stages modal save ──
  const handleSaveStages = (stages: string[]) => {
    setBoardStages(stages);
    persistStages(userId, stages);
    setStagesModal(false);
    onToast('Colunas atualizadas!', 'success');
  };

  // ── Drag and Drop ──
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    dragId.current = projectId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not entering a child)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const id = dragId.current;
    if (!id) return;
    dragId.current = null;

    const project = projects.find(p => p.id === id);
    if (!project || project.status === stage) return;

    const updated = { ...project, status: stage };
    setProjects(prev => prev.map(p => p.id === id ? updated : p));

    try {
      await dataService.saveProject(updated, userId);
    } catch (e: any) {
      onToast('Erro ao mover projeto.', 'error');
      setProjects(prev => prev.map(p => p.id === id ? project : p));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6 pb-10">

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total"         value={metrics.total}      icon={<Briefcase size={15}/>}      iconCls="text-primary bg-blue-50" />
        <MetricCard label="Em Andamento"  value={metrics.inProgress} icon={<PlayCircle size={15}/>}     iconCls="text-blue-500 bg-blue-50" />
        <MetricCard label="Concluídos"    value={metrics.completed}  icon={<CheckCircle2 size={15}/>}   iconCls="text-green-600 bg-green-50" />
        <MetricCard label="Em Atraso"     value={metrics.overdue}    icon={<AlertTriangle size={15}/>}  iconCls="text-red-500 bg-red-50" />
      </div>

      {/* ── Board header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-neutral-500">
          <LayoutGrid size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">Kanban Board</span>
          <span className="text-xs text-neutral-300">· {boardStages.length} colunas</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStagesModal(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 border border-neutral-200
                       hover:bg-neutral-50 px-3 py-2 rounded-lg transition-colors"
          >
            <Settings2 size={14} /> Gerenciar Colunas
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary
                       hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Novo Projeto
          </button>
        </div>
      </div>

      {/* ── Kanban board ── */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '460px' }}>
        {boardStages.map((stage, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          // Orphaned projects (status not in any stage) fall back to the first column
          const orphans = idx === 0
            ? projects.filter(p => !boardStages.includes(p.status))
            : [];
          const colProjects = [...projects.filter(p => p.status === stage), ...orphans];
          const isOver = dragOverStage === stage;
          return (
            <div
              key={stage}
              className="flex-shrink-0 w-72 flex flex-col"
              onDragOver={e => handleDragOver(e, stage)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, stage)}
            >
              {/* Column header */}
              <div className={`flex items-center gap-2 px-3 py-2.5 ${color.headerBg} rounded-t-xl
                              border border-b-2 ${color.accent} border-neutral-200`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                <span className="text-xs font-bold uppercase text-neutral-600 tracking-wide flex-1 truncate">
                  {stage}
                </span>
                <span className="text-xs font-bold text-neutral-500 bg-white/70 rounded-full px-2 py-0.5 flex-shrink-0">
                  {colProjects.length}
                </span>
              </div>

              {/* Column body */}
              <div
                className={`flex-1 rounded-b-xl border border-neutral-200 border-t-0 p-2 space-y-2
                            overflow-y-auto transition-colors duration-150
                            ${isOver ? 'bg-blue-50/70 border-blue-300' : 'bg-neutral-50/50'}`}
              >
                {colProjects.length === 0 && !isOver && (
                  <div className="flex items-center justify-center h-16 text-xs text-neutral-300 font-medium
                                  border-2 border-dashed border-neutral-200 rounded-lg">
                    Arraste aqui
                  </div>
                )}
                {isOver && colProjects.length === 0 && (
                  <div className="h-16 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50" />
                )}
                {colProjects.map(project => {
                  const info = projectProgress[project.id] ?? { pct: project.progress, done: 0, total: 0 };
                  return (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      progress={info.pct}
                      tasksDone={info.done}
                      tasksTotal={info.total}
                      onEdit={() => openEdit(project)}
                      onDragStart={e => handleDragStart(e, project.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Stages modal ── */}
      <StagesModal
        isOpen={stagesModal}
        initialStages={boardStages}
        onSave={handleSaveStages}
        onClose={() => setStagesModal(false)}
      />

      {/* ── Side panel overlay ── */}
      {panelOpen && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={closePanel} />
      )}

      {/* ── Side panel ── */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-neutral-900">{editing ? 'Editar Projeto' : 'Novo Projeto'}</h2>
          <button onClick={closePanel} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1.5">Nome *</label>
            <input
              ref={nameRef}
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Escape') closePanel(); }}
              placeholder="Nome do projeto"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none
                         focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1.5">Descrição</label>
            <textarea
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Objetivo ou contexto do projeto..."
              rows={3}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none
                         focus:ring-2 focus:ring-primary/30 focus:border-primary transition resize-none"
            />
          </div>

          {/* Status (dynamic stages) */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1.5">Etapa</label>
            <select
              value={draft.status}
              onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none
                         focus:ring-2 focus:ring-primary/30 focus:border-primary transition bg-white"
            >
              {statusOptions.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1.5">Data de Entrega</label>
            <input
              type="date"
              value={draft.dueDate}
              onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none
                         focus:ring-2 focus:ring-primary/30 focus:border-primary transition bg-white"
            />
          </div>

          {/* Progress (read-only, auto-calculated) */}
          {editing && (
            <div className="bg-neutral-50 rounded-lg px-4 py-3 border border-neutral-200">
              <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5">
                Progresso · calculado pelas tarefas
              </p>
              {(() => {
                const info = projectProgress[editing.id];
                const pct = info?.pct ?? 0;
                return (
                  <>
                    <p className="text-sm font-black text-neutral-800 mb-2">
                      {pct}%
                      {info && info.total > 0 && (
                        <span className="text-xs font-normal text-neutral-400 ml-2">
                          ({info.done}/{info.total} tarefas)
                        </span>
                      )}
                    </p>
                    <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${progressBarCls(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Link to Tasks */}
          <div className="pt-2 border-t border-neutral-100">
            <Link
              to="/tasks"
              onClick={closePanel}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
            >
              <ArrowRight size={15} /> Ir para Tarefas
            </Link>
          </div>

          {/* Delete zone (edit mode only) */}
          {editing && (
            <div className="pt-2 border-t border-red-100">
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                <Trash2 size={14} /> Excluir Projeto
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3">
          <button
            onClick={closePanel}
            className="flex-1 border border-neutral-200 rounded-lg py-2.5 text-sm font-medium
                       text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white
                       rounded-lg py-2.5 text-sm font-bold hover:bg-blue-700
                       disabled:opacity-50 transition-colors"
          >
            <Save size={14} />{saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};
