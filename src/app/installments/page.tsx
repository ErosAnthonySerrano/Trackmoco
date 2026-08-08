import Link from 'next/link';

export default function InstallmentsLandingPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-surface p-10 shadow-lg">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-ink">Create an installment plan</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Choose the schedule that fits your payments and create the plan with a single due-date pattern.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/installments/daily" className="rounded-3xl border border-line bg-bg p-6 text-left transition hover:border-accent">
            <h2 className="mb-2 text-xl font-semibold text-ink">Daily</h2>
            <p className="text-sm text-ink-muted">Create a daily payment plan with date range and optional skipped days.</p>
          </Link>
          <Link href="/installments/weekly" className="rounded-3xl border border-line bg-bg p-6 text-left transition hover:border-accent">
            <h2 className="mb-2 text-xl font-semibold text-ink">Weekly</h2>
            <p className="text-sm text-ink-muted">Schedule payments on a weekly cadence with auto-fill or manual mode.</p>
          </Link>
          <Link href="/installments/monthly" className="rounded-3xl border border-line bg-bg p-6 text-left transition hover:border-accent">
            <h2 className="mb-2 text-xl font-semibold text-ink">Monthly</h2>
            <p className="text-sm text-ink-muted">Choose a monthly schedule with optional fixed due day and clamping.</p>
          </Link>
          <Link href="/installments/yearly" className="rounded-3xl border border-line bg-bg p-6 text-left transition hover:border-accent">
            <h2 className="mb-2 text-xl font-semibold text-ink">Yearly</h2>
            <p className="text-sm text-ink-muted">Create an annual payment schedule with fixed due dates across years.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
