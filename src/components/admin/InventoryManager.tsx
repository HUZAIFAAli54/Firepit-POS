import { useState, useEffect } from 'react';
import { Plus, Edit, AlertTriangle, Package } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatDateTime } from '../../utils/format';
import type { InventoryItem, MenuItem } from '../../types';
import Modal from '../ui/Modal';

export default function InventoryManager() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const session = useAppStore(s => s.session);

  const [form, setForm] = useState({ menuItemId: 0, itemName: '', currentStock: '', unit: 'pcs', lowStockAlert: '10' });

  const load = async () => {
    const inv = await db.inventory.toArray();
    const items = await db.menuItems.toArray();
    setInventory(inv);
    setMenuItems(items);
  };

  useEffect(() => { load(); }, []);

  const openModal = (inv?: InventoryItem) => {
    if (inv) {
      setEditing(inv);
      setForm({ menuItemId: inv.menuItemId, itemName: inv.itemName, currentStock: String(inv.currentStock), unit: inv.unit, lowStockAlert: String(inv.lowStockAlert) });
    } else {
      setEditing(null);
      setForm({ menuItemId: menuItems[0]?.id || 0, itemName: '', currentStock: '', unit: 'pcs', lowStockAlert: '10' });
    }
    setModal(true);
  };

  const save = async () => {
    if (!session) return;
    const data: Omit<InventoryItem, 'id'> = {
      menuItemId: form.menuItemId,
      itemName: form.itemName || menuItems.find(m => m.id === form.menuItemId)?.name || '',
      currentStock: parseFloat(form.currentStock) || 0,
      unit: form.unit,
      lowStockAlert: parseFloat(form.lowStockAlert) || 0,
      lastUpdated: new Date().toISOString(),
    };
    if (editing) {
      await db.inventory.update(editing.id!, data);
      await logActivity(session.id, session.name, session.role, 'inventory', 'Stock Updated', `${data.itemName}: ${data.currentStock} ${data.unit}`);
    } else {
      await db.inventory.add(data);
      await logActivity(session.id, session.name, session.role, 'inventory', 'Inventory Added', data.itemName);
    }
    setModal(false);
    load();
  };

  const lowStock = inventory.filter(i => i.currentStock <= i.lowStockAlert);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-700">Low Stock Alert</div>
            <div className="text-sm text-amber-600 mt-1">
              {lowStock.map(i => `${i.itemName} (${i.currentStock} ${i.unit})`).join(', ')}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Item', 'Linked Menu Item', 'Stock', 'Unit', 'Low Alert', 'Status', 'Last Updated', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {inventory.map(inv => {
              const isLow = inv.currentStock <= inv.lowStockAlert;
              const linked = menuItems.find(m => m.id === inv.menuItemId);
              return (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{inv.itemName}</td>
                  <td className="px-4 py-3 text-gray-500">{linked?.name || '-'}</td>
                  <td className={`px-4 py-3 font-semibold ${isLow ? 'text-red-600' : 'text-gray-700'}`}>{inv.currentStock}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.unit}</td>
                  <td className="px-4 py-3 text-gray-400">{inv.lowStockAlert}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isLow ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {isLow ? 'Low Stock' : 'OK'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(inv.lastUpdated)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openModal(inv)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {inventory.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No inventory items. Add items to track stock.</p>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Update Stock' : 'Add Inventory Item'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Link to Menu Item</label>
            <select value={form.menuItemId} onChange={e => setForm(f => ({ ...f, menuItemId: Number(e.target.value) }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300">
              <option value={0}>-- None --</option>
              {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Inventory Name *</label>
            <input value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="e.g. Coffee Beans"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Current Stock</label>
              <input type="number" value={form.currentStock} onChange={e => setForm(f => ({ ...f, currentStock: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Unit</label>
              <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="kg, pcs, L..."
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700">Low Stock Alert at</label>
              <input type="number" value={form.lowStockAlert} onChange={e => setForm(f => ({ ...f, lowStockAlert: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>
          <button onClick={save} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            {editing ? 'Update Stock' : 'Add Item'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
