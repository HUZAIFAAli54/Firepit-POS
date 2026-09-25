import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Shield, User, ToggleLeft, ToggleRight, KeyRound, ChefHat, UtensilsCrossed, Sparkles } from 'lucide-react';
import { db, hashPin } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatDateTime } from '../../utils/format';
import type { User as UserType, UserRole } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

const ALL_ROLES: { value: UserRole; label: string; color: string; bg: string }[] = [
  { value: 'admin',       label: 'Admin',       color: 'text-purple-700', bg: 'bg-purple-500' },
  { value: 'cashier',     label: 'Cashier',     color: 'text-amber-700',  bg: 'bg-amber-500'  },
  { value: 'manager',     label: 'Manager',     color: 'text-blue-700',   bg: 'bg-blue-500'   },
  { value: 'waiter',      label: 'Waiter',      color: 'text-green-700',  bg: 'bg-green-500'  },
  { value: 'chef',        label: 'Chef',        color: 'text-orange-700', bg: 'bg-orange-500' },
  { value: 'kitchen-boy', label: 'Kitchen Boy', color: 'text-red-700',    bg: 'bg-red-500'    },
  { value: 'cleaner',     label: 'Cleaner',     color: 'text-gray-700',   bg: 'bg-gray-500'   },
];

const POS_ROLES: UserRole[] = ['admin', 'cashier'];

function RoleIcon({ role }: { role: UserRole }) {
  const cls = 'w-6 h-6';
  if (role === 'admin')       return <Shield className={cls} />;
  if (role === 'chef')        return <ChefHat className={cls} />;
  if (role === 'waiter')      return <UtensilsCrossed className={cls} />;
  if (role === 'kitchen-boy') return <ChefHat className={cls} />;
  if (role === 'cleaner')     return <Sparkles className={cls} />;
  if (role === 'manager')     return <Shield className={cls} />;
  return <User className={cls} />;
}

function roleBg(role: UserRole) {
  return ALL_ROLES.find(r => r.value === role)?.bg ?? 'bg-gray-500';
}

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  admin:         'bg-purple-100 text-purple-700',
  cashier:       'bg-amber-100 text-amber-700',
  manager:       'bg-blue-100 text-blue-700',
  waiter:        'bg-green-100 text-green-700',
  chef:          'bg-orange-100 text-orange-700',
  'kitchen-boy': 'bg-red-100 text-red-700',
  cleaner:       'bg-gray-100 text-gray-700',
};

function RoleBadge({ role }: { role: UserRole }) {
  const label = ALL_ROLES.find(r => r.value === role)?.label ?? role;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE_CLASSES[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  );
}

export default function StaffManager() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [modal, setModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [editing, setEditing] = useState<UserType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);
  const session = useAppStore(s => s.session);

  const [form, setForm] = useState({ name: '', role: 'cashier' as UserRole, pin: '', confirmPin: '' });
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [formError, setFormError] = useState('');

  const load = () => db.users.toArray().then(setUsers);
  useEffect(() => { load(); }, []);

  const openModal = (user?: UserType) => {
    setFormError('');
    if (user) {
      setEditing(user);
      setForm({ name: user.name, role: user.role, pin: '', confirmPin: '' });
    } else {
      setEditing(null);
      setForm({ name: '', role: 'cashier', pin: '', confirmPin: '' });
    }
    setModal(true);
  };

  const save = async () => {
    setFormError('');
    if (!form.name.trim()) return setFormError('Name is required');
    if (!editing && form.pin.length < 4) return setFormError('PIN must be at least 4 digits');
    if (!editing && form.pin !== form.confirmPin) return setFormError('PINs do not match');
    if (!session) return;

    if (editing) {
      await db.users.update(editing.id!, { name: form.name, role: form.role });
      await logActivity(session.id, session.name, session.role, 'staff', 'Staff Updated', form.name);
    } else {
      const pin = await hashPin(form.pin);
      await db.users.add({ name: form.name, role: form.role, pin, active: true, createdAt: new Date().toISOString() });
      await logActivity(session.id, session.name, session.role, 'staff', 'Staff Added', `${form.name} (${form.role})`);
    }
    setModal(false);
    load();
  };

  const changePin = async () => {
    if (!editing || !session) return;
    setFormError('');
    if (newPin.length < 4) return setFormError('PIN must be at least 4 digits');
    if (newPin !== confirmNewPin) return setFormError('PINs do not match');
    const pin = await hashPin(newPin);
    await db.users.update(editing.id!, { pin });
    await logActivity(session.id, session.name, session.role, 'staff', 'PIN Changed', `PIN changed for ${editing.name}`);
    setPinModal(false);
    setNewPin('');
    setConfirmNewPin('');
    load();
  };

  const toggleActive = async (user: UserType) => {
    if (user.id === session?.id) return;
    await db.users.update(user.id!, { active: !user.active });
    if (session) await logActivity(session.id, session.name, session.role, 'staff',
      user.active ? 'Staff Deactivated' : 'Staff Activated', user.name);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !session) return;
    if (deleteTarget.id === session.id) return;
    await db.users.delete(deleteTarget.id!);
    await logActivity(session.id, session.name, session.role, 'staff', 'Staff Deleted', deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => (
          <div key={user.id} className={`bg-white rounded-2xl shadow-sm border p-5 ${user.active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${roleBg(user.role)}`}>
                <RoleIcon role={user.role} />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditing(user); setNewPin(''); setConfirmNewPin(''); setFormError(''); setPinModal(true); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600"
                  title="Change PIN"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button onClick={() => openModal(user)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                  <Edit className="w-4 h-4" />
                </button>
                {user.id !== session?.id && (
                  <button onClick={() => setDeleteTarget(user)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <h3 className="font-bold text-gray-800">{user.name} {user.id === session?.id && <span className="text-xs text-amber-500">(You)</span>}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <RoleBadge role={user.role} />
              {!POS_ROLES.includes(user.role) && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No POS access</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {user.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {user.lastLogin && (
              <div className="mt-3 text-xs text-gray-400">
                Last login: {formatDateTime(user.lastLogin)}
              </div>
            )}
            <div className="text-xs text-gray-300 mt-0.5">
              Created: {formatDateTime(user.createdAt)}
            </div>

            {user.id !== session?.id && (
              <button
                onClick={() => toggleActive(user)}
                className={`mt-3 flex items-center gap-1.5 text-xs font-medium transition-all ${user.active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
              >
                {user.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {user.active ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Staff' : 'Add Staff'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Full Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <input
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              placeholder="e.g. Manager, Waiter, Chef…"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {['admin', 'cashier', 'manager', 'waiter', 'chef', 'kitchen-boy', 'cleaner'].map(r => (
                <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                  className={`text-xs px-2 py-1 rounded-full border transition-all capitalize ${
                    form.role === r ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-500 hover:border-amber-300'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            {!POS_ROLES.includes(form.role) && form.role.trim() && (
              <p className="text-xs text-gray-400 mt-1.5">This role has no POS login access (only admin/cashier can log in).</p>
            )}
          </div>
          {!editing && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">PIN (min 4 digits) *</label>
                <input type="password" value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))} maxLength={6}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Confirm PIN *</label>
                <input type="password" value={form.confirmPin} onChange={e => setForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '') }))} maxLength={6}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
            </>
          )}
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          <button onClick={save} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            {editing ? 'Save Changes' : 'Add Staff Member'}
          </button>
        </div>
      </Modal>

      {/* Change PIN Modal */}
      <Modal open={pinModal} onClose={() => setPinModal(false)} title={`Change PIN — ${editing?.name}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">New PIN (min 4 digits)</label>
            <input type="password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} maxLength={6}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Confirm New PIN</label>
            <input type="password" value={confirmNewPin} onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, ''))} maxLength={6}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          <button onClick={changePin} className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-semibold">
            Update PIN
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Staff"
        message={`Are you sure you want to delete ${deleteTarget?.name}? Their order history will be preserved.`}
        confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
