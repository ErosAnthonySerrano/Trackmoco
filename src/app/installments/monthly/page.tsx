"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getFixedMonthlyDates, getMonthRows, getMonthLabel, toIsoDate } from '@/components/installments/installment-utils';
import { Button } from '@/components/ui';

const today = new Date();
const defaultStartMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

export default function MonthlyInstallmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [monthCount, setMonthCount] = useState(6);
  const [startMonth, setStartMonth] = useState(defaultStartMonth);
  const [amount, setAmount] = useState('');
  const [sameDay, setSameDay] = useState(true);
  const [anchorDay, setAnchorDay] = useState(1);
  const [manualDates, setManualDates] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const autoDates = useMemo(() => {
    if (!sameDay) return [];
    return getFixedMonthlyDates(startMonth, monthCount, anchorDay);
  }, [sameDay, startMonth, monthCount, anchorDay]);

  useEffect(() => {
    if (!sameDay) {
      setManualDates((current) =>
        Array.from({ length: monthCount }, (_, index) => current[index] ?? autoDates[index] ?? '')
      );
    }
  }, [sameDay, monthCount, autoDates]);

  const handleSameDayToggle = (checked: boolean) => {
    if (checked && !sameDay && manualDates.some(Boolean)) {
      const confirmed = window.confirm('Turning on same due day will overwrite manual dates. Continue?');
      if (!confirmed) return;
    }

    setSameDay(checked);
    if (!checked) {
      setManualDates(autoDates);
    }
  };

  const monthRows = useMemo(() => getMonthRows(startMonth, monthCount), [startMonth, monthCount]);

  const dates = sameDay ? autoDates : manualDates;

  const allSet = dates.length === monthCount && dates.every(Boolean);
  const hasError = !title || !amount || !allSet;

  const handleManualChange = (index: number, value: string) => {
    setManualDates((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

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

    const amountValue = Number(amount);
    const itemRows = dates.map((date, index) => ({
      sequence_index: index + 1,
      label: getMonthLabel(date),
      due_date: date,
      amount: amountValue,
      status: 'unpaid',
    }));

    const { data, error } = await supabase
      .from('installments')
      .insert([
        {
          title,
          type: 'monthly',
          start_date: `${startMonth}-01`,
          total_count: itemRows.length,
          default_amount: amountValue,
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
      console.error('Failed to save monthly installment', { error, data });
      return;
    }

    const { error: itemError } = await supabase.from('installment_items').insert(
      itemRows.map((item) => ({ ...item, installment_id: installmentId }))
    );

    setIsSaving(false);

    if (itemError) {
      await supabase.from('installments').delete().eq('id', installmentId);
      setSaveError(itemError.message || 'Unable to save installment items.');
      console.error('Failed to save monthly installment items', itemError);
      return;
    }

    router.push('/');
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-surface p-10 shadow-lg">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-ink">Create monthly installment</h1>
          <p className="mt-2 text-sm text-ink-muted">Set a monthly schedule with optional fixed due-day clamping.</p>
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
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                placeholder="0.00"
              />
            </label>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Number of months
              <input
                type="number"
                min="1"
                max="120"
                value={monthCount}
                onChange={(event) => setMonthCount(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              Start month
              <input
                type="month"
                value={startMonth}
                onChange={(event) => setStartMonth(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-line bg-bg p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={sameDay}
                  onChange={(event) => setSameDay(event.target.checked)}
                  className="h-5 w-5 rounded border border-line text-accent focus:ring-accent"
                />
                Set the same due day every month
              </label>
            </div>

            {sameDay ? (
              <label className="block text-sm font-medium text-ink-muted">
                Due day
                <select
                  value={anchorDay}
                  onChange={(event) => setAnchorDay(Number(event.target.value))}
                  className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                >
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                  <option value={32}>Last day of month</option>
                </select>
              </label>
            ) : null}

            <div className="grid gap-4">
              {monthRows.map((row, index) => (
                <label key={row.date} className="block text-sm font-medium text-ink-muted">
                  {row.label}
                  <input
                    type="date"
                    value={sameDay ? autoDates[index] ?? '' : manualDates[index] ?? ''}
                    onChange={(event) => handleManualChange(index, event.target.value)}
                    disabled={sameDay}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">{allSet ? `${monthCount} months ready` : 'Complete all due dates to save.'}</p>
            <Button type="submit" disabled={hasError || isSaving} className="w-full sm:w-auto">
              {isSaving ? 'Saving…' : 'Save monthly installment'}
            </Button>
          </div>
          {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        </form>
      </div>
    </main>
  );
}
