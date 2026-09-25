import { useState, useEffect, useCallback } from 'react';
import { PlayCircle, StopCircle } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { formatDateTime, formatCurrency } from '../../utils/format';
import type { Shift } from '../../types';
import Modal from '../ui/Modal';

export default function ShiftManager() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const session = useAppStore(s => s.session);
  const setShiftId = useAppStore(s => s.setShiftId);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const load = useCallback(async () => {
    const all = await db.shifts.orderBy('openedAt').reverse().limit(30).toArray();
    setShifts(all);
    const active = all.find(s => !s.closedAt);
    setActiveShift(active || null);
    if (active && session) setShiftId(active.id!);
  }, [session, setShiftId]);

  useEffect(() => { load(); }, [load]);

  const startShift = async () => {
    if (!session) return;
    const id = await db.shifts.add({
      openedBy: session.id,
      openedByName: session.name,
      openedAt: new Date().toISOString(),
      openingBalance: parseFloat(openingBalance) || 0,
      totalSales: 0,
      totalOrders: 0,
      totalCash: 0,
      totalCard: 0,
      totalVoided: 0,
    });
    setShiftId(id);
    await logActivity(session.id, session.name, session.role, 'shift', 'Shift Opened', `Opening balance: ${currencySymbol} ${openingBalance || 0}`);
    setOpenModal(false);
    setOpeningBalance('');
    load();
  };

  const endShift = async () => {
    if (!activeShift || !session) return;
    await db.shifts.update(activeShift.id!, {
      closedBy: session.id,
      closedByName: session.name,
      closedAt: new Date().toISOString(),
      closingBalance: parseFloat(closingBalance) || 0,
    });
    setShiftId(undefined!);
    await logActivity(session.id, session.name, session.role, 'shift', 'Shift Closed',
      `Total sales: ${fmt(activeShift.totalSales)} | Orders: ${activeShift.totalOrders}`);
    setCloseModal(false);
    setClosingBalance('');
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Shift Management</h1>
        {!activeShift ? (
          <button onClick={() => setOpenModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium">
            <PlayCircle className="w-4 h-4" /> Open Shift
          </button>
        ) : (
          <button onClick={() => setCloseModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium">
            <StopCircle className="w-4 h-4" /> Close Shift
          </button>
        )}
      </div>

      {/* Active Shift Banner */}
      {activeShift && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 text-green-700 font-semibold mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Active Shift — Opened by {activeShift.openedByName}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-green-600 text-xs">Started</div>
              <div className="font-medium text-green-900">{formatDateTime(activeShift.openedAt)}</div>
            </div>
            <div>
              <div className="text-green-600 text-xs">Sales</div>
              <div className="font-bold text-green-900">{fmt(activeShift.totalSales)}</div>
            </div>
            <div>
              <div className="text-green-600 text-xs">Orders</div>
              <div className="font-bold text-green-900">{activeShift.totalOrders}</div>
            </div>
            <div>
              <div className="text-green-600 text-xs">Opening Cash</div>
              <div className="font-medium text-green-900">{fmt(activeShift.openingBalance)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Shift History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">Shift History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['#', 'Opened By', 'Opened At', 'Closed By', 'Closed At', 'Orders', 'Sales', 'Cash', 'Card', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shifts.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-700">#{s.id}</td>
                  <td className="px-4 py-3 text-gray-600">{s.openedByName}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(s.openedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{s.closedByName || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.closedAt ? formatDateTime(s.closedAt) : '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{s.totalOrders}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(s.totalSales)}</td>
                  <td className="px-4 py-3 text-green-600">{fmt(s.totalCash)}</td>
                  <td className="px-4 py-3 text-blue-600">{fmt(s.totalCard)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${!s.closedAt ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {!s.closedAt ? 'Active' : 'Closed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shifts.length === 0 && <div className="text-center py-10 text-gray-400">No shifts yet</div>}
        </div>
      </div>

      {/* Open Modal */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Open New Shift" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Opening Cash Balance ({currencySymbol})</label>
            <input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="0"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <button onClick={startShift} className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold">
            Start Shift
          </button>
        </div>
      </Modal>

      {/* Close Modal */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Close Shift" size="sm">
        <div className="space-y-4">
          {activeShift && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total Sales</span><span className="font-bold">{fmt(activeShift.totalSales)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Cash Sales</span><span>{fmt(activeShift.totalCash)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Card Sales</span><span>{fmt(activeShift.totalCard)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Orders</span><span>{activeShift.totalOrders}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Opening Balance</span><span>{fmt(activeShift.openingBalance)}</span></div>
              <div className="flex justify-between font-semibold text-green-700 border-t pt-2">
                <span>Expected Closing Cash</span>
                <span>{fmt(activeShift.openingBalance + activeShift.totalCash)}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700">Actual Closing Cash ({currencySymbol})</label>
            <input type="number" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} placeholder="0"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <button onClick={endShift} className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold">
            Close Shift
          </button>
        </div>
      </Modal>
    </div>
  );
}
