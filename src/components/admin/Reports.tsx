import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Banknote, CreditCard, ShoppingBag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Order } from '../../types';

type Period = 'today' | 'week' | 'month' | 'custom';

export default function Reports() {
  const [period, setPeriod] = useState<Period>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const load = useCallback(async () => {
    const now = new Date();
    let startDate = '';
    let endDate = now.toISOString().split('T')[0];

    if (period === 'today') {
      startDate = endDate;
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split('T')[0];
    } else if (period === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = d.toISOString().split('T')[0];
    } else {
      startDate = from;
      endDate = to;
    }

    if (!startDate) return;
    // Count all revenue orders: payment received (method not 'pending') and not voided
    const all = await db.orders
      .filter(o =>
        !!o.paymentMethod && o.paymentMethod !== 'pending' &&
        o.status !== 'voided' && o.status !== 'open' &&
        o.createdAt >= startDate && o.createdAt <= endDate + 'T23:59:59'
      )
      .toArray();
    setOrders(all);
  }, [period, from, to]);

  useEffect(() => { load(); }, [load]);

  const totalSales = orders.reduce((s, o) => s + o.total, 0);
  const totalCash = orders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0);
  const totalCard = orders.filter(o => o.paymentMethod === 'card').reduce((s, o) => s + o.total, 0);
  const avgOrder = orders.length ? Math.round(totalSales / orders.length) : 0;
  const totalDiscounts = orders.reduce((s, o) => s + o.discountAmount, 0);

  // Daily breakdown
  const dayMap: Record<string, { sales: number; orders: number }> = {};
  orders.forEach(o => {
    const day = o.createdAt.split('T')[0];
    if (!dayMap[day]) dayMap[day] = { sales: 0, orders: 0 };
    dayMap[day].sales += o.total;
    dayMap[day].orders += 1;
  });
  const dailyData = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date: formatDate(date), ...v }));

  // Items sold
  const itemMap: Record<string, { qty: number; revenue: number }> = {};
  orders.forEach(o => o.items.forEach(i => {
    if (!itemMap[i.name]) itemMap[i.name] = { qty: 0, revenue: 0 };
    itemMap[i.name].qty += i.quantity;
    itemMap[i.name].revenue += i.subtotal;
  }));
  const topItems = Object.entries(itemMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const pieData = [
    { name: 'Cash', value: totalCash, color: '#16a34a' },
    { name: 'Card', value: totalCard, color: '#0ea5e9' },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        {(['today', 'week', 'month', 'custom'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${period === p ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p === 'today' ? 'Today' : p === 'week' ? 'Last 7 Days' : p === 'month' ? 'This Month' : 'Custom Range'}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <span className="text-gray-400">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(totalSales), icon: TrendingUp, color: 'bg-amber-500' },
          { label: 'Cash Sales', value: fmt(totalCash), icon: Banknote, color: 'bg-green-500' },
          { label: 'Card Sales', value: fmt(totalCard), icon: CreditCard, color: 'bg-blue-500' },
          { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'bg-purple-500' },
          { label: 'Avg Order', value: fmt(avgOrder), icon: TrendingUp, color: 'bg-orange-500' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className={`${c.color} w-9 h-9 rounded-xl flex items-center justify-center mb-2`}>
              <c.icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-xl font-bold text-gray-800">{c.value}</div>
            <div className="text-xs text-gray-400">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Daily Sales Breakdown</h3>
          {dailyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-300">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmt(Number(v)), 'Sales']} />
                <Bar dataKey="sales" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment Split */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Payment Split</h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-300">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [fmt(Number(v))]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Items Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Top Selling Items</h3>
          {totalDiscounts > 0 && (
            <span className="text-sm text-gray-500">Total Discounts Given: <strong>{fmt(totalDiscounts)}</strong></span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Rank', 'Item', 'Qty Sold', 'Revenue', '% of Total'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {topItems.map((item, i) => (
              <tr key={item.name} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3 text-gray-600">{item.qty}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{fmt(item.revenue)}</td>
                <td className="px-4 py-3 text-gray-500">{totalSales ? Math.round((item.revenue / totalSales) * 100) : 0}%</td>
              </tr>
            ))}
            {topItems.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">No sales data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
