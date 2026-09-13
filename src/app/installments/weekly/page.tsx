"use client";

import { addMonths, format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { allocateAmount, getScheduleDateError, getWeekDate, toIsoDate } from '@/components/installments/installment-utils';
import { BackButton, Button } from '@/components/ui';

const today = toIsoDate(new Date());

export default function WeeklyInstallmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [weekCount, setWeekCount] = useState('4');
  const [amount, setAmount] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState<number[]>([]);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [baseDate, setBaseDate] = useState(today);
  const [dates, setDates] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const weekCountValue = Number(weekCount);

  useEffect(() => {
    if (mode === 'auto') {
      // Synchronize generated dates when the schedule inputs change.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDates(Array.from({ length: weekCountValue }, (_, index) => getWeekDate(baseDate, index)));
    } else {
      // Preserve manual entries while resizing the editable date list.
      setDates((current) => {
        const next = Array.from({ length: weekCountValue }, (_, index) => current[index] ?? '');
        return next;
      });
    }
  }, [mode, baseDate, weekCountValue]);

  const canEditWeek = (index: number) => {
    if (mode === 'auto') return true;
    if (index === 0) return true;
    return Boolean(dates[index - 1]);
  };

  const suggestedMonth = (index: number) => {
    if (index === 0 || !dates[index - 1]) return '';
    return format(addMonths(parseISO(dates[index - 1]), 1), 'MMMM yyyy');
  };

  const handleModeChange = (nextMode: 'auto' | 'manual') => {
    if (nextMode === mode) return;
    if (nextMode === 'auto' && mode === 'manual' && dates.some(Boolean)) {
      const confirmed = window.confirm('Switching back to Auto-fill will overwrite any manually entered week dates. Continue?');
      if (!confirmed) return;
    }
    setMode(nextMode);
  };

  const handleDateChange = (index: number, value: string) => {
    setDates((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const allDatesSet = dates.length === weekCountValue && dates.every(Boolean);
  const dateError = allDatesSet ? getScheduleDateError(dates) : null;
  const amountValue = Number(amount);
  const hasError = !title.trim() || amountValue <= 0 || !Number.isFinite(amountValue) || !Number.isInteger(weekCountValue) || weekCountValue < 1 || paymentAmounts.length !== weekCountValue || !allDatesSet || Boolean(dateError);
  const handleCalculateAmount = () => setPaymentAmounts(allocateAmount(amountValue, weekCountValue));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasError) return;
    setSaveError(null);
    setIsSaving(true);

    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;
    if (!userId) {
      router.replace('/login');
      return;
    }

    const itemRows = dates.map((date, index) => ({
      sequence_index: index + 1,
      label: `Week ${index + 1}`,
      due_date: date,
      amount: paymentAmounts[index] ?? amountValue,
      status: 'unpaid',
    }));

    const { data, error } = await supabase
      .from('installments')
      .insert([
        {
          title,
          type: 'weekly',
          start_date: baseDate,
          total_count: itemRows.length,
          default_amount: paymentAmounts[0] ?? amountValue,
          currency: 'PHP',
          created_by: userId,
        },
      ])
      .select('id')
      .single();

    const installmentId = data?.id;
    if (error || !installmentId) {
      setIsSaving(false);
      setSaveError(error?.message || JSON.stringify(error) || 'Unable to save installment.');
      console.error('Failed to save weekly installment', { error, data });
      return;
    }

    const { error: itemError } = await supabase.from('installment_items').insert(
      itemRows.map((item) => ({ ...item, installment_id: installmentId }))
    );

    setIsSaving(false);

    if (itemError) {
      await supabase.from('installments').delete().eq('id', installmentId);
      setSaveError(itemError.message || 'Unable to save installment items.');
      console.error('Failed to save weekly installment items', itemError);
      return;
    }

    router.push('/');
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-surface p-5 shadow-lg sm:p-10">
        <BackButton href="/installments" label="Back to installment types" />
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Create weekly installment</h1>
          <p className="mt-2 text-sm text-ink-muted">Set a weekly payment schedule with auto-fill or manual sequential entry.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Title
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                placeholder="Installment title"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              Total amount
              <div className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => { setAmount(event.target.value); setPaymentAmounts([]); }}
                required
                className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                placeholder="0.00"
              />
              <Button type="button" variant="secondary" onClick={handleCalculateAmount} disabled={!amount || weekCountValue < 1} className="shrink-0 px-3 text-xs">Calculate</Button>
              </div>
              <span className="mt-2 block text-xs font-normal text-ink-muted">Divide the total across {weekCount} weekly payments.</span>
            </label>
          </div>
          {amount && (Number(amount) <= 0 || !Number.isFinite(Number(amount))) ? (
            <p className="text-sm text-danger">Amount must be a positive number.</p>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Number of weeks
              <input
                type="number"
                min="1"
                max="104"
                value={weekCount}
                onChange={(event) => { setWeekCount(event.target.value); setPaymentAmounts([]); }}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              Week 1 due date
              <input
                type="date"
                value={baseDate}
                onChange={(event) => setBaseDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-line bg-bg p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-ink">Mode</h2>
              <button
                type="button"
                onClick={() => handleModeChange('auto')}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${mode === 'auto' ? 'bg-accent text-accent' : 'bg-surface text-ink border border-line'}`}
              >
                Auto-fill
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('manual')}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${mode === 'manual' ? 'bg-accent text-accent' : 'bg-surface text-ink border border-line'}`}
              >
                Manual
              </button>
            </div>

            <div className="grid gap-4">
              {Array.from({ length: weekCountValue }, (_, index) => {
                const disabled = mode === 'manual' && !canEditWeek(index);
                const defaultValue = mode === 'auto' ? getWeekDate(baseDate, index) : dates[index] ?? '';
                return (
                  <label key={index} className="block text-sm font-medium text-ink-muted">
                    {`Week ${index + 1}`}
                    <input
                      type="date"
                      value={defaultValue}
                      onChange={(event) => handleDateChange(index, event.target.value)}
                      disabled={disabled}
                      className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="mt-2 text-right text-sm font-semibold text-ink">₱{(paymentAmounts[index] ?? amountValue).toFixed(2)}</p>
                    {mode === 'manual' && index > 0 && dates[index - 1] && !dates[index] ? (
                      <p className="mt-2 text-xs text-ink-muted">Suggested month: {suggestedMonth(index)}</p>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          {dateError ? <p className="text-sm text-danger">{dateError}</p> : null}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">{allDatesSet ? `Weeks ready: ${weekCount}` : 'Complete all due dates to save.'}</p>
            <Button type="submit" disabled={hasError || isSaving} className="w-full sm:w-auto">
              {isSaving ? 'Saving…' : 'Save weekly installment'}
            </Button>
          </div>
          {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        </form>
      </div>
    </main>
  );
}
