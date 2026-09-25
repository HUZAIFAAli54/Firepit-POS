import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FlaskConical } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatCurrency } from '../../utils/format';
import type { Recipe, MenuItem, RecipeIngredient } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function RecipeManager() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const [form, setForm] = useState({
    menuItemId: 0,
    ingredients: [{ name: '', quantity: 1, unit: '', costPerUnit: 0 }] as RecipeIngredient[],
  });

  const load = async () => {
    const [r, m] = await Promise.all([db.recipes.toArray(), db.menuItems.toArray()]);
    setRecipes(r);
    setMenuItems(m);
  };

  useEffect(() => { load(); }, []);

  const calcTotal = (ingredients: RecipeIngredient[]) =>
    ingredients.reduce((s, i) => s + (i.quantity * i.costPerUnit), 0);

  const openModal = (r?: Recipe) => {
    if (r) {
      setEditing(r);
      setForm({ menuItemId: r.menuItemId, ingredients: [...r.ingredients] });
    } else {
      setEditing(null);
      setForm({ menuItemId: menuItems[0]?.id ?? 0, ingredients: [{ name: '', quantity: 1, unit: 'pcs', costPerUnit: 0 }] });
    }
    setModal(true);
  };

  const addIngredient = () =>
    setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', quantity: 1, unit: '', costPerUnit: 0 }] }));

  const removeIngredient = (i: number) =>
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));

  const updateIngredient = (i: number, key: keyof RecipeIngredient, value: string | number) =>
    setForm(f => ({
      ...f,
      ingredients: f.ingredients.map((ing, idx) =>
        idx === i ? { ...ing, [key]: typeof value === 'string' && key !== 'name' && key !== 'unit' ? parseFloat(value) || 0 : value } : ing
      ),
    }));

  const save = async () => {
    if (!form.menuItemId || !session) return;
    const validIngredients = form.ingredients.filter(i => i.name.trim());
    const totalCost = calcTotal(validIngredients);
    const menuItem = menuItems.find(m => m.id === form.menuItemId);
    const data = {
      menuItemId: form.menuItemId,
      menuItemName: menuItem?.name ?? '',
      ingredients: validIngredients,
      totalCost,
    };
    if (editing) {
      await db.recipes.update(editing.id!, data);
      // Also update the menu item cost
      await db.menuItems.update(form.menuItemId, { cost: Math.round(totalCost) });
      await logActivity(session.id, session.name, session.role, 'menu', 'Recipe Updated', data.menuItemName);
    } else {
      await db.recipes.add(data);
      await db.menuItems.update(form.menuItemId, { cost: Math.round(totalCost) });
      await logActivity(session.id, session.name, session.role, 'menu', 'Recipe Added', data.menuItemName);
    }
    setModal(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !session) return;
    await db.recipes.delete(deleteTarget.id!);
    await logActivity(session.id, session.name, session.role, 'menu', 'Recipe Deleted', deleteTarget.menuItemName);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Recipe & Cost Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">Define ingredients to auto-calculate real cost of each item</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">
          <Plus className="w-4 h-4" /> Add Recipe
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recipes.map(recipe => {
          const menuItem = menuItems.find(m => m.id === recipe.menuItemId);
          const margin = menuItem ? ((menuItem.price - recipe.totalCost) / menuItem.price * 100) : 0;
          return (
            <div key={recipe.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-800">{recipe.menuItemName}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    <span className="text-gray-500">Cost: <strong className="text-red-600">{fmt(recipe.totalCost)}</strong></span>
                    <span className="text-gray-500">Price: <strong className="text-green-600">{fmt(menuItem?.price ?? 0)}</strong></span>
                    <span className={`font-bold ${margin > 50 ? 'text-green-600' : margin > 30 ? 'text-amber-600' : 'text-red-600'}`}>
                      {Math.round(margin)}% margin
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openModal(recipe)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(recipe)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <table className="w-full text-xs text-gray-600">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-1 font-medium">Ingredient</th>
                    <th className="text-right py-1 font-medium">Qty</th>
                    <th className="text-right py-1 font-medium">Unit Cost</th>
                    <th className="text-right py-1 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recipe.ingredients.map((ing, i) => (
                    <tr key={i}>
                      <td className="py-1">{ing.name}</td>
                      <td className="text-right py-1">{ing.quantity} {ing.unit}</td>
                      <td className="text-right py-1">{fmt(ing.costPerUnit)}</td>
                      <td className="text-right py-1 font-medium">{fmt(ing.quantity * ing.costPerUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {recipes.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-400">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No recipes yet. Add recipes to track ingredient costs and profit margins.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Recipe' : 'Add Recipe'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Menu Item</label>
            <select value={form.menuItemId} onChange={e => setForm(f => ({ ...f, menuItemId: Number(e.target.value) }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300">
              <option value={0}>-- Select Item --</option>
              {(editing
                ? menuItems
                : menuItems.filter(m => !recipes.find(r => r.menuItemId === m.id))
              ).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Ingredients</label>
              <button onClick={addIngredient} className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Ingredient
              </button>
            </div>
            <div className="space-y-2">
              {form.ingredients.map((ing, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                    placeholder="Ingredient name" className="col-span-4 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
                  <input type="number" value={ing.quantity || ''} onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                    placeholder="Qty" className="col-span-2 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
                  <input value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)}
                    placeholder="Unit" className="col-span-2 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
                  <input type="number" value={ing.costPerUnit || ''} onChange={e => updateIngredient(i, 'costPerUnit', e.target.value)}
                    placeholder="Cost/unit" className="col-span-3 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
                  <button onClick={() => removeIngredient(i)} className="col-span-1 p-1 text-gray-300 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 text-sm flex items-center justify-between">
            <span className="font-medium text-amber-700">Total Recipe Cost</span>
            <span className="font-black text-amber-700 text-lg">{fmt(calcTotal(form.ingredients))}</span>
          </div>

          <button onClick={save} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            {editing ? 'Save Changes' : 'Add Recipe'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Recipe"
        message={`Delete recipe for "${deleteTarget?.menuItemName}"?`}
        confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
