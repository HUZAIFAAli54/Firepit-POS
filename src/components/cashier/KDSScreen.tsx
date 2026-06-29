import { useState, useEffect } from 'react';
import { ChefHat, Bell, Clock, X } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { Order, OrderStatus } from '../../types';

interface Props {
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; btn: string; next: OrderStatus | null; nextLabel: string }> = {
  open:      { label: 'New',      bg: 'bg-blue-50',   border: 'border-blue-300',  btn: 'bg-blue-500 hover:bg-blue-600',   next: 'preparing', nextLabel: 'Start Preparing' },
  preparing: { label: 'Cooking',  bg: 'bg-amber-50',  border: 'border-amber-300', btn: 'bg-amber-500 hover:bg-amber-600', next: 'ready',     nextLabel: 'Mark Ready ✓' },
  ready:     { label: 'Ready!',   bg: 'bg-green-50',  border: 'border-green-300', btn: 'bg-green-500 hover:bg-green-600', next: 'served',    nextLabel: 'Mark Served' },
  served:    { label: 'Served',   bg: 'bg-gray-50',   border: 'border-gray-200',  btn: '',                                next: null,        nextLabel: '' },
};

const ORDER_TYPE_BADGE: Record<string, string> = {
  'dine-in':  'bg-amber-100 text-amber-700',
  'takeaway': 'bg-blue-100 text-blue-700',
  'delivery': 'bg-green-100 text-green-700',
};

export default function KDSScreen({ onClose }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const session = useAppStore(s => s.session);

  const load = async () => {
    const list = await db.orders
      .orderBy('createdAt')
      .filter(o => ['open', 'preparing', 'ready', 'served', 'pending-payment'].includes(o.status))
      .toArray();
    setOrders(list);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const advance = async (order: Order) => {
    const cfg = STATUS_CONFIG[order.status];
    if (!cfg.next || !session) return;
    await db.orders.update(order.id!, { status: cfg.next, updatedAt: new Date().toISOString() });
    await logActivity(session.id, session.name, session.role, 'order',
      `KDS: Order → ${cfg.next}`, `Order #${order.id}`);
    load();
  };

  const elapsedMins = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    return Math.floor(diff / 60000);
  };

  const grouped: Record<string, Order[]> = { open: [], preparing: [], ready: [], served: [] };
  orders.forEach(o => {
    // pending-payment orders still need kitchen prep — show in preparing column
    if (o.status === 'pending-payment') grouped['preparing'].push(o);
    else if (grouped[o.status]) grouped[o.status].push(o);
  });

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col overflow-hidden">
      {/* KDS Header */}
      <div className="bg-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-1.5 rounded-lg">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-lg">Kitchen Display</span>
            <span className="text-gray-400 text-sm ml-3">Auto-refreshes every 3s</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-sm">
            {Object.entries(grouped).map(([status, list]) => (
              <div key={status} className="text-center">
                <div className="font-bold text-white text-lg">{list.length}</div>
                <div className="text-gray-400 capitalize text-xs">{status}</div>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-hidden grid grid-cols-3 gap-3 p-3">
        {(['open', 'preparing', 'ready'] as const).map(status => {
          const cfg = STATUS_CONFIG[status];
          const columnOrders = grouped[status];
          return (
            <div key={status} className="flex flex-col bg-gray-800 rounded-2xl overflow-hidden">
              <div className={`px-4 py-3 flex items-center gap-2 font-bold text-white ${status === 'open' ? 'bg-blue-600' : status === 'preparing' ? 'bg-amber-600' : 'bg-green-600'}`}>
                {status === 'open' && <Clock className="w-4 h-4" />}
                {status === 'preparing' && <ChefHat className="w-4 h-4" />}
                {status === 'ready' && <Bell className="w-4 h-4" />}
                <span className="capitalize">{cfg.label}</span>
                <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-sm">{columnOrders.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
                {columnOrders.length === 0 && (
                  <div className="text-center text-gray-500 py-8 text-sm">No orders</div>
                )}
                {columnOrders.map(order => {
                  const elapsed = elapsedMins(order.createdAt);
                  const urgent = elapsed > 15;
                  return (
                    <div key={order.id} className={`rounded-xl border-2 p-3 ${cfg.bg} ${cfg.border} ${urgent && status !== 'ready' ? 'border-red-400' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-800 text-lg">#{order.id}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ORDER_TYPE_BADGE[order.orderType] || 'bg-gray-100 text-gray-600'}`}>
                            {order.orderType}
                          </span>
                        </div>
                        <div className={`text-xs font-bold ${urgent ? 'text-red-600' : 'text-gray-500'}`}>
                          {elapsed}m ago
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-700 mb-0.5">{order.tableName}</div>
                      {order.orderType === 'delivery' && order.deliveryInfo?.customerName && (
                        <div className="text-xs text-green-600 mb-1">🚴 {order.deliveryInfo.customerName}</div>
                      )}

                      <div className="space-y-1 my-2">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="font-black text-gray-800 min-w-[20px]">{item.quantity}×</span>
                            <div>
                              <span className="font-semibold text-gray-800 text-sm">{item.name}</span>
                              {item.modifiers.length > 0 && (
                                <div className="text-xs text-gray-500">
                                  {item.modifiers.map(m => m.itemName).join(', ')}
                                </div>
                              )}
                              {item.notes && <div className="text-xs text-amber-600 italic">{item.notes}</div>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="text-xs bg-yellow-100 text-yellow-800 rounded px-2 py-1 mb-2">
                          📝 {order.notes}
                        </div>
                      )}

                      {cfg.next && (
                        <button
                          onClick={() => advance(order)}
                          className={`w-full py-2 rounded-lg text-white text-sm font-bold mt-1 transition-all ${cfg.btn}`}
                        >
                          {cfg.nextLabel}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
