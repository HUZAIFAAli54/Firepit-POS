import { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Star } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import type { Customer } from '../../types';
import Modal from '../ui/Modal';

interface Props {
  onClose: () => void;
}

export default function CustomerSearch({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const setSelectedCustomer = useAppStore(s => s.setSelectedCustomer);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    db.customers
      .filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.phone.includes(query)
      )
      .limit(8)
      .toArray()
      .then(setResults);
  }, [query]);

  const select = (c: Customer) => {
    setSelectedCustomer(c);
    onClose();
  };

  const createAndSelect = async () => {
    if (!form.name.trim()) return;
    const id = await db.customers.add({
      name: form.name,
      phone: form.phone,
      email: form.email,
      points: 0,
      totalOrders: 0,
      totalSpent: 0,
      notes: '',
      createdAt: new Date().toISOString(),
    });
    const newCustomer = await db.customers.get(id);
    if (newCustomer) select(newCustomer);
  };

  return (
    <Modal open onClose={onClose} title="Select Customer" size="sm">
      {!addMode ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map(c => (
                <button key={c.id} onClick={() => select(c)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all text-left">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 shrink-0">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.phone}</div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-600 shrink-0">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span className="text-sm font-bold">{c.points}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query && results.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-2">No customer found</p>
          )}

          <button onClick={() => setAddMode(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600 transition-all text-sm font-medium">
            <UserPlus className="w-4 h-4" /> New Customer
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setAddMode(false)} className="text-sm text-gray-400 hover:text-gray-600">← Back to search</button>
          <div>
            <label className="text-sm font-medium text-gray-700">Full Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} type="tel"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <button onClick={createAndSelect}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            Create & Select
          </button>
        </div>
      )}
    </Modal>
  );
}
