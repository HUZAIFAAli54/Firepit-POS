import { useState } from 'react';
import { Plus, Trash2, Banknote, CreditCard, CheckCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import type { SplitPayment, PaymentMethod } from '../../types';

interface Props {
  total: number;
  currencySymbol: string;
  onConfirm: (splits: SplitPayment[]) => void;
  onCancel: () => void;
}

export default function SplitPaymentModal({ total, currencySymbol, onConfirm, onCancel }: Props) {
  const [splits, setSplits] = useState<SplitPayment[]>([
    { method: 'cash', amount: total },
  ]);

  const fmt = (n: number) => `${currencySymbol} ${n.toLocaleString()}`;
  const sumPaid = splits.reduce((s, p) => s + (parseFloat(String(p.amount)) || 0), 0);
  const remaining = total - sumPaid;
  const isValid = Math.abs(remaining) < 1;

  const addSplit = () => setSplits(prev => [...prev, { method: 'cash', amount: Math.max(0, remaining) }]);
  const removeSplit = (i: number) => setSplits(prev => prev.filter((_, idx) => idx !== i));
  const updateSplit = (i: number, key: keyof SplitPayment, value: string) =>
    setSplits(prev => prev.map((s, idx) =>
      idx === i ? { ...s, [key]: key === 'amount' ? parseFloat(value) || 0 : value } : s
    ));

  const setMethod = (i: number, method: PaymentMethod) =>
    setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, method } : s));

  return (
    <Modal open onClose={onCancel} title="Split Bill" size="sm">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-sm text-gray-500">Total to pay</div>
          <div className="text-2xl font-black text-gray-800">{fmt(total)}</div>
        </div>

        <div className="space-y-2">
          {splits.map((split, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <div className="flex gap-1">
                <button onClick={() => setMethod(i, 'cash')}
                  className={`p-1.5 rounded-lg text-xs font-medium transition-all ${split.method === 'cash' ? 'bg-green-500 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
                  <Banknote className="w-4 h-4" />
                </button>
                <button onClick={() => setMethod(i, 'card')}
                  className={`p-1.5 rounded-lg text-xs font-medium transition-all ${split.method === 'card' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
                  <CreditCard className="w-4 h-4" />
                </button>
              </div>
              <span className="text-sm text-gray-600 capitalize min-w-8">{split.method}</span>
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currencySymbol}</span>
                <input
                  type="number"
                  value={split.amount || ''}
                  onChange={e => updateSplit(i, 'amount', e.target.value)}
                  className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              {splits.length > 1 && (
                <button onClick={() => removeSplit(i)} className="p-1.5 text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className={`flex justify-between text-sm font-semibold px-1 ${remaining < 0 ? 'text-red-600' : remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>
          <span>{remaining > 0 ? 'Remaining' : remaining < 0 ? 'Overpaid' : 'Balanced ✓'}</span>
          <span>{fmt(Math.abs(remaining))}</span>
        </div>

        <button onClick={addSplit}
          className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-amber-300 hover:text-amber-600 text-sm font-medium flex items-center justify-center gap-1.5 transition-all">
          <Plus className="w-4 h-4" /> Add Payment Method
        </button>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(splits)}
            disabled={!isValid}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold"
          >
            <CheckCircle className="w-4 h-4" /> Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}
