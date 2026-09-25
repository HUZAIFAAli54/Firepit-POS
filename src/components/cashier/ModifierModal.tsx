import { useState, useEffect } from 'react';
import { Plus, Minus, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import type { MenuItem, ModifierGroup, SelectedModifier } from '../../types';

interface Props {
  item: MenuItem;
  onClose: () => void;
}

export default function ModifierModal({ item, onClose }: Props) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [selected, setSelected] = useState<Record<number, SelectedModifier[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const addToCart = useAppStore(s => s.addToCart);
  const currencySymbol = useAppStore(s => s.currencySymbol);

  useEffect(() => {
    const load = async () => {
      const links = await db.menuItemModifiers.where('menuItemId').equals(item.id!).toArray();
      const groupIds = links.map(l => l.modifierGroupId);
      const grps = await Promise.all(groupIds.map(id => db.modifierGroups.get(id)));
      const valid = grps.filter(Boolean) as ModifierGroup[];
      setGroups(valid);
      const init: Record<number, SelectedModifier[]> = {};
      valid.forEach(g => { init[g.id!] = []; });
      setSelected(init);
    };
    load();
  }, [item.id]);

  const toggleSingle = (group: ModifierGroup, modItem: { name: string; price: number }) => {
    setSelected(prev => ({
      ...prev,
      [group.id!]: [{
        groupId: group.id!,
        groupName: group.name,
        itemName: modItem.name,
        price: modItem.price,
      }],
    }));
  };

  const toggleMultiple = (group: ModifierGroup, modItem: { name: string; price: number }) => {
    setSelected(prev => {
      const cur = prev[group.id!] ?? [];
      const exists = cur.find(s => s.itemName === modItem.name);
      return {
        ...prev,
        [group.id!]: exists
          ? cur.filter(s => s.itemName !== modItem.name)
          : [...cur, { groupId: group.id!, groupName: group.name, itemName: modItem.name, price: modItem.price }],
      };
    });
  };

  const modifiersPrice = Object.values(selected).flat().reduce((sum, m) => sum + m.price, 0);
  const unitPrice = item.price + modifiersPrice;
  const total = unitPrice * quantity;

  const canAdd = groups.every(g => !g.required || (selected[g.id!]?.length ?? 0) > 0);

  const handleAdd = () => {
    const allModifiers = Object.values(selected).flat();
    addToCart({
      menuItemId: item.id!,
      name: item.name,
      basePrice: item.price,
      price: unitPrice,
      quantity,
      notes: note,
      subtotal: total,
      modifiers: allModifiers,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={item.name} size="md">
      <div className="space-y-5">
        {/* Item base info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{item.description}</span>
          <span className="font-bold text-amber-600">{currencySymbol} {item.price.toLocaleString()}</span>
        </div>

        {/* Modifier groups */}
        {groups.map(group => (
          <div key={group.id} className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800">{group.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                {group.required ? 'Required' : 'Optional'} · {group.type === 'single' ? 'Choose 1' : 'Choose any'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.items.map(mi => {
                const isSelected = (selected[group.id!] ?? []).some(s => s.itemName === mi.name);
                return (
                  <button
                    key={mi.name}
                    onClick={() => group.type === 'single' ? toggleSingle(group, mi) : toggleMultiple(group, mi)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    {mi.name}
                    {mi.price > 0 && <span className="text-xs opacity-70">+{currencySymbol}{mi.price}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Note */}
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Special instructions (e.g. no sugar, extra hot)..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
        />

        {/* Quantity + Add */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-gray-50">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-bold">{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)}
              className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-gray-50">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold transition-all"
          >
            Add to Cart · {currencySymbol} {total.toLocaleString()}
          </button>
        </div>
        {!canAdd && (
          <p className="text-xs text-red-500 text-center">Please select required options above</p>
        )}
      </div>
    </Modal>
  );
}
