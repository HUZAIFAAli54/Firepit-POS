import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Search, Star, Trash2, Upload, CheckCircle } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatDate, formatCurrency } from '../../utils/format';
import type { Customer } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import toast from 'react-hot-toast';

export default function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [pointsModal, setPointsModal] = useState<Customer | null>(null);
  const [pointsAdjust, setPointsAdjust] = useState('');
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [importModal, setImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<{ name: string; phone: string; email: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const all = await db.customers.orderBy('name').toArray();
    setCustomers(all);
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const openModal = (c?: Customer) => {
    if (c) {
      setEditing(c);
      setForm({ name: c.name, phone: c.phone, email: c.email, notes: c.notes });
    } else {
      setEditing(null);
      setForm({ name: '', phone: '', email: '', notes: '' });
    }
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !session) return;
    if (editing) {
      await db.customers.update(editing.id!, { ...form });
      await logActivity(session.id, session.name, session.role, 'customer', 'Customer Updated', form.name);
    } else {
      await db.customers.add({
        ...form, points: 0, totalOrders: 0, totalSpent: 0,
        createdAt: new Date().toISOString(),
      });
      await logActivity(session.id, session.name, session.role, 'customer', 'Customer Added', form.name);
    }
    setModal(false);
    load();
  };

  const adjustPoints = async () => {
    if (!pointsModal || !session) return;
    const delta = parseInt(pointsAdjust) || 0;
    const newPoints = Math.max(0, (pointsModal.points || 0) + delta);
    await db.customers.update(pointsModal.id!, { points: newPoints });
    await logActivity(session.id, session.name, session.role, 'customer', 'Points Adjusted',
      `${pointsModal.name}: ${delta > 0 ? '+' : ''}${delta} pts → ${newPoints}`);
    setPointsModal(null);
    setPointsAdjust('');
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !session) return;
    await db.customers.delete(deleteTarget.id!);
    await logActivity(session.id, session.name, session.role, 'customer', 'Customer Deleted', deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      // Auto-detect header row
      const start = lines[0].toLowerCase().includes('name') ? 1 : 0;
      const parsed = lines.slice(start).map(line => {
        const cols = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
        return { name: cols[0] || '', phone: cols[1] || '', email: cols[2] || '' };
      }).filter(r => r.name);
      setImportPreview(parsed);
      setImportModal(true);
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!session || importing) return;
    setImporting(true);
    try {
      const now = new Date().toISOString();
      let added = 0;
      for (const row of importPreview) {
        // Skip if phone already exists
        const existing = row.phone ? await db.customers.where('phone').equals(row.phone).first() : null;
        if (!existing) {
          await db.customers.add({
            name: row.name,
            phone: row.phone,
            email: row.email,
            notes: '',
            points: 0,
            totalOrders: 0,
            totalSpent: 0,
            createdAt: now,
          });
          added++;
        }
      }
      await logActivity(session.id, session.name, session.role, 'customer', 'Bulk Import',
        `${added} customers imported from CSV`);
      toast.success(`${added} customers imported successfully!`);
      setImportModal(false);
      setImportPreview([]);
      load();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Customers & Loyalty</h1>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-amber-400 text-gray-600 hover:text-amber-700 rounded-xl font-medium transition-all">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVFile} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total Customers', value: customers.length },
          { label: 'Total Points Issued', value: customers.reduce((s, c) => s + (c.points || 0), 0).toLocaleString() },
          { label: 'Total Customer Spend', value: fmt(customers.reduce((s, c) => s + (c.totalSpent || 0), 0)) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Customer', 'Phone', 'Points', 'Orders', 'Total Spent', 'Member Since', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-sm shrink-0">
                      {c.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{c.name}</div>
                      {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.phone || '-'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => { setPointsModal(c); setPointsAdjust(''); }}
                    className="flex items-center gap-1 font-bold text-amber-600 hover:underline">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {c.points || 0}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.totalOrders || 0}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{fmt(c.totalSpent || 0)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openModal(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
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
            {search ? 'No customers match your search' : 'No customers yet'}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Customer' : 'Add Customer'} size="sm">
        <div className="space-y-4">
          {[
            { key: 'name', label: 'Full Name *', type: 'text' },
            { key: 'phone', label: 'Phone', type: 'tel' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'notes', label: 'Notes', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-sm font-medium text-gray-700">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          ))}
          <button onClick={save} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            {editing ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </Modal>

      {/* Points Adjust Modal */}
      <Modal open={!!pointsModal} onClose={() => setPointsModal(null)} title={`Adjust Points — ${pointsModal?.name}`} size="sm">
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-black text-amber-500">{pointsModal?.points || 0}</div>
            <div className="text-sm text-gray-400">current points</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Adjustment (use - to deduct)</label>
            <input type="number" value={pointsAdjust} onChange={e => setPointsAdjust(e.target.value)}
              placeholder="e.g. +50 or -100"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 text-center text-xl font-bold" />
          </div>
          {pointsAdjust && (
            <div className="text-center text-sm text-gray-500">
              New balance: <strong className="text-amber-600">{Math.max(0, (pointsModal?.points || 0) + (parseInt(pointsAdjust) || 0))} pts</strong>
            </div>
          )}
          <button onClick={adjustPoints} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            Apply Adjustment
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Customer"
        message={`Delete ${deleteTarget?.name}? Their order history will be kept.`}
        confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {/* CSV Import Modal */}
      <Modal open={importModal} onClose={() => { setImportModal(false); setImportPreview([]); }}
        title="Import Customers from CSV" size="sm">
        <div className="space-y-4">
          <div className="text-sm text-gray-500 bg-blue-50 rounded-lg p-3 border border-blue-100">
            <strong>CSV Format:</strong> Name, Phone, Email (one customer per line)<br />
            Header row is auto-detected. Duplicate phone numbers will be skipped.
          </div>
          <div className="text-sm font-semibold text-gray-700">
            Preview: <span className="text-amber-600">{importPreview.length} contacts found</span>
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y">
            {importPreview.slice(0, 20).map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <div>
                  <span className="font-medium text-gray-800">{r.name}</span>
                  {r.phone && <span className="text-gray-400 ml-2">{r.phone}</span>}
                  {r.email && <span className="text-gray-400 ml-2">{r.email}</span>}
                </div>
              </div>
            ))}
            {importPreview.length > 20 && (
              <div className="px-3 py-2 text-sm text-gray-400">+{importPreview.length - 20} more...</div>
            )}
          </div>
          <button onClick={confirmImport} disabled={importing || importPreview.length === 0}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold">
            {importing ? 'Importing...' : `Import ${importPreview.length} Customers`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
