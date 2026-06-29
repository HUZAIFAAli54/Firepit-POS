import { useState, useEffect } from 'react';
import { Bike, MapPin, Phone, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatDateTime, formatCurrency } from '../../utils/format';
import type { Order, OrderStatus } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  preparing: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-orange-100 text-orange-700',
  served: 'bg-green-100 text-green-700',
  paid: 'bg-purple-100 text-purple-700',
  voided: 'bg-red-100 text-red-600',
};

const NEXT_STATUS: Record<string, OrderStatus> = {
  open: 'preparing',
  preparing: 'ready',
  ready: 'served',
  served: 'paid',
};

export default function DeliveryManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<'active' | 'all'>('active');
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const load = async () => {
    let list: Order[];
    if (filterStatus === 'active') {
      list = await db.orders
        .where('orderType').equals('delivery')
        .filter(o => ['open', 'preparing', 'ready', 'served'].includes(o.status))
        .reverse()
        .toArray();
    } else {
      list = await db.orders
        .where('orderType').equals('delivery')
        .reverse()
        .limit(100)
        .toArray();
    }
    setOrders(list);
  };

  useEffect(() => { load(); }, [filterStatus]);

  const advance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next || !session) return;
    await db.orders.update(order.id!, { status: next, updatedAt: new Date().toISOString() });
    await logActivity(session.id, session.name, session.role, 'delivery', `Delivery → ${next}`, `Order #${order.id}`);
    load();
  };

  const totalDeliveries = orders.length;
  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
  const activeCount = orders.filter(o => ['open', 'preparing', 'ready', 'served'].includes(o.status)).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Delivery Management</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {['active', 'all'].map(f => (
              <button key={f} onClick={() => setFilterStatus(f as 'active' | 'all')}
                className={`px-3 py-1.5 text-sm font-medium capitalize ${filterStatus === f ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {f === 'active' ? 'Active' : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Active Deliveries', value: activeCount, color: 'text-blue-600' },
          { label: 'Total Shown', value: totalDeliveries, color: 'text-gray-800' },
          { label: 'Delivery Revenue', value: fmt(totalRevenue), color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map(order => {
          const d = order.deliveryInfo;
          const canAdvance = !!NEXT_STATUS[order.status];
          const elapsedMins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
          return (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-gray-800 text-lg">Order #{order.id}</div>
                  <div className="text-xs text-gray-400">{formatDateTime(order.createdAt)} · {elapsedMins}m ago</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                  {order.status}
                </span>
              </div>

              {d && (
                <div className="space-y-1.5 mb-3 text-sm bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 font-semibold text-gray-800">
                    <Bike className="w-4 h-4 text-green-500" />
                    {d.customerName || order.customerName}
                  </div>
                  {d.phone && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Phone className="w-3.5 h-3.5" /> {d.phone}
                    </div>
                  )}
                  {d.address && (
                    <div className="flex items-start gap-2 text-gray-500">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {d.address}{d.area ? `, ${d.area}` : ''}
                    </div>
                  )}
                  {d.estimatedMinutes > 0 && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-3.5 h-3.5" /> ETA: {d.estimatedMinutes} mins
                    </div>
                  )}
                  {d.riderName && (
                    <div className="text-gray-500 text-xs">Rider: <strong>{d.riderName}</strong></div>
                  )}
                </div>
              )}

              <div className="text-xs text-gray-500 mb-3">
                {order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="text-sm">
                  <span className="text-gray-400">Items: </span>
                  <span className="font-bold">{fmt(order.subtotal)}</span>
                  {(d?.deliveryFee ?? order.deliveryFee) > 0 && (
                    <>
                      <span className="text-gray-400 mx-1">+ Fee:</span>
                      <span className="font-bold">{fmt(d?.deliveryFee ?? order.deliveryFee)}</span>
                    </>
                  )}
                </div>
                <div className="text-base font-black text-amber-600">{fmt(order.total)}</div>
              </div>

              {canAdvance && (
                <button onClick={() => advance(order)}
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all">
                  → Mark as {NEXT_STATUS[order.status]}
                </button>
              )}
              {order.status === 'paid' && (
                <div className="flex items-center justify-center gap-1.5 text-green-600 text-sm font-semibold py-2">
                  <CheckCircle className="w-4 h-4" /> Delivered & Paid
                </div>
              )}
            </div>
          );
        })}
        {orders.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Bike className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{filterStatus === 'active' ? 'No active deliveries' : 'No delivery orders found'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
