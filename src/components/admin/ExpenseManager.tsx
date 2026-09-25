import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Search, TrendingDown, Calendar, Filter } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatCurrency } from '../../utils/format';
import type { Expense } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Maintenance', 'Marketing', 'Supplies', 'Other'];
const PAID_VIA = ['Cash', 'Bank Transfer', 'Card', 'Cheque', 'Online'];

const CAT_COLORS: Record<string, string> = {
  Rent:        'bg-red-100 text-red-700',
  Utilities:   'bg-orange-100 text-orange-700',
  Salaries:    'bg-purple-100 text-purple-700',
  Maintenance: 'bg-yellow-100 text-yellow-700',
  Marketing:   'bg-blue-100 text-blue-700',
  Supplies:    'bg-teal-100 text-teal-700',
  Other:       'bg-gray-100 text-gray-700',
};

type Range = 'today' | 'week' | 'month' | 'all';

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ExpenseManager() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [range, setRange] = useState<Range>('month');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);
  const fileRef = useRef<HTMLInputElement>(null);

  const emptyForm = {
    category: 'Rent',
    description: '',
    amount: '',
    date: toYMD(new Date()),
    paidVia: 'Cash',
    paidTo: '',
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const all = await db.expenses.orderBy('date').reverse().toArray();
    setExpenses(all);
  };

  useEffect(() => { load(); }, []);

  const rangeFiltered = expenses.filter(e => {
    const d = new Date(e.date);
    const now = new Date();
    if (range === 'today') return e.date === toYMD(now);
    if (range === 'week') {
      const week = new Date(now);
      week.setDate(now.getDate() - 7);
      return d >= week;
    }
    if (range === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const filtered = rangeFiltered.filter(e => {
    const matchCat = filterCat === 'all' || e.category === filterCat;
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.paidTo.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const byCategory = CATEGORIES.map(cat => ({
    cat,
    total: rangeFiltered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(x => x.total > 0);

  const openModal = (e?: Expense) => {
    if (e) {
      setEditing(e);
      setForm({
        category: e.category,
        description: e.description,
        amount: String(e.amount),
        date: e.date,
        paidVia: e.paidVia,
        paidTo: e.paidTo,
        notes: e.notes,
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setModal(true);
  };

  const save = async () => {
    if (!form.description.trim() || !form.amount || !session) return;
    const data: Omit<Expense, 'id'> = {
      category: form.category,
      description: form.description.trim(),
      amount: parseFloat(form.amount) || 0,
      date: form.date,
      paidVia: form.paidVia,
      paidTo: form.paidTo.trim(),
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
      createdBy: session.name,
    };
    if (editing) {
      await db.expenses.update(editing.id!, data);
      await logActivity(session.id, session.name, session.role, 'expense', 'Expense Updated', `${data.category}: ${data.description} — ${fmt(data.amount)}`);
    } else {
      await db.expenses.add(data);
      await logActivity(session.id, session.name, session.role, 'expense', 'Expense Added', `${data.category}: ${data.description} — ${fmt(data.amount)}`);
    }
    setModal(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !session) return;
    await db.expenses.delete(deleteTarget.id!);
    await logActivity(session.id, session.name, session.role, 'expense', 'Expense Deleted', deleteTarget.description);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Expense Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track bills, rent, salaries & all outgoings</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium shadow-sm">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Date range tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(['today', 'week', 'month', 'all'] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${range === r ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {r === 'week' ? 'Last 7 Days' : r === 'all' ? 'All Time' : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="col-span-2 sm:col-span-1 bg-red-50 border border-red-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase">Total</span>
          </div>
          <div className="text-2xl font-black text-red-700">{fmt(total)}</div>
          <div className="text-xs text-red-400 mt-0.5">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        {byCategory.slice(0, 3).map(x => (
          <div key={x.cat} className="bg-white border border-gray-100 rounded-2xl p-4">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[x.cat] || 'bg-gray-100 text-gray-700'}`}>{x.cat}</span>
            <div className="text-xl font-bold text-gray-800 mt-2">{fmt(x.total)}</div>
          </div>
        ))}
      </div>

      {/* By category breakdown */}
      {byCategory.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
          <div className="text-sm font-semibold text-gray-600 mb-3">By Category</div>
          <div className="space-y-2">
            {byCategory.map(x => (
              <div key={x.cat} className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-24 text-center shrink-0 ${CAT_COLORS[x.cat] || 'bg-gray-100 text-gray-700'}`}>{x.cat}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-red-400 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (x.total / total) * 100)}%` }} />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-24 text-right">{fmt(x.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search description or paid to..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Expense table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Category', 'Description', 'Paid To', 'Paid Via', 'Amount', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{e.date}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[e.category] || 'bg-gray-100 text-gray-700'}`}>{e.category}</span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{e.description}</td>
                <td className="px-4 py-3 text-gray-500">{e.paidTo || '-'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.paidVia}</td>
                <td className="px-4 py-3 font-bold text-red-600">{fmt(e.amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openModal(e)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {search || filterCat !== 'all' ? 'No expenses match your filters' : 'No expenses recorded yet'}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Expense' : 'Add Expense'} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Description *</label>
            <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. Monthly office rent"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Paid Via</label>
              <select value={form.paidVia} onChange={e => setForm(p => ({ ...p, paidVia: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200">
                {PAID_VIA.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Paid To</label>
            <input type="text" value={form.paidTo} onChange={e => setForm(p => ({ ...p, paidTo: e.target.value }))}
              placeholder="e.g. Landlord name"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          <button onClick={save} className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold">
            {editing ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Expense"
        message={`Delete "${deleteTarget?.description}"? This cannot be undone.`}
        confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <input ref={fileRef} type="file" accept=".csv" className="hidden" />
    </div>
  );
}
