import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Bike, Phone, ToggleLeft, ToggleRight } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { Rider } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

const VEHICLE_TYPES = ['Motorcycle', 'Bicycle', 'Car', 'Van', 'Rickshaw', 'Other'];

export default function RiderManager() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Rider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rider | null>(null);
  const session = useAppStore(s => s.session);

  const emptyForm = { name: '', phone: '', vehicleType: 'Motorcycle', vehicleNumber: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const all = await db.riders.toArray();
    setRiders(all);
  };

  useEffect(() => { load(); }, []);

  const filtered = riders.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.phone.includes(search) ||
    r.vehicleNumber.toLowerCase().includes(search.toLowerCase())
  );

  const openModal = (r?: Rider) => {
    if (r) {
      setEditing(r);
      setForm({ name: r.name, phone: r.phone, vehicleType: r.vehicleType, vehicleNumber: r.vehicleNumber });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !session) return;
    if (editing) {
      await db.riders.update(editing.id!, { ...form });
      await logActivity(session.id, session.name, session.role, 'delivery', 'Rider Updated', form.name);
    } else {
      await db.riders.add({
        ...form,
        active: true,
        totalDeliveries: 0,
        createdAt: new Date().toISOString(),
      });
      await logActivity(session.id, session.name, session.role, 'delivery', 'Rider Added', form.name);
    }
    setModal(false);
    load();
  };

  const toggleActive = async (rider: Rider) => {
    if (!session) return;
    const newActive = !rider.active;
    await db.riders.update(rider.id!, { active: newActive });
    await logActivity(session.id, session.name, session.role, 'delivery', newActive ? 'Rider Activated' : 'Rider Deactivated', rider.name);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !session) return;
    await db.riders.delete(deleteTarget.id!);
    await logActivity(session.id, session.name, session.role, 'delivery', 'Rider Deleted', deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  const activeCount = riders.filter(r => r.active).length;
  const totalDeliveries = riders.reduce((s, r) => s + (r.totalDeliveries || 0), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Rider Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage delivery riders & assignments</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium shadow-sm">
          <Plus className="w-4 h-4" /> Add Rider
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Riders', value: riders.length },
          { label: 'Active Riders', value: activeCount },
          { label: 'Total Deliveries', value: totalDeliveries },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search riders..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 bg-white" />
      </div>

      {/* Rider cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(r => (
          <div key={r.id} className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all ${r.active ? 'border-green-200' : 'border-gray-100 opacity-70'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.active ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Bike className={`w-6 h-6 ${r.active ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <div className="font-bold text-gray-800">{r.name}</div>
                  <div className="text-xs text-gray-400">{r.vehicleType}</div>
                </div>
              </div>
              <button onClick={() => toggleActive(r)}
                className={`transition-colors ${r.active ? 'text-green-500 hover:text-green-700' : 'text-gray-300 hover:text-gray-500'}`}
                title={r.active ? 'Deactivate rider' : 'Activate rider'}>
                {r.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>

            <div className="space-y-1 text-sm mb-4">
              {r.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {r.phone}
                </div>
              )}
              {r.vehicleNumber && (
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{r.vehicleNumber}</span>
                </div>
              )}
              <div className="text-xs text-gray-400">
                {r.totalDeliveries || 0} deliveries completed
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => openModal(r)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 transition-all flex items-center justify-center gap-1">
                <Edit className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => setDeleteTarget(r)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 transition-all flex items-center justify-center gap-1">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Bike className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{search ? 'No riders match your search' : 'No riders added yet'}</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Rider' : 'Add Rider'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Full Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Rider name"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="0300-0000000"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Vehicle Type</label>
              <select value={form.vehicleType} onChange={e => setForm(p => ({ ...p, vehicleType: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200">
                {VEHICLE_TYPES.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Vehicle / Reg. No.</label>
              <input type="text" value={form.vehicleNumber} onChange={e => setForm(p => ({ ...p, vehicleNumber: e.target.value }))}
                placeholder="e.g. ABC-123"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
          </div>
          <button onClick={save} className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold">
            {editing ? 'Save Changes' : 'Add Rider'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Remove Rider"
        message={`Remove "${deleteTarget?.name}" from the system? This cannot be undone.`}
        confirmLabel="Remove" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
