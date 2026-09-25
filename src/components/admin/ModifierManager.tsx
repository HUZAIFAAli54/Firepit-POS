import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Link, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { ModifierGroup, MenuItem, ModifierItem } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function ModifierManager() {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [linkedItemIds, setLinkedItemIds] = useState<Record<number, number[]>>({});
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<ModifierGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroup | null>(null);
  const [linkModal, setLinkModal] = useState<ModifierGroup | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);

  const [form, setForm] = useState({
    name: '',
    type: 'single' as 'single' | 'multiple',
    required: false,
    items: [{ name: '', price: 0 }] as ModifierItem[],
  });

  const load = async () => {
    const [g, m, links] = await Promise.all([
      db.modifierGroups.toArray(),
      db.menuItems.toArray(),
      db.menuItemModifiers.toArray(),
    ]);
    setGroups(g);
    setMenuItems(m);
    const map: Record<number, number[]> = {};
    links.forEach(l => {
      if (!map[l.modifierGroupId]) map[l.modifierGroupId] = [];
      map[l.modifierGroupId].push(l.menuItemId);
    });
    setLinkedItemIds(map);
  };

  useEffect(() => { load(); }, []);

  const openModal = (g?: ModifierGroup) => {
    if (g) {
      setEditing(g);
      setForm({ name: g.name, type: g.type, required: g.required, items: [...g.items] });
    } else {
      setEditing(null);
      setForm({ name: '', type: 'single', required: false, items: [{ name: '', price: 0 }] });
    }
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !session) return;
    const validItems = form.items.filter(i => i.name.trim());
    if (editing) {
      await db.modifierGroups.update(editing.id!, { ...form, items: validItems });
      await logActivity(session.id, session.name, session.role, 'menu', 'Modifier Updated', form.name);
    } else {
      await db.modifierGroups.add({ ...form, items: validItems });
      await logActivity(session.id, session.name, session.role, 'menu', 'Modifier Added', form.name);
    }
    setModal(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !session) return;
    await db.modifierGroups.delete(deleteTarget.id!);
    await db.menuItemModifiers.where('modifierGroupId').equals(deleteTarget.id!).delete();
    await logActivity(session.id, session.name, session.role, 'menu', 'Modifier Deleted', deleteTarget.name);
    setDeleteTarget(null);
    load();
  };

  const saveLinks = async (group: ModifierGroup, selectedItemIds: number[]) => {
    if (!session) return;
    await db.menuItemModifiers.where('modifierGroupId').equals(group.id!).delete();
    await db.menuItemModifiers.bulkAdd(
      selectedItemIds.map(menuItemId => ({ menuItemId, modifierGroupId: group.id! }))
    );
    await logActivity(session.id, session.name, session.role, 'menu', 'Modifier Linked',
      `${group.name} linked to ${selectedItemIds.length} items`);
    setLinkModal(null);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Item Modifiers</h1>
          <p className="text-sm text-gray-400 mt-0.5">Add options like Size, Extras, or Removals to menu items</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">
          <Plus className="w-4 h-4" /> New Modifier
        </button>
      </div>

      <div className="space-y-3">
        {groups.map(group => {
          const isExpanded = expanded === group.id;
          const linked = (linkedItemIds[group.id!] ?? []).map(id => menuItems.find(m => m.id === id)?.name).filter(Boolean);
          return (
            <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <button onClick={() => setExpanded(isExpanded ? null : group.id!)} className="p-1 hover:bg-gray-100 rounded">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{group.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.type === 'single' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {group.type === 'single' ? 'Single Select' : 'Multi Select'}
                    </span>
                    {group.required && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Required</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {group.items.length} options · Linked to: {linked.length > 0 ? linked.join(', ') : 'No items'}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setLinkModal(group)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium">
                    <Link className="w-3 h-3" /> Link Items
                  </button>
                  <button onClick={() => openModal(group)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(group)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-4 border-t border-gray-50 pt-3">
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item, i) => (
                      <span key={i} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        {item.name}
                        {item.price > 0 && <span className="text-amber-600 ml-1.5 font-medium">+{currencySymbol}{item.price}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="mb-2">No modifier groups yet.</p>
            <p className="text-sm">Create groups like "Size", "Extras", "Removals" and link them to menu items.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Modifier' : 'New Modifier Group'} size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Group Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Size, Extras, Remove..."
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Selection Type</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {[{ v: 'single', l: 'Choose 1' }, { v: 'multiple', l: 'Choose many' }].map(t => (
                  <button key={t.v} onClick={() => setForm(f => ({ ...f, type: t.v as 'single' | 'multiple' }))}
                    className={`py-2 rounded-lg border-2 text-xs font-medium ${form.type === t.v ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Required?</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(t => (
                  <button key={String(t.v)} onClick={() => setForm(f => ({ ...f, required: t.v }))}
                    className={`py-2 rounded-lg border-2 text-xs font-medium ${form.required === t.v ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Options</label>
              <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { name: '', price: 0 }] }))}
                className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Option
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={item.name}
                    onChange={e => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it) }))}
                    placeholder="Option name"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">+{currencySymbol}</span>
                    <input type="number" value={item.price || ''}
                      onChange={e => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, price: parseFloat(e.target.value) || 0 } : it) }))}
                      placeholder="0"
                      className="w-full pl-10 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}
                    className="p-1.5 text-gray-300 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={save} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            {editing ? 'Save Changes' : 'Create Modifier Group'}
          </button>
        </div>
      </Modal>

      {/* Link Items Modal */}
      {linkModal && (
        <LinkModal
          group={linkModal}
          menuItems={menuItems}
          currentLinks={linkedItemIds[linkModal.id!] ?? []}
          onSave={ids => saveLinks(linkModal, ids)}
          onClose={() => setLinkModal(null)}
        />
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Modifier"
        message={`Delete "${deleteTarget?.name}" and remove all its links?`}
        confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

function LinkModal({ group, menuItems, currentLinks, onSave, onClose }: {
  group: ModifierGroup;
  menuItems: MenuItem[];
  currentLinks: number[];
  onSave: (ids: number[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(currentLinks));

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <Modal open onClose={onClose} title={`Link "${group.name}" to Items`} size="md">
      <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin mb-4">
        {menuItems.map(item => (
          <button key={item.id} onClick={() => toggle(item.id!)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${selected.has(item.id!) ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:border-gray-200'}`}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selected.has(item.id!) ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
              {selected.has(item.id!) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="font-medium text-gray-800">{item.name}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium">Cancel</button>
        <button onClick={() => onSave([...selected])} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold">
          Save Links ({selected.size})
        </button>
      </div>
    </Modal>
  );
}
