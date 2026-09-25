import { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle, ChefHat, Bell, XCircle, Banknote, CreditCard } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatTime } from '../../utils/format';
import type { Order, OrderStatus } from '../../types';
import ConfirmDialog from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';
import ReceiptModal from './ReceiptModal';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.FC<any> }> = {
  open:            { label: 'Open',            color: 'bg-blue-100 text-blue-700',    icon: Clock },
  preparing:       { label: 'Preparing',       color: 'bg-yellow-100 text-yellow-700', icon: ChefHat },
  ready:           { label: 'Ready',           color: 'bg-green-100 text-green-700',   icon: Bell },
  served:          { label: 'Served',          color: 'bg-gray-100 text-gray-600',     icon: CheckCircle },
  'pending-payment': { label: 'Pending Payment', color: 'bg-orange-100 text-orange-700', icon: Clock },
  paid:            { label: 'Paid',            color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  voided:          { label: 'Voided',          color: 'bg-red-100 text-red-600',       icon: XCircle },
};

const nextStatus: Record<string, OrderStatus> = {
  open: 'preparing',
  preparing: 'ready',
  ready: 'served',
};

export default function OrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'card'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [paying, setPaying] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<number | null>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const all = await db.orders
      .orderBy('createdAt')
      .reverse()
      .filter(o => ['open', 'preparing', 'ready', 'served', 'pending-payment'].includes(o.status))
      .limit(50)
      .toArray();
    setOrders(all);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (payMethod === 'cash' && cashInputRef.current) cashInputRef.current.focus();
  }, [payMethod, payTarget]);

  const advance = async (order: Order) => {
    const next = nextStatus[order.status];
    if (!next || !session) return;
    await db.orders.update(order.id!, { status: next, updatedAt: new Date().toISOString() });
    await logActivity(session.id, session.name, session.role, 'order', `Order ${next}`,
      `Order #${order.id} → ${next}`);
    load();
  };

  const handleVoid = async () => {
    if (!voidTarget || !session) return;
    await db.orders.update(voidTarget.id!, { status: 'voided', updatedAt: new Date().toISOString() });
    if (voidTarget.tableId) {
      await db.cafeTables.update(voidTarget.tableId, { status: 'free', activeOrderId: undefined });
    }
    await logActivity(session.id, session.name, session.role, 'order', 'Order Voided', `Order #${voidTarget.id} voided`);
    setVoidTarget(null);
    load();
  };

  const openMarkPaid = (order: Order) => {
    setPayTarget(order);
    setPayMethod('cash');
    setAmountPaid('');
  };

  const handleMarkPaid = async () => {
    if (!payTarget || !session || paying) return;
    const paid = parseFloat(amountPaid) || 0;
    if (payMethod === 'cash' && paid < payTarget.total) return;
    setPaying(true);
    try {
      const now = new Date().toISOString();
      const change = payMethod === 'cash' ? paid - payTarget.total : 0;
      await db.orders.update(payTarget.id!, {
        status: 'paid',
        paymentMethod: payMethod,
        amountPaid: payMethod === 'cash' ? paid : payTarget.total,
        change,
        completedAt: now,
        updatedAt: now,
      });
      // Free table
      if (payTarget.tableId) {
        await db.cafeTables.update(payTarget.tableId, { status: 'free', activeOrderId: undefined });
      }
      // Update shift totals
      if (session.shiftId) {
        const shift = await db.shifts.get(session.shiftId);
        if (shift) {
          await db.shifts.update(session.shiftId, {
            totalSales: (shift.totalSales || 0) + payTarget.total,
            totalOrders: (shift.totalOrders || 0) + 1,
            totalCash: (shift.totalCash || 0) + (payMethod === 'cash' ? payTarget.total : 0),
            totalCard: (shift.totalCard || 0) + (payMethod === 'card' ? payTarget.total : 0),
          });
        }
      }
      await logActivity(session.id, session.name, session.role, 'order', 'Pending Order Paid',
        `Order #${payTarget.id} | ${currencySymbol} ${payTarget.total} | ${payMethod}`);
      setReceiptOrder(payTarget.id!);
      setPayTarget(null);
      load();
    } finally {
      setPaying(false);
    }
  };

  const filtered = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);

  const fmt = (n: number) => `${currencySymbol} ${n.toLocaleString()}`;

  return (
    <div className="h-full flex flex-col bg-gray-50 p-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'pending-payment', 'open', 'preparing', 'ready', 'served'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${filterStatus === s ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-amber-300'}`}
          >
            {s === 'all' ? 'All Active' : s === 'pending-payment' ? 'Pending Payment' : s}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({orders.filter(o => o.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
          <CheckCircle className="w-16 h-16 mb-3" />
          <p className="font-medium">No active orders</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pb-4 scrollbar-thin">
          {filtered.map(order => {
            const cfg = statusConfig[order.status];
            const Icon = cfg.icon;
            const canAdvance = !!nextStatus[order.status];
            const isPendingPay = order.status === 'pending-payment';
            return (
              <div key={order.id} className={`bg-white rounded-xl border shadow-sm p-3 flex flex-col ${isPendingPay ? 'border-orange-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-gray-800">#{order.id}</div>
                    <div className="text-xs text-gray-500 capitalize">
                      {order.orderType === 'dine-in' ? `Dine In — ${order.tableName}` :
                       order.orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </div>
                </div>

                <div className="flex-1 space-y-0.5 text-sm mb-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-gray-700">
                      <span>{item.quantity}× {item.name}</span>
                    </div>
                  ))}
                  {order.notes && (
                    <div className="text-xs text-amber-600 italic mt-1">📝 {order.notes}</div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>{formatTime(order.createdAt)}</span>
                  <span className="font-semibold text-gray-700">{fmt(order.total)}</span>
                </div>

                <div className="flex gap-2">
                  {isPendingPay ? (
                    <button
                      onClick={() => openMarkPaid(order)}
                      className="flex-1 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-all"
                    >
                      Mark as Paid
                    </button>
                  ) : canAdvance ? (
                    <button
                      onClick={() => advance(order)}
                      className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-all"
                    >
                      → {nextStatus[order.status]}
                    </button>
                  ) : null}
                  <button
                    onClick={() => setVoidTarget(order)}
                    className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold border border-red-100"
                  >
                    Void
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!voidTarget}
        title="Void Order"
        message={`Are you sure you want to void order #${voidTarget?.id}? This cannot be undone.`}
        confirmLabel="Void Order"
        danger
        onConfirm={handleVoid}
        onCancel={() => setVoidTarget(null)}
      />

      {/* Mark as Paid Modal */}
      {payTarget && (
        <Modal open title={`Pay Order #${payTarget.id}`} onClose={() => setPayTarget(null)} size="sm">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>{payTarget.orderType === 'dine-in' ? `Dine In — ${payTarget.tableName}` : payTarget.orderType}</span>
                <span>{payTarget.items.reduce((s, i) => s + i.quantity, 0)} items</span>
              </div>
              <div className="flex justify-between font-bold text-base text-gray-900 mt-1">
                <span>Total</span>
                <span className="text-amber-600">{fmt(payTarget.total)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPayMethod('cash')}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 font-medium text-sm transition-all ${payMethod === 'cash' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600'}`}>
                <Banknote className="w-4 h-4" /> Cash
              </button>
              <button onClick={() => setPayMethod('card')}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 font-medium text-sm transition-all ${payMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                <CreditCard className="w-4 h-4" /> Card
              </button>
            </div>
            {payMethod === 'cash' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Amount Received</label>
                <input
                  ref={cashInputRef}
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder={`${currencySymbol} 0`}
                  className="w-full px-4 py-3 text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                {parseFloat(amountPaid) >= payTarget.total && (
                  <div className="mt-2 p-3 bg-green-50 rounded-xl flex justify-between">
                    <span className="text-sm font-medium text-green-700">Change</span>
                    <span className="text-lg font-bold text-green-700">{fmt(parseFloat(amountPaid) - payTarget.total)}</span>
                  </div>
                )}
              </div>
            )}
            {payMethod === 'card' && (
              <div className="p-4 bg-blue-50 rounded-xl text-center text-sm text-blue-700">
                Process card payment on terminal, then confirm.
              </div>
            )}
            <button
              onClick={handleMarkPaid}
              disabled={paying || (payMethod === 'cash' && parseFloat(amountPaid) < payTarget.total)}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {paying ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </Modal>
      )}

      {receiptOrder && (
        <ReceiptModal orderId={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
}
