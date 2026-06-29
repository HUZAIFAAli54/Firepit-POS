import { useEffect, useState } from 'react';
import {
  TrendingUp, ShoppingBag, Banknote, CreditCard, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency, todayISO, formatTime } from '../../utils/format';
import type { Order } from '../../types';

interface Stats {
  todaySales: number;
  todayOrders: number;
  todayCash: number;
  todayCard: number;
  avgOrder: number;
  activeOrders: number;
  weeklyData: { day: string; sales: number; orders: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  recentOrders: Order[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30000);
    return () => clearInterval(t);
  }, []);

  const loadStats = async () => {
    const today = todayISO();
    const allOrders = await db.orders.toArray();
    const todayOrders = allOrders.filter(o => o.createdAt?.startsWith(today) && o.status !== 'voided');
    const isRevenue = (o: Order) => !!o.paymentMethod && o.paymentMethod !== 'pending' && o.status !== 'voided' && o.status !== 'open';
    const paidToday = todayOrders.filter(isRevenue);
    const active = allOrders.filter(o => ['open', 'preparing', 'ready', 'pending-payment'].includes(o.status));

    const todaySales = paidToday.reduce((s, o) => s + o.total, 0);
    const todayCash = paidToday.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0);
    const todayCard = paidToday.filter(o => o.paymentMethod === 'card').reduce((s, o) => s + o.total, 0);

    // Weekly data
    const weeklyData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split('T')[0];
      const dayOrders = allOrders.filter(o => o.createdAt?.startsWith(key) && isRevenue(o));
      return {
        day: d.toLocaleDateString('en', { weekday: 'short' }),
        sales: dayOrders.reduce((s, o) => s + o.total, 0),
        orders: dayOrders.length,
      };
    });

    // Top items
    const itemMap: Record<string, { qty: number; revenue: number }> = {};
    paidToday.forEach(o => {
      o.items.forEach(item => {
        if (!itemMap[item.name]) itemMap[item.name] = { qty: 0, revenue: 0 };
        itemMap[item.name].qty += item.quantity;
        itemMap[item.name].revenue += item.subtotal;
      });
    });
    const topItems = Object.entries(itemMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const recentOrders = allOrders
      .filter(isRevenue)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);

    setStats({
      todaySales, todayOrders: paidToday.length, todayCash, todayCard,
      avgOrder: paidToday.length ? Math.round(todaySales / paidToday.length) : 0,
      activeOrders: active.length,
      weeklyData, topItems, recentOrders,
    });
  };

  if (!stats) return <div className="p-6 text-gray-500">Loading dashboard...</div>;

  const cards = [
    { label: "Today's Sales", value: fmt(stats.todaySales), icon: TrendingUp, color: 'bg-amber-500', sub: `${stats.todayOrders} orders` },
    { label: 'Cash', value: fmt(stats.todayCash), icon: Banknote, color: 'bg-green-500', sub: 'cash payments' },
    { label: 'Card', value: fmt(stats.todayCard), icon: CreditCard, color: 'bg-blue-500', sub: 'card payments' },
    { label: 'Avg Order', value: fmt(stats.avgOrder), icon: ShoppingBag, color: 'bg-purple-500', sub: 'per transaction' },
    { label: 'Active Orders', value: stats.activeOrders.toString(), icon: Clock, color: 'bg-orange-500', sub: 'in progress' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <span className="text-sm text-gray-400">{new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className={`${c.color} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
              <c.icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-xl font-bold text-gray-800">{c.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
            <div className="text-xs text-gray-300">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Weekly Sales</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.weeklyData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [fmt(Number(v)), 'Sales']} />
              <Bar dataKey="sales" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Top Items Today</h3>
          {stats.topItems.length === 0 ? (
            <p className="text-gray-400 text-sm">No sales today yet</p>
          ) : (
            <div className="space-y-3">
              {stats.topItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.qty} sold</div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{fmt(item.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['#', 'Table', 'Items', 'Total', 'Payment', 'Time', 'Staff'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentOrders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">#{o.id}</td>
                  <td className="px-4 py-2.5 text-gray-600">{o.tableName}</td>
                  <td className="px-4 py-2.5 text-gray-500">{o.items.reduce((s, i) => s + i.quantity, 0)} items</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{fmt(o.total)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {o.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{formatTime(o.completedAt || o.createdAt)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{o.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.recentOrders.length === 0 && (
            <div className="text-center py-8 text-gray-400">No orders yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
