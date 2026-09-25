import { useState, useEffect } from 'react';
import { X, RotateCcw, Trash2, Clock } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatTime, formatCurrency } from '../../utils/format';
import type { Order } from '../../types';
import ConfirmDialog from '../ui/ConfirmDialog';

interface Props {
  onClose: () => void;
}

export default function HoldOrdersDrawer({ onClose }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const { session, clearCart, addToCart, setTable, setOrderType, setOrderNotes,
    setSelectedCustomer, setDeliveryInfo, currencySymbol } = useAppStore();
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const load = async () => {
    const held = await db.orders
      .where('status').equals('open')
      .reverse()
      .toArray();
    setOrders(held);
  };

  useEffect(() => { load(); }, []);

  const resume = async (order: Order) => {
    clearCart();
    setOrderType(order.orderType);
    setTable(order.tableId ?? null, order.tableName);
    setOrderNotes(order.notes);
    if (order.deliveryInfo) setDeliveryInfo(order.deliveryInfo);
    if (order.customerId) {
      const customer = await db.customers.get(order.customerId);
      if (customer) setSelectedCustomer(customer);
    }
    order.items.forEach(item => addToCart({ ...item, subtotal: item.price * item.quantity }));
    // Void the held order since it's now in the cart
    await db.orders.update(order.id!, { status: 'voided', updatedAt: new Date().toISOString() });
    if (session) {
      await logActivity(session.id, session.name, session.role, 'order', 'Order Resumed', `Order #${order.id} resumed from hold`);
    }
    onClose();
  };

  const deleteOrder = async () => {
    if (!deleteTarget || !session) return;
    await db.orders.update(deleteTarget.id!, { status: 'voided', updatedAt: new Date().toISOString() });
    await logActivity(session.id, session.name, session.role, 'order', 'Held Order Deleted', `Order #${deleteTarget.id} deleted`);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-80 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-gray-800">Held Orders</span>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{orders.length}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          {orders.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No held orders</p>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-bold text-gray-800">#{order.id}</span>
                    <span className="text-xs text-gray-400 ml-2">{formatTime(order.updatedAt || order.createdAt)}</span>
                  </div>
                  <button onClick={() => setDeleteTarget(order)}
                    className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 mb-1">{order.tableName} · {order.orderType}</div>
                <div className="text-xs text-gray-600 mb-2">
                  {order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-600">{fmt(order.total)}</span>
                  <button onClick={() => resume(order)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-all">
                    <RotateCcw className="w-3.5 h-3.5" /> Resume
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Held Order"
        message={`Delete held order #${deleteTarget?.id}?`}
        confirmLabel="Delete"
        danger
        onConfirm={deleteOrder}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
