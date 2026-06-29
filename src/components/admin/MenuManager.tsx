import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Tag } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { Category, MenuItem } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import toast from 'react-hot-toast';

export default function MenuManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);

  const [catModal, setCatModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'cat' | 'item'; id: number } | null>(null);

  const [catForm, setCatForm] = useState({ name: '', icon: '☕', color: '#d97706', sortOrder: 1, group: '' });
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', cost: '', categoryId: 0 });

  const load = async () => {
    const cats = await db.categories.orderBy('sortOrder').toArray();
    const its = await db.menuItems.orderBy('sortOrder').toArray();
    setCategories(cats);
    setItems(its);
    setSelectedCat(prev => prev ?? (cats[0]?.id ?? null));
    return cats;
  };

  useEffect(() => { load(); }, []);

  const openCatModal = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCatForm({ name: cat.name, icon: cat.icon, color: cat.color, sortOrder: cat.sortOrder, group: cat.group ?? '' });
    } else {
      setEditingCat(null);
      setCatForm({ name: '', icon: '☕', color: '#d97706', sortOrder: categories.length + 1, group: '' });
    }
    setCatModal(true);
  };

  const saveCat = async () => {
    if (!catForm.name.trim() || !session) return;
    const trimmedName = catForm.name.trim();
    const existing = await db.categories
      .filter(c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.id !== editingCat?.id)
      .first();
    if (existing) {
      toast.error(`Category "${trimmedName}" already exists.`);
      return;
    }
    const payload = { ...catForm, name: trimmedName, group: catForm.group.trim() || undefined };
    if (editingCat) {
      await db.categories.update(editingCat.id!, { ...payload, active: editingCat.active });
      await logActivity(session.id, session.name, session.role, 'menu', 'Category Updated', trimmedName);
    } else {
      const newId = await db.categories.add({ ...payload, active: true });
      await logActivity(session.id, session.name, session.role, 'menu', 'Category Added', trimmedName);
      setSelectedCat(newId as number);
    }
    setCatModal(false);
    await load();
  };

  const openItemModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({ name: item.name, description: item.description, price: String(item.price), cost: String(item.cost), categoryId: item.categoryId });
    } else {
      setEditingItem(null);
      setItemForm({ name: '', description: '', price: '', cost: '', categoryId: selectedCat ?? categories[0]?.id ?? 0 });
    }
    setItemModal(true);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim() || !session) return;
    const data = {
      name: itemForm.name.trim(),
      description: itemForm.description,
      price: parseFloat(itemForm.price) || 0,
      cost: parseFloat(itemForm.cost) || 0,
      categoryId: itemForm.categoryId,
    };
    if (editingItem) {
      await db.menuItems.update(editingItem.id!, { ...data, available: editingItem.available, sortOrder: editingItem.sortOrder });
      await logActivity(session.id, session.name, session.role, 'menu', 'Item Updated', data.name);
    } else {
      const nextOrder = items.filter(i => i.categoryId === data.categoryId).length + 1;
      await db.menuItems.add({ ...data, available: true, sortOrder: nextOrder });
      await logActivity(session.id, session.name, session.role, 'menu', 'Item Added', data.name);
    }
    setItemModal(false);
    load();
  };

  const toggleAvailable = async (item: MenuItem) => {
    await db.menuItems.update(item.id!, { available: !item.available });
    if (session) await logActivity(session.id, session.name, session.role, 'menu', item.available ? 'Item Hidden' : 'Item Shown', item.name);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !session) return;
    if (deleteTarget.type === 'cat') {
      // Delete all items in category first
      await db.menuItems.where('categoryId').equals(deleteTarget.id).delete();
      await db.categories.delete(deleteTarget.id);
      await logActivity(session.id, session.name, session.role, 'menu', 'Category Deleted', String(deleteTarget.id));
      setSelectedCat(null);
    } else {
      await db.menuItems.delete(deleteTarget.id);
      await logActivity(session.id, session.name, session.role, 'menu', 'Item Deleted', String(deleteTarget.id));
    }
    setDeleteTarget(null);
    load();
  };

  const filteredItems = selectedCat ? items.filter(i => i.categoryId === selectedCat) : items;

  // Unique groups for quick-fill suggestions
  const existingGroups = [...new Set(categories.map(c => c.group).filter(Boolean))] as string[];

  const ICONS = ['☕', '🧋', '🥪', '🍰', '🍕', '🍔', '🥗', '🍜', '🍣', '🧃', '🍺', '🥤', '🍩', '🥐', '🍳', '🌯', '🍗', '🍟', '🔥', '🎉', '➕'];
  const COLORS = ['#d97706', '#f97316', '#dc2626', '#eab308', '#0ea5e9', '#16a34a', '#db2777', '#7c3aed', '#0891b2', '#059669', '#6b7280', '#ef4444', '#f59e0b', '#06b6d4'];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Menu Management</h1>
        <button onClick={() => openItemModal()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Categories Sidebar */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1">
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
              <span className="font-semibold text-gray-700 text-sm">Categories</span>
              <button onClick={() => openCatModal()} className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg font-medium">
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {/* All option */}
              <div
                onClick={() => setSelectedCat(null)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all ${selectedCat === null ? 'bg-amber-50 border-l-2 border-amber-500' : 'hover:bg-gray-50'}`}
              >
                <span className="text-lg">📋</span>
                <span className={`flex-1 text-sm font-medium ${selectedCat === null ? 'text-amber-700' : 'text-gray-700'}`}>All Items</span>
                <span className="text-xs text-gray-400">{items.length}</span>
              </div>
              <div className="border-t border-gray-100" />
              {categories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id!)}
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all border-l-2 ${selectedCat === cat.id ? 'bg-amber-50 border-amber-500' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${selectedCat === cat.id ? 'text-amber-700' : 'text-gray-700'}`}>{cat.name}</div>
                    {cat.group && <div className="text-xs text-gray-400 truncate">{cat.group}</div>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{items.filter(i => i.categoryId === cat.id).length}</span>
                  {/* Always-visible action buttons */}
                  <button
                    onClick={e => { e.stopPropagation(); openCatModal(cat); }}
                    className="p-1 rounded hover:bg-amber-100 text-gray-400 hover:text-amber-600 shrink-0"
                    title="Edit category"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'cat', id: cat.id! }); }}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0"
                    title="Delete category"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Tag className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No items in this category</p>
              <button onClick={() => openItemModal()} className="mt-3 text-amber-600 hover:underline text-sm font-medium">+ Add first item</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map(item => {
                const cat = categories.find(c => c.id === item.categoryId);
                return (
                  <div key={item.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col ${item.available ? 'border-gray-200' : 'border-red-200 opacity-80'}`}>
                    {/* Item info */}
                    <div className="p-4 flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-2xl shrink-0">{cat?.icon || '🍽️'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 leading-tight">{item.name}</div>
                          {item.description && <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-amber-600 text-base">{currencySymbol} {item.price.toLocaleString()}</span>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (cat?.color ?? '#6b7280') + '20', color: cat?.color ?? '#6b7280' }}>
                            {cat?.name}
                          </span>
                          {item.cost > 0 && <span className="text-xs text-gray-400">Cost: {currencySymbol}{item.cost}</span>}
                          {!item.available && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Hidden</span>}
                        </div>
                      </div>
                    </div>
                    {/* Always-visible action bar */}
                    <div className="flex border-t border-gray-100 divide-x divide-gray-100">
                      <button onClick={() => toggleAvailable(item)}
                        className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-all ${item.available ? 'text-gray-500 hover:bg-gray-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {item.available ? <><EyeOff className="w-3.5 h-3.5" /> Hide</> : <><Eye className="w-3.5 h-3.5" /> Show</>}
                      </button>
                      <button onClick={() => openItemModal(item)}
                        className="flex-1 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1 transition-all">
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => setDeleteTarget({ type: 'item', id: item.id! })}
                        className="flex-1 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 flex items-center justify-center gap-1 transition-all">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category Modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={editingCat ? 'Edit Category' : 'Add Category'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Category Name *</label>
            <input
              value={catForm.name}
              onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Tandoori Pizza"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
              onKeyDown={e => e.key === 'Enter' && saveCat()}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Group / Section (optional)</label>
            <input
              value={catForm.group}
              onChange={e => setCatForm(f => ({ ...f, group: e.target.value }))}
              placeholder="e.g. Pizza, Grills, Drinks"
              list="group-suggestions"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <datalist id="group-suggestions">
              {existingGroups.map(g => <option key={g} value={g} />)}
            </datalist>
            <p className="text-xs text-gray-400 mt-1">Cashier menu will group categories under this section.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Icon</label>
            <div className="grid grid-cols-7 gap-1.5 mt-1">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setCatForm(f => ({ ...f, icon: ic }))}
                  className={`text-xl p-1.5 rounded-lg border ${catForm.icon === ic ? 'border-amber-500 bg-amber-50' : 'border-transparent hover:border-gray-200'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Color</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setCatForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${catForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button onClick={saveCat} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            {editingCat ? 'Save Changes' : 'Add Category'}
          </button>
        </div>
      </Modal>

      {/* Item Modal */}
      <Modal open={itemModal} onClose={() => setItemModal(false)} title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Item Name *</label>
            <input
              value={itemForm.name}
              onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Chicken Fajita (Large)"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <input
              value={itemForm.description}
              onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short description (shown on receipt / cashier)"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Price ({currencySymbol}) *</label>
              <input type="number" min="0" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Cost ({currencySymbol})</label>
              <input type="number" min="0" value={itemForm.cost} onChange={e => setItemForm(f => ({ ...f, cost: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Category *</label>
            <select value={itemForm.categoryId} onChange={e => setItemForm(f => ({ ...f, categoryId: Number(e.target.value) }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300">
              <option value={0} disabled>Select a category…</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}{c.group ? ` (${c.group})` : ''}</option>
              ))}
            </select>
          </div>
          <button
            onClick={saveItem}
            disabled={!itemForm.name.trim() || !itemForm.categoryId}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold"
          >
            {editingItem ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Confirm Delete"
        message={deleteTarget?.type === 'cat'
          ? 'Delete this category AND all its items? This cannot be undone.'
          : 'Delete this menu item? This cannot be undone.'}
        confirmLabel="Delete" danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
