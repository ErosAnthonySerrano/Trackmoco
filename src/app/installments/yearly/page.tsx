"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { allocateAmount, getFixedYearlyDates, getScheduleDateError, getYearLabel } from '@/components/installments/installment-utils';
import { BackButton, Button, Select } from '@/components/ui';

const today = new Date();
const defaultStartYear = today.getFullYear();

export default function YearlyInstallmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [yearCount, setYearCount] = useState('3');
  const [startYear, setStartYear] = useState(defaultStartYear);
  const [amount, setAmount] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState<number[]>([]);
  const [sameDate, setSameDate] = useState(true);
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [day, setDay] = useState(today.getDate());
  const [manualDates, setManualDates] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const yearCountValue = Number(yearCount);

  const autoDates = useMemo(() => {
    if (!sameDate) return [];
    return getFixedYearlyDates(startYear, yearCountValue, month, day);
  }, [sameDate, startYear, yearCountValue, month, day]);

  useEffect(() => {
    if (!sameDate) {
      // Synchronize the editable date list with the selected year count.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setManualDates((current) =>
        Array.from({ length: yearCountValue }, (_, index) => current[index] ?? autoDates[index] ?? '')
      );
    }
  }, [sameDate, yearCountValue, autoDates]);

  const handleSameDateToggle = (checked: boolean) => {
    if (checked && !sameDate && manualDates.some(Boolean)) {
      const confirmed = window.confirm('Turning on same due date will overwrite manual dates. Continue?');
      if (!confirmed) return;
    }

    setSameDate(checked);
    if (!checked) {
      setManualDates(autoDates);
    }
  };

  const years = Array.from({ length: yearCountValue }, (_, index) => startYear + index);
  const dates = sameDate ? autoDates : manualDates;
  const allSet = dates.length === yearCountValue && dates.every(Boolean);
  const dateError = allSet ? getScheduleDateError(dates) : null;
  const amountValue = Number(amount);
  const hasError = !title.trim() || amountValue <= 0 || !Number.isFinite(amountValue) || !Number.isInteger(yearCountValue) || yearCountValue < 1 || paymentAmounts.length !== yearCountValue || !allSet || Boolean(dateError);
  const handleCalculateAmount = () => setPaymentAmounts(allocateAmount(amountValue, yearCountValue));

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

    const itemRows = dates.map((date, index) => ({
      sequence_index: index + 1,
      label: getYearLabel(date),
      due_date: date,
      amount: paymentAmounts[index] ?? amountValue,
      status: 'unpaid',
    }));

    const { data, error } = await supabase
      .from('installments')
      .insert([
        {
          title,
          type: 'yearly',
          start_date: `${startYear}-01-01`,
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
      console.error('Failed to save yearly installment', { error, data });
      return;
    }

    const { error: itemError } = await supabase.from('installment_items').insert(
      itemRows.map((item) => ({ ...item, installment_id: installmentId }))
    );

    setIsSaving(false);

    if (itemError) {
      await supabase.from('installments').delete().eq('id', installmentId);
      setSaveError(itemError.message || 'Unable to save installment items.');
      console.error('Failed to save yearly installment items', itemError);
      return;
    }

    router.push('/');
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-surface p-5 shadow-lg sm:p-10">
        <BackButton href="/installments" label="Back to installment types" />
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Create yearly installment</h1>
          <p className="mt-2 text-sm text-ink-muted">Choose yearly payments with optional fixed due dates across years.</p>
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
              <Button type="button" variant="secondary" onClick={handleCalculateAmount} disabled={!amount || yearCountValue < 1} className="shrink-0 px-3 text-xs">Calculate</Button>
              </div>
              <span className="mt-2 block text-xs font-normal text-ink-muted">Divide the total across {yearCount} yearly payments.</span>
            </label>
          </div>
          {amount && (Number(amount) <= 0 || !Number.isFinite(Number(amount))) ? (
            <p className="text-sm text-danger">Amount must be a positive number.</p>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Number of years
              <input
                type="number"
                min="1"
                max="50"
                value={yearCount}
                onChange={(event) => { setYearCount(event.target.value); setPaymentAmounts([]); }}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              Start year
              <input
                type="number"
                min="1900"
                max="2100"
                value={startYear}
                onChange={(event) => setStartYear(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
          </div>

          {dateError ? <p className="text-sm text-danger">{dateError}</p> : null}

          <div className="rounded-3xl border border-line bg-bg p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={sameDate}
                  onChange={(event) => handleSameDateToggle(event.target.checked)}
                  className="h-5 w-5 rounded border border-line text-accent focus:ring-accent"
                />
                Set the same due date every year
              </label>
            </div>

            {sameDate ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink-muted">
                  Month
                  <Select
                    value={String(month)}
                    onChange={(value) => setMonth(Number(value))}
                    options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))}
                  />
                </label>
                <label className="block text-sm font-medium text-ink-muted">
                  Day
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={day}
                    onChange={(event) => setDay(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                  />
                </label>
              </div>
            ) : null}

            <div className="grid gap-4">
              {years.map((year, index) => (
                <div key={year} className="rounded-2xl border border-line bg-surface p-4">
                  <label className="block text-sm font-medium text-ink-muted">
                    {year}
                  <input
                    type="date"
                    value={sameDate ? autoDates[index] ?? '' : manualDates[index] ?? ''}
                    onChange={(event) => handleManualChange(index, event.target.value)}
                    disabled={sameDate}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  </label>
                  <p className="mt-2 text-right text-sm font-semibold text-ink">₱{(paymentAmounts[index] ?? amountValue).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">{allSet ? `${yearCount} year(s) ready` : 'Complete all due dates to save.'}</p>
            <Button type="submit" disabled={hasError || isSaving} className="w-full sm:w-auto">
              {isSaving ? 'Saving…' : 'Save yearly installment'}
            </Button>
          </div>
          {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        </form>
      </div>
    </main>
  );
}
