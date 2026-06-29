import { useState } from 'react';
import { Coffee, Play, Clock, LogOut } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';

export default function StartShiftScreen() {
  const [openingBalance, setOpeningBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const session = useAppStore(s => s.session);
  const setShiftId = useAppStore(s => s.setShiftId);
  const setSession = useAppStore(s => s.setSession);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const cafeName = useAppStore(s => s.cafeName);

  const handleStart = async () => {
    if (!session || loading) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const balance = parseFloat(openingBalance) || 0;
      const shiftId = await db.shifts.add({
        openedBy: session.id,
        openedByName: session.name,
        openedAt: now,
        openingBalance: balance,
        totalSales: 0,
        totalOrders: 0,
        totalCash: 0,
        totalCard: 0,
        totalVoided: 0,
      });
      await logActivity(session.id, session.name, session.role, 'shift', 'Shift Started',
        `${session.name} started shift. Opening balance: ${currencySymbol} ${balance}`);
      setShiftId(shiftId);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => setSession(null);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Coffee className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{cafeName}</h1>
          <div className="mt-3 space-y-1 text-gray-500">
            <div className="flex items-center justify-center gap-2 text-3xl font-black text-gray-700">
              <Clock className="w-6 h-6 text-amber-500" />
              {timeStr}
            </div>
            <div className="text-sm">{dateStr}</div>
          </div>
        </div>

        {/* Welcome banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-center">
          <div className="text-base font-bold text-amber-800">Welcome, {session?.name}!</div>
          <div className="text-sm text-amber-600 mt-0.5">Start your shift to begin taking orders</div>
        </div>

        {/* Opening balance */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Opening Cash Balance ({currencySymbol})
          </label>
          <input
            type="number"
            value={openingBalance}
            onChange={e => setOpeningBalance(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder="0"
            className="w-full px-4 py-3 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 text-center transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1.5 text-center">Cash in drawer at the start of your shift</p>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:text-gray-400 text-white font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95"
        >
          <Play className="w-5 h-5" />
          {loading ? 'Starting Shift...' : 'Start Shift'}
        </button>

        {/* Logout link */}
        <button
          onClick={handleLogout}
          className="w-full mt-3 py-2 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  );
}
