import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { Discount } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function DiscountManager() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);

  const [form, setForm] = useState({ name: '', type: 'percent' as 'percent' | 'fixed', value: '', code: '', minOrder: '0' });

  const load = () => db.discounts.toArray().then(setDiscounts);
  useEffect(() => { load(); }, []);

  const openModal = (d?: Discount) => {
    if (d) {
      setEditing(d);
      setForm({ name: d.name, type: d.type, value: String(d.value), code: d.code, minOrder: String(d.minOrder) });
    } else {
      setEditing(null);
      setForm({ name: '', type: 'percent', value: '', code: '', minOrder: '0' });
    }
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !session) return;
    const data: Omit<Discount, 'id' | 'usageCount'> = {
      name: form.name,
      type: form.type,
      value: parseFloat(form.value) || 0,
      code: form.code.toUpperCase(),
      minOrder: parseFloat(form.minOrder) || 0,
      active: true,
    };
    if (editing) {
      await db.discounts.update(editing.id!, { ...data, active: editing.active, usageCount: editing.usageCount });
      await logActivity(session.id, session.name, session.role, 'discount', 'Discount Updated', data.name);
    } else {
      await db.discounts.add({ ...data, usageCount: 0 });
      await logActivity(session.id, session.name, session.role, 'discount', 'Discount Added', data.name);
    }
    setModal(false);
    load();
  };

  const toggle = async (d: Discount) => {
    await db.discounts.update(d.id!, { active: !d.active });
    if (session) await logActivity(session.id, session.name, session.role, 'discount',
      d.active ? 'Discount Disabled' : 'Discount Enabled', d.name);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !session) return;
    await db.discounts.delete(deleteTarget.id!);
    await logActivity(session.id, session.name, session.role, 'discount', 'Discount Deleted', deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Discounts & Promos</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">
          <Plus className="w-4 h-4" /> Add Discount
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {discounts.map(d => (
          <div key={d.id} className={`bg-white rounded-2xl shadow-sm border p-5 ${d.active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Tag className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => openModal(d)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteTarget(d)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="font-bold text-gray-800 text-lg">{d.name}</h3>
            <div className="text-2xl font-black text-amber-500 mt-1">
              {d.type === 'percent' ? `${d.value}%` : `${currencySymbol} ${d.value}`} off
            </div>
            {d.code && (
              <div className="mt-2 inline-block px-2 py-0.5 bg-gray-100 rounded font-mono text-sm text-gray-700">{d.code}</div>
            )}
            {d.minOrder > 0 && (
              <div className="text-xs text-gray-400 mt-1">Min order: {currencySymbol} {d.minOrder}</div>
            )}
            <div className="text-xs text-gray-400 mt-1">Used {d.usageCount} times</div>

            <button onClick={() => toggle(d)} className={`mt-3 flex items-center gap-1.5 text-xs font-medium transition-all ${d.active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}>
              {d.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {d.active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
        {discounts.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No discounts yet. Create one to offer deals to customers.</p>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Discount' : 'Add Discount'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Discount Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Happy Hour"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Type</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[{ v: 'percent', l: '% Percent' }, { v: 'fixed', l: `${currencySymbol} Fixed` }].map(t => (
                <button key={t.v} onClick={() => setForm(f => ({ ...f, type: t.v as 'percent' | 'fixed' }))}
                  className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${form.type === t.v ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600'}`}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Value *</label>
              <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={form.type === 'percent' ? '10' : '100'}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Min Order ({currencySymbol})</label>
              <input type="number" value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700">Code (optional)</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="HAPPY10"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 uppercase" />
            </div>
          </div>
          <button onClick={save} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            {editing ? 'Save Changes' : 'Add Discount'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Discount"
        message={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" danger
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
