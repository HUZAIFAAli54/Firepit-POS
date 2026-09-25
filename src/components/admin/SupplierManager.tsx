import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, ChevronRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatCurrency } from '../../utils/format';
import type { Supplier, SupplierTransaction } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

type View = 'suppliers' | 'transactions';

const STATUS_COLORS = {
  pending: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid:    'bg-green-100 text-green-700',
};

const SUPPLY_CATEGORIES = [
  'Raw Materials', 'Beverages', 'Dairy', 'Bakery', 'Packaging', 'Cleaning', 'Equipment', 'Other'
];

function toYMD(d: Date) { return d.toISOString().slice(0, 10); }

export default function SupplierManager() {
  const [view, setView] = useState<View>('suppliers');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [txModal, setTxModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [editingTx, setEditingTx] = useState<SupplierTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | SupplierTransaction | null>(null);
  const [deleteTxMode, setDeleteTxMode] = useState(false);
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const emptyForm = { name: '', contactPerson: '', phone: '', category: 'Raw Materials', address: '', notes: '' };
  const emptyTx = {
    description: '', invoiceNumber: '', totalAmount: '',
    paidAmount: '', date: toYMD(new Date()), dueDate: '', notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [txForm, setTxForm] = useState(emptyTx);

  const loadSuppliers = async () => {
    const all = await db.suppliers.orderBy('name').toArray();
    setSuppliers(all);
  };

  const loadTransactions = async (supplierId: number) => {
    const all = await db.supplierTransactions
      .where('supplierId').equals(supplierId)
      .reverse().sortBy('date');
    setTransactions(all);
  };

  useEffect(() => { loadSuppliers(); }, []);

  const openSupplier = (s: Supplier) => {
    setSelectedSupplier(s);
    loadTransactions(s.id!);
    setView('transactions');
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  // ── Supplier CRUD ──────────────────────────────────────────────────────────
  const openSupplierModal = (s?: Supplier) => {
    if (s) {
      setEditing(s);
      setForm({ name: s.name, contactPerson: s.contactPerson, phone: s.phone, category: s.category, address: s.address, notes: s.notes });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setModal(true);
  };

  const saveSupplier = async () => {
    if (!form.name.trim() || !session) return;
    if (editing) {
      await db.suppliers.update(editing.id!, { ...form });
      await logActivity(session.id, session.name, session.role, 'supplier', 'Supplier Updated', form.name);
    } else {
      await db.suppliers.add({ ...form, active: true, createdAt: new Date().toISOString() });
      await logActivity(session.id, session.name, session.role, 'supplier', 'Supplier Added', form.name);
    }
    setModal(false);
    loadSuppliers();
  };

  const deleteSupplier = async () => {
    if (!deleteTarget || !session || deleteTxMode) return;
    const s = deleteTarget as Supplier;
    await db.suppliers.delete(s.id!);
    await db.supplierTransactions.where('supplierId').equals(s.id!).delete();
    await logActivity(session.id, session.name, session.role, 'supplier', 'Supplier Deleted', s.name);
    setDeleteTarget(null);
    loadSuppliers();
  };

  // ── Transaction CRUD ───────────────────────────────────────────────────────
  const openTxModal = (tx?: SupplierTransaction) => {
    if (tx) {
      setEditingTx(tx);
      setTxForm({
        description: tx.description, invoiceNumber: tx.invoiceNumber,
        totalAmount: String(tx.totalAmount), paidAmount: String(tx.paidAmount),
        date: tx.date, dueDate: tx.dueDate, notes: tx.notes,
      });
    } else {
      setEditingTx(null);
      setTxForm(emptyTx);
    }
    setTxModal(true);
  };

  const saveTx = async () => {
    if (!txForm.description.trim() || !txForm.totalAmount || !selectedSupplier || !session) return;
    const total = parseFloat(txForm.totalAmount) || 0;
    const paid = parseFloat(txForm.paidAmount) || 0;
    const status: SupplierTransaction['status'] = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending';
    const data: Omit<SupplierTransaction, 'id'> = {
      supplierId: selectedSupplier.id!,
      supplierName: selectedSupplier.name,
      description: txForm.description.trim(),
      invoiceNumber: txForm.invoiceNumber.trim(),
      totalAmount: total,
      paidAmount: paid,
      date: txForm.date,
      dueDate: txForm.dueDate,
      status,
      notes: txForm.notes.trim(),
      createdAt: new Date().toISOString(),
    };
    if (editingTx) {
      await db.supplierTransactions.update(editingTx.id!, data);
      await logActivity(session.id, session.name, session.role, 'supplier', 'Transaction Updated',
        `${selectedSupplier.name}: ${data.description}`);
    } else {
      await db.supplierTransactions.add(data);
      await logActivity(session.id, session.name, session.role, 'supplier', 'Transaction Added',
        `${selectedSupplier.name}: ${data.description} — Total: ${fmt(total)}, Paid: ${fmt(paid)}`);
    }
    setTxModal(false);
    loadTransactions(selectedSupplier.id!);
  };

  const deleteTx = async () => {
    if (!deleteTarget || !session || !deleteTxMode || !selectedSupplier) return;
    const tx = deleteTarget as SupplierTransaction;
    await db.supplierTransactions.delete(tx.id!);
    await logActivity(session.id, session.name, session.role, 'supplier', 'Transaction Deleted', tx.description);
    setDeleteTarget(null);
    setDeleteTxMode(false);
    loadTransactions(selectedSupplier.id!);
  };

  const txTotal = transactions.reduce((s, t) => s + t.totalAmount, 0);
  const txPaid = transactions.reduce((s, t) => s + t.paidAmount, 0);
  const txBalance = txTotal - txPaid;

  // ── Suppliers List View ───────────────────────────────────────────────────
  if (view === 'suppliers') {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Supplier Records</h1>
            <p className="text-sm text-gray-400 mt-0.5">Track retailers, payments & balances</p>
          </div>
          <button onClick={() => openSupplierModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium shadow-sm">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Suppliers', value: suppliers.length },
            { label: 'Active Suppliers', value: suppliers.filter(s => s.active).length },
            { label: 'Total Balance Due', value: fmt(suppliers.reduce((_, __) => 0, 0)) },
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
          <input type="text" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Supplier', 'Category', 'Phone', 'Contact', 'Transactions', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSuppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openSupplier(s)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {s.name[0].toUpperCase()}
                      </div>
                      <div className="font-semibold text-gray-800">{s.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{s.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.contactPerson || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">Tap to view</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openSupplierModal(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setDeleteTarget(s); setDeleteTxMode(false); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openSupplier(s)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSuppliers.length === 0 && (
            <div className="text-center py-12 text-gray-400">No suppliers found</div>
          )}
        </div>

        {/* Supplier Modal */}
        <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'} size="sm">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Supplier Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  {SUPPLY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Contact Person</label>
              <input type="text" value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Address</label>
              <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <button onClick={saveSupplier} className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold">
              {editing ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </Modal>

        <ConfirmDialog open={!!deleteTarget && !deleteTxMode} title="Delete Supplier"
          message={`Delete supplier "${(deleteTarget as Supplier)?.name}"? All their transaction records will also be deleted.`}
          confirmLabel="Delete" danger onConfirm={deleteSupplier} onCancel={() => setDeleteTarget(null)} />
      </div>
    );
  }

  // ── Transactions View ─────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => { setView('suppliers'); setSelectedSupplier(null); setTransactions([]); }}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Suppliers
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{selectedSupplier?.name}</h1>
          <p className="text-sm text-gray-400">{selectedSupplier?.category} · {selectedSupplier?.phone}</p>
        </div>
        <button onClick={() => openTxModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium">
          <Plus className="w-4 h-4" /> Add Transaction
        </button>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-xl font-bold text-gray-800">{fmt(txTotal)}</div>
          <div className="text-xs text-gray-400">Total Purchased</div>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100 text-center">
          <div className="text-xl font-bold text-green-700">{fmt(txPaid)}</div>
          <div className="text-xs text-green-500">Total Paid</div>
        </div>
        <div className={`rounded-2xl p-4 border text-center ${txBalance > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xl font-bold ${txBalance > 0 ? 'text-red-700' : 'text-gray-700'}`}>{fmt(txBalance)}</div>
          <div className={`text-xs ${txBalance > 0 ? 'text-red-400' : 'text-gray-400'}`}>Balance Due</div>
        </div>
      </div>

      {txBalance > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Outstanding balance of <strong>{fmt(txBalance)}</strong> is due to {selectedSupplier?.name}
        </div>
      )}

      {/* Transactions table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Description', 'Invoice #', 'Total', 'Paid', 'Balance', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map(tx => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs">{tx.date}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{tx.description}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{tx.invoiceNumber || '-'}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{fmt(tx.totalAmount)}</td>
                <td className="px-4 py-3 text-green-700 font-medium">{fmt(tx.paidAmount)}</td>
                <td className={`px-4 py-3 font-bold ${tx.totalAmount - tx.paidAmount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {fmt(tx.totalAmount - tx.paidAmount)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[tx.status]}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openTxModal(tx)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setDeleteTarget(tx); setDeleteTxMode(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <div className="text-center py-12 text-gray-400">No transactions yet — add one above</div>
        )}
      </div>

      {/* Transaction Modal */}
      <Modal open={txModal} onClose={() => setTxModal(false)} title={editingTx ? 'Edit Transaction' : 'Add Transaction'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Description *</label>
            <input type="text" value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. Weekly milk supply"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Invoice Number</label>
              <input type="text" value={txForm.invoiceNumber} onChange={e => setTxForm(p => ({ ...p, invoiceNumber: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Total Amount *</label>
              <input type="number" value={txForm.totalAmount} onChange={e => setTxForm(p => ({ ...p, totalAmount: e.target.value }))}
                placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Amount Paid</label>
              <input type="number" value={txForm.paidAmount} onChange={e => setTxForm(p => ({ ...p, paidAmount: e.target.value }))}
                placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          </div>
          {txForm.totalAmount && txForm.paidAmount && (
            <div className={`text-sm font-semibold p-2 rounded-lg text-center ${
              parseFloat(txForm.paidAmount) >= parseFloat(txForm.totalAmount)
                ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              Balance due: {fmt((parseFloat(txForm.totalAmount) || 0) - (parseFloat(txForm.paidAmount) || 0))}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700">Due Date (optional)</label>
            <input type="date" value={txForm.dueDate} onChange={e => setTxForm(p => ({ ...p, dueDate: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <input type="text" value={txForm.notes} onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <button onClick={saveTx} className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold">
            {editingTx ? 'Save Changes' : 'Add Transaction'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget && deleteTxMode} title="Delete Transaction"
        message={`Delete transaction "${(deleteTarget as SupplierTransaction)?.description}"?`}
        confirmLabel="Delete" danger onConfirm={deleteTx} onCancel={() => { setDeleteTarget(null); setDeleteTxMode(false); }} />
    </div>
  );
}
