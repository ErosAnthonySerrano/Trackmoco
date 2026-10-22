type InstallmentCardPaymentTotalsProps = {
  paidAmount: number;
  remainingAmount: number;
};

function formatAmount(amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `₱${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InstallmentCardPaymentTotals({
  paidAmount,
  remainingAmount,
}: InstallmentCardPaymentTotalsProps) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
      <div className="min-w-0">
        <dt className="text-xs font-medium text-ink-muted">Total paid</dt>
        <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-success">
          {formatAmount(paidAmount)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-ink-muted">Remaining balance</dt>
        <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-ink">
          {formatAmount(remainingAmount)}
        </dd>
      </div>
    </dl>
  );
}
