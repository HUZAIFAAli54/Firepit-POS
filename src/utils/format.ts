export function formatCurrency(amount: number, symbol = 'Rs.'): string {
  return `${symbol} ${amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
}
