
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Target, Plus, Trash2, Flame, TrendingUp, CheckCircle2, Check } from 'lucide-react';
import { Habit, HabitLog } from '../types.ts';
import { dataService } from '../services/dataService.ts';

interface HabitsProps {
  userId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

// ─────────── GMT-3 safe helpers ───────────

const todayGMT3 = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const DOW_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Returns the last 7 days as YYYY-MM-DD strings (oldest → today) */
function getLast7Days(today: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function dayLabel(dateStr: string, today: string) {
  if (dateStr === today) return { dow: 'Hoje', day: '', isToday: true };
  const d = new Date(dateStr + 'T12:00:00');
  return { dow: DOW_PT[d.getDay()], day: String(d.getDate()), isToday: false };
}

// ─────────── streak helpers ───────────

function calcHabitStreak(habitId: string, logs: HabitLog[], today: string): number {
  let streak = 0;
  const cursor = new Date(today + 'T12:00:00');
  for (let i = 0; i < 365; i++) {
    const ds = cursor.toISOString().split('T')[0];
    if (!logs.some(l => l.habitId === habitId && l.date === ds && l.completed)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getDayStatus(day: string, habits: Habit[], logs: HabitLog[]): 'all' | 'none' {
  if (habits.length === 0) return 'none';
  const done = new Set(logs.filter(l => l.date === day && l.completed).map(l => l.habitId));
  return habits.every(h => done.has(h.id)) ? 'all' : 'none';
}

// ─────────── main component ───────────

export const Habits: React.FC<HabitsProps> = ({ userId, onToast }) => {
  const today = todayGMT3();
  const [tyear, tmonth] = today.split('-').map(Number);

  const [habits, setHabits]   = useState<Habit[]>([]);
  const [logs, setLogs]       = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [addText, setAddText]       = useState('');
  const [addFocused, setAddFocused] = useState(false);
  const [addSaving, setAddSaving]   = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  const week = useMemo(() => getLast7Days(today), [today]);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    try {
      setLoading(true);
      const [h, l] = await Promise.all([
        dataService.getHabits(userId),
        dataService.getHabitLogs(userId),
      ]);
      setHabits(h);
      setLogs(l);
    } catch (e: any) {
      onToast('Erro ao carregar hábitos: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Metrics ──
  const metrics = useMemo(() => {
    const doneSet = new Set(logs.filter(l => l.date === today && l.completed).map(l => l.habitId));
    const doneToday = habits.filter(h => doneSet.has(h.id)).length;

    // Overall streak: consecutive days backwards where ALL habits done
    let allStreak = 0;
    if (habits.length > 0) {
      const cursor = new Date(today + 'T12:00:00');
      for (let i = 0; i < 365; i++) {
        const ds = cursor.toISOString().split('T')[0];
        if (getDayStatus(ds, habits, logs) !== 'all') break;
        allStreak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    // Month completion rate
    const todayDay = parseInt(today.split('-')[2]);
    let greenDays = 0;
    for (let d = 1; d <= todayDay; d++) {
      const ds = `${tyear}-${String(tmonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (getDayStatus(ds, habits, logs) === 'all') greenDays++;
    }
    const rate = todayDay > 0 && habits.length > 0
      ? Math.round((greenDays / todayDay) * 100) : 0;

    return { total: habits.length, doneToday, allStreak, rate };
  }, [habits, logs, today, tyear, tmonth]);

  // ── Per-habit streaks ──
  const habitStreaks = useMemo(() => {
    const m: Record<string, number> = {};
    habits.forEach(h => { m[h.id] = calcHabitStreak(h.id, logs, today); });
    return m;
  }, [habits, logs, today]);

  // ── Handlers ──

  const handleAddHabit = async () => {
    const name = addText.trim();
    if (!name) return;
    setAddSaving(true);
    try {
      const newHabit: Habit = {
        id: crypto.randomUUID(),
        userId,
        createdAt: new Date().toISOString(),
        name,
        frequency: 'daily',
      };
      await dataService.saveHabit(newHabit, userId);
      setHabits(prev => [...prev, newHabit]);
      setAddText('');
      onToast('Hábito criado!', 'success');
    } catch (e: any) {
      onToast('Erro ao criar hábito: ' + (e.message || ''), 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!window.confirm('Excluir hábito? O histórico será mantido.')) return;
    setHabits(prev => prev.filter(h => h.id !== habitId));
    try {
      await dataService.deleteHabit(habitId, userId);
    } catch {
      onToast('Erro ao excluir hábito.', 'error');
      load();
    }
  };

  const handleToggle = async (habit: Habit, day: string) => {
    const existing = logs.find(l => l.habitId === habit.id && l.date === day);
    const newCompleted = !(existing?.completed ?? false);
    const logId = existing?.id ?? crypto.randomUUID();
    const updated: HabitLog = {
      id: logId,
      userId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      habitId: habit.id,
      date: day,
      completed: newCompleted,
    };

    // Optimistic update
    setLogs(prev => existing
      ? prev.map(l => l.id === existing.id ? updated : l)
      : [...prev, updated]
    );

    try {
      await dataService.saveHabitLog(updated, userId);
    } catch {
      // Revert
      setLogs(prev => existing
        ? prev.map(l => l.id === logId ? existing : l)
        : prev.filter(l => l.id !== logId)
      );
      onToast('Erro ao salvar registro.', 'error');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6 pb-10">

      {/* ── 4 metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total de Hábitos"
          value={metrics.total}
          icon={<Target size={15} />}
          iconCls="text-primary bg-blue-50"
        />
        <MetricCard
          label="Sequência Geral"
          value={`${metrics.allStreak}d`}
          icon={<Flame size={15} />}
          iconCls="text-orange-500 bg-orange-50"
        />
        <MetricCard
          label="Concluídos Hoje"
          value={`${metrics.doneToday}/${metrics.total}`}
          icon={<CheckCircle2 size={15} />}
          iconCls="text-green-600 bg-green-50"
        />
        <MetricCard
          label="Taxa do Mês"
          value={`${metrics.rate}%`}
          icon={<TrendingUp size={15} />}
          iconCls="text-purple-600 bg-purple-50"
        />
      </div>

      {/* ── Weekly matrix ── */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">

        {/* Quick-add row */}
        <div className={`flex items-center gap-3 px-6 py-3 border-b transition-all
          ${addFocused ? 'bg-blue-50/40 border-primary' : 'border-neutral-100'}`}
        >
          <Plus size={16} className={addFocused ? 'text-primary' : 'text-neutral-300'} />
          <input
            ref={addRef}
            value={addText}
            onChange={e => setAddText(e.target.value)}
            onFocus={() => setAddFocused(true)}
            onBlur={() => setAddFocused(false)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddHabit();
              if (e.key === 'Escape') { setAddText(''); addRef.current?.blur(); }
            }}
            placeholder="+ Adicionar hábito..."
            className="flex-1 text-sm bg-transparent outline-none placeholder-neutral-400 text-neutral-800"
            disabled={addSaving}
          />
          {addText && (
            <button
              onMouseDown={e => { e.preventDefault(); handleAddHabit(); }}
              className="text-[10px] font-bold uppercase text-primary bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors"
            >
              {addSaving ? '...' : 'Criar'}
            </button>
          )}
        </div>

        {/* Matrix header */}
        <div
          className="grid border-b border-neutral-100 bg-neutral-50"
          style={{ gridTemplateColumns: '1fr repeat(7, 52px)' }}
        >
          <div className="px-6 py-2.5 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
            Hábito
          </div>
          {week.map(day => {
            const { dow, day: d, isToday } = dayLabel(day, today);
            return (
              <div
                key={day}
                className={`flex flex-col items-center justify-center py-2.5 ${isToday ? 'text-primary' : 'text-neutral-400'}`}
              >
                <span className="text-[10px] font-black uppercase leading-none">{dow}</span>
                {d && <span className="text-[10px] leading-snug">{d}</span>}
              </div>
            );
          })}
        </div>

        {/* Habit rows */}
        {habits.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center">
            <Target size={32} className="text-neutral-200 mb-3" />
            <p className="text-sm font-semibold text-neutral-400">Nenhum hábito ainda</p>
            <p className="text-xs text-neutral-300 mt-1">Use o campo acima para adicionar</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {habits.map(habit => {
              const streak = habitStreaks[habit.id] ?? 0;
              return (
                <div
                  key={habit.id}
                  className="grid items-center hover:bg-neutral-50/60 transition-colors group"
                  style={{ gridTemplateColumns: '1fr repeat(7, 52px)' }}
                >
                  {/* Name + streak */}
                  <div className="px-6 py-3.5 flex items-center gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 truncate">{habit.name}</p>
                      {streak > 0 && (
                        <p className="text-[10px] text-orange-500 font-bold flex items-center gap-0.5 mt-0.5">
                          <Flame size={10} /> {streak} dia{streak !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteHabit(habit.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* 7 day circles */}
                  {week.map(day => {
                    const done = logs.some(l => l.habitId === habit.id && l.date === day && l.completed);
                    const isToday = day === today;
                    return (
                      <div key={day} className="flex items-center justify-center py-3.5">
                        <button
                          onClick={() => handleToggle(habit, day)}
                          title={day}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150
                            ${done
                              ? 'bg-green-500 hover:bg-green-600 shadow-sm shadow-green-200'
                              : isToday
                                ? 'border-2 border-primary/50 hover:border-primary hover:bg-primary/5'
                                : 'border-2 border-neutral-200 hover:border-green-300 hover:bg-green-50'
                            }`}
                        >
                          {done && <Check size={13} className="text-white" strokeWidth={3} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

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
