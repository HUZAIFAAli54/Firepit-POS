import { useState, useEffect } from 'react';
import { Search, RefreshCw, Shield, User } from 'lucide-react';
import { db } from '../../db/database';
import { formatDateTime } from '../../utils/format';
import type { ActivityLog as LogType, LogCategory } from '../../types';

const categoryColors: Record<LogCategory, string> = {
  auth:      'bg-blue-100 text-blue-700',
  order:     'bg-green-100 text-green-700',
  menu:      'bg-amber-100 text-amber-700',
  staff:     'bg-purple-100 text-purple-700',
  settings:  'bg-gray-100 text-gray-700',
  shift:     'bg-orange-100 text-orange-700',
  inventory: 'bg-teal-100 text-teal-700',
  discount:  'bg-pink-100 text-pink-700',
  customer:  'bg-cyan-100 text-cyan-700',
  delivery:  'bg-emerald-100 text-emerald-700',
  expense:   'bg-red-100 text-red-700',
  supplier:  'bg-indigo-100 text-indigo-700',
};

export default function ActivityLog() {
  const [logs, setLogs] = useState<LogType[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<LogCategory | 'all'>('all');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'cashier'>('all');

  const load = async () => {
    const all = await db.activityLogs.orderBy('timestamp').reverse().limit(500).toArray();
    setLogs(all);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l => {
    const matchCat = filterCat === 'all' || l.category === filterCat;
    const matchRole = filterRole === 'all' || l.role === filterRole;
    const matchSearch = !search ||
      l.userName.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchRole && matchSearch;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Activity Logs</h1>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value as LogCategory | 'all')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
          <option value="all">All Categories</option>
          {(['auth','order','menu','staff','settings','shift','inventory','discount'] as LogCategory[]).map(c => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value as 'all' | 'admin' | 'cashier')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="cashier">Cashier</option>
        </select>
      </div>

      <div className="text-xs text-gray-400 mb-3">{filtered.length} log entries</div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Timestamp', 'User', 'Role', 'Category', 'Action', 'Details'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{formatDateTime(log.timestamp)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {log.role === 'admin'
                        ? <Shield className="w-3.5 h-3.5 text-purple-500" />
                        : <User className="w-3.5 h-3.5 text-amber-500" />}
                      <span className="font-medium text-gray-700">{log.userName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                      {log.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${categoryColors[log.category]}`}>
                      {log.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{log.action}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No log entries found</div>
          )}
        </div>
      </div>
    </div>
  );
}
