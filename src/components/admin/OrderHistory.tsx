import { useState, useEffect } from 'react';
import { Search, Eye, Bike, Utensils, ShoppingBag, Lock } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { formatDateTime, formatCurrency } from '../../utils/format';
import type { Order, OrderStatus } from '../../types';
import ReceiptModal from '../cashier/ReceiptModal';

const ORDER_TYPE_ICONS: Record<string, React.ReactNode> = {
  'dine-in': <Utensils className="w-3 h-3" />,
  'takeaway': <ShoppingBag className="w-3 h-3" />,
  'delivery': <Bike className="w-3 h-3" />,
};

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'dine-in' | 'takeaway' | 'delivery'>('all');
  const [filterDate, setFilterDate] = useState('');
  const [viewReceipt, setViewReceipt] = useState<number | null>(null);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const all = await db.orders.orderBy('createdAt').reverse().limit(200).toArray();
    setOrders(all);
  };

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchType = filterType === 'all' || o.orderType === filterType;
    const matchDate = !filterDate || o.createdAt.startsWith(filterDate);
    const matchSearch = !search ||
      String(o.id).includes(search) ||
      o.tableName?.toLowerCase().includes(search.toLowerCase()) ||
      o.userName?.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchType && matchDate && matchSearch;
  });

  const statusBadge = (s: OrderStatus) => {
    const map: Record<OrderStatus, string> = {
      open: 'bg-blue-100 text-blue-700',
      preparing: 'bg-yellow-100 text-yellow-700',
      ready: 'bg-green-100 text-green-700',
      served: 'bg-gray-100 text-gray-600',
      'pending-payment': 'bg-orange-100 text-orange-700',
      paid: 'bg-purple-100 text-purple-700',
      voided: 'bg-red-100 text-red-600',
    };
    const label = s === 'pending-payment' ? 'Pending Payment' : s;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[s] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Order History</h1>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
          <Lock className="w-3 h-3" /> Read-only — records cannot be altered
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by #, table, staff, customer..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as OrderStatus | 'all')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
          <option value="all">All Status</option>
          {(['open','preparing','ready','served','pending-payment','paid','voided'] as OrderStatus[]).map(s => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value as typeof filterType)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
          <option value="all">All Types</option>
          <option value="dine-in">Dine In</option>
          <option value="takeaway">Takeaway</option>
          <option value="delivery">Delivery</option>
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
        <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterType('all'); setFilterDate(''); }}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
          Clear
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Shown', value: filtered.length },
          { label: 'Revenue', value: fmt(filtered.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0)) },
          { label: 'Paid', value: filtered.filter(o => o.status === 'paid').length },
          { label: 'Voided', value: filtered.filter(o => o.status === 'voided').length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
            <div className="text-lg font-bold text-gray-800">{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['#', 'Date & Time', 'Type', 'Table / Customer', 'Staff', 'Items', 'Total', 'Payment', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-700">#{o.id}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    {o.orderType && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize
                        ${o.orderType === 'dine-in' ? 'bg-amber-100 text-amber-700' :
                          o.orderType === 'takeaway' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'}`}>
                        {ORDER_TYPE_ICONS[o.orderType]} {o.orderType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    <div>{o.tableName || '-'}</div>
                    {o.customerName && <div className="text-xs text-amber-600">{o.customerName}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.userName}</td>
                  <td className="px-4 py-3 text-gray-500">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(o.total)}</td>
                  <td className="px-4 py-3">
                    {o.paymentMethod && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                        ${o.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' :
                          o.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'}`}>
                        {o.paymentMethod}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{statusBadge(o.status)}</td>
                  <td className="px-4 py-3">
                    {o.status === 'paid' && (
                      <button onClick={() => setViewReceipt(o.id!)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600" title="View Receipt">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No orders found</div>
          )}
        </div>
      </div>

      {viewReceipt && <ReceiptModal orderId={viewReceipt} onClose={() => setViewReceipt(null)} />}
    </div>
  );
}
