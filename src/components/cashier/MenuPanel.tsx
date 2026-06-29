import { useState, useEffect } from 'react';
import { Search, Tag } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import type { Category, MenuItem } from '../../types';
import ModifierModal from './ModifierModal';

export default function MenuPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [itemsWithModifiers, setItemsWithModifiers] = useState<Set<number>>(new Set());
  const addToCart = useAppStore(s => s.addToCart);
  const currencySymbol = useAppStore(s => s.currencySymbol);

  useEffect(() => {
    db.categories.filter(c => c.active === true).toArray().then(cats => {
      cats.sort((a, b) => a.sortOrder - b.sortOrder);
      setCategories(cats);
      if (cats.length > 0) setSelectedCat(cats[0].id!);
    });
    db.menuItems.filter(m => m.available === true).toArray().then(setMenuItems);
    db.menuItemModifiers.toArray().then(links => {
      setItemsWithModifiers(new Set(links.map(l => l.menuItemId)));
    });
  }, []);

  const filtered = menuItems.filter(item => {
    const matchesCat = selectedCat === null || item.categoryId === selectedCat;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAdd = (item: MenuItem) => {
    if (itemsWithModifiers.has(item.id!)) {
      setModifierItem(item);
      return;
    }
    addToCart({
      menuItemId: item.id!,
      name: item.name,
      basePrice: item.price,
      price: item.price,
      quantity: 1,
      notes: '',
      subtotal: item.price,
      modifiers: [],
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 border-r border-gray-200">
      {/* Search */}
      <div className="p-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
      </div>

      {/* Categories — grouped by section */}
      <div className="bg-white border-b border-gray-100 shrink-0">
        <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-thin">
          <button onClick={() => setSelectedCat(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCat === null ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All
          </button>

          {(() => {
            // Group categories: ungrouped first, then by group
            const ungrouped = categories.filter(c => !c.group);
            const groups: Record<string, typeof categories> = {};
            categories.filter(c => c.group).forEach(c => {
              const g = c.group!;
              if (!groups[g]) groups[g] = [];
              groups[g].push(c);
            });

            return (
              <>
                {ungrouped.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCat(cat.id!)}
                    className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCat === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    style={selectedCat === cat.id ? { backgroundColor: cat.color } : {}}>
                    <span>{cat.icon}</span> {cat.name}
                  </button>
                ))}
                {Object.entries(groups).map(([group, cats]) => (
                  <div key={group} className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide border-l border-gray-200 pl-2">{group}</span>
                    {cats.map(cat => (
                      <button key={cat.id} onClick={() => setSelectedCat(cat.id!)}
                        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCat === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        style={selectedCat === cat.id ? { backgroundColor: cat.color } : {}}>
                        <span>{cat.icon}</span> {cat.name}
                      </button>
                    ))}
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Tag className="w-10 h-10 mb-2 opacity-50" />
            <p>No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filtered.map(item => {
              const cat = categories.find(c => c.id === item.categoryId);
              const hasModifiers = itemsWithModifiers.has(item.id!);
              return (
                <button key={item.id} onClick={() => handleAdd(item)}
                  className="bg-white rounded-xl p-3 text-left border border-gray-100 hover:border-amber-300 hover:shadow-md active:scale-95 transition-all group relative">
                  {hasModifiers && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" title="Has options" />
                  )}
                  <div className="text-2xl mb-1">{cat?.icon || '🍽️'}</div>
                  <div className="font-semibold text-gray-800 text-sm leading-tight group-hover:text-amber-700">{item.name}</div>
                  {item.description && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</div>}
                  <div className="mt-2 font-bold text-amber-600 text-sm">{currencySymbol} {item.price.toLocaleString()}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {modifierItem && (
        <ModifierModal item={modifierItem} onClose={() => setModifierItem(null)} />
      )}
    </div>
  );
}
