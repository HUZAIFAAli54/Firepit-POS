import { useState, useEffect } from 'react';
import { ShoppingCart, ClipboardList, Coffee, Clock, Monitor, PauseCircle, X, CheckCircle, KeyRound } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { db, hashPin } from '../../db/database';
import MenuPanel from './MenuPanel';
import CartPanel from './CartPanel';
import OrdersPanel from './OrdersPanel';
import KDSScreen from './KDSScreen';
import HoldOrdersDrawer from './HoldOrdersDrawer';
import StartShiftScreen from './StartShiftScreen';
import Modal from '../ui/Modal';

type View = 'order' | 'orders';

export default function CashierLayout() {
  const session = useAppStore(s => s.session);
  const setSession = useAppStore(s => s.setSession);
  const clearCart = useAppStore(s => s.clearCart);
  const cafeName = useAppStore(s => s.cafeName);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const [view, setView] = useState<View>('order');
  const [now, setNow] = useState(new Date());
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [showKDS, setShowKDS] = useState(false);
  const [showHold, setShowHold] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closingBalance, setClosingBalance] = useState('');
  const [closing, setClosing] = useState(false);
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [pinForm, setPinForm] = useState({ newPin: '', confirmPin: '' });
  const [pinError, setPinError] = useState('');

  const handleChangePIN = async () => {
    setPinError('');
    if (pinForm.newPin.length < 4) { setPinError('PIN must be at least 4 digits'); return; }
    if (pinForm.newPin !== pinForm.confirmPin) { setPinError('PINs do not match'); return; }
    if (!session) return;
    const hashed = await hashPin(pinForm.newPin);
    await db.users.update(session.id, { pin: hashed });
    await logActivity(session.id, session.name, session.role, 'auth', 'PIN Changed', `${session.name} changed their PIN`);
    setShowChangePIN(false);
    setPinForm({ newPin: '', confirmPin: '' });
  };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const count = await db.orders.where('status').anyOf(['open', 'preparing', 'ready', 'pending-payment']).count();
      setActiveOrdersCount(count);
    };
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const handleCloseShift = async () => {
    if (!session?.shiftId || closing) return;
    setClosing(true);
    try {
      const balance = parseFloat(closingBalance) || 0;
      await db.shifts.update(session.shiftId, {
        closedBy: session.id,
        closedByName: session.name,
        closedAt: new Date().toISOString(),
        closingBalance: balance,
      });
      await logActivity(session.id, session.name, session.role, 'shift', 'Shift Closed',
        `${session.name} closed shift. Closing balance: ${currencySymbol} ${balance}`);
      clearCart();
      setSession(null);
    } finally {
      setClosing(false);
      setShowCloseShift(false);
    }
  };

  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' });

  if (!session?.shiftId) {
    return <StartShiftScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-1.5 rounded-lg">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-800">{cafeName}</span>
            <span className="text-xs text-gray-400 ml-2">Cashier</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('order')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'order' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <ShoppingCart className="w-4 h-4" /> New Order
          </button>
          <button
            onClick={() => setView('orders')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all relative ${view === 'orders' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <ClipboardList className="w-4 h-4" /> Active Orders
            {activeOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {activeOrdersCount > 9 ? '9+' : activeOrdersCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowHold(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all"
          >
            <PauseCircle className="w-4 h-4" /> Hold
          </button>
          <button
            onClick={() => setShowKDS(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-purple-600 hover:bg-purple-50 transition-all"
          >
            <Monitor className="w-4 h-4" /> KDS
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-gray-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {timeStr}
            </div>
            <div className="text-xs text-gray-400">{dateStr}</div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-gray-700">{session?.name}</div>
            <div className="text-xs text-gray-400 capitalize">{session?.role}</div>
          </div>
          <button
            onClick={() => { setPinForm({ newPin: '', confirmPin: '' }); setPinError(''); setShowChangePIN(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-all font-medium"
            title="Change my PIN"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setClosingBalance(''); setShowCloseShift(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-all font-medium border border-red-200"
          >
            <X className="w-4 h-4" /> Close Shift
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'order' ? (
          <div className="h-full flex">
            <MenuPanel />
            <CartPanel onOpenHold={() => setShowHold(true)} />
          </div>
        ) : (
          <OrdersPanel />
        )}
      </div>

      {showKDS && <KDSScreen onClose={() => setShowKDS(false)} />}
      {showHold && <HoldOrdersDrawer onClose={() => setShowHold(false)} />}

      {/* Change PIN Modal */}
      <Modal open={showChangePIN} onClose={() => setShowChangePIN(false)} title="Change My PIN" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Changing PIN for <strong>{session?.name}</strong></p>
          <div>
            <label className="text-sm font-medium text-gray-700">New PIN (min 4 digits)</label>
            <input type="password" value={pinForm.newPin}
              onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value.replace(/\D/g, '') }))}
              maxLength={6} placeholder="••••"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Confirm New PIN</label>
            <input type="password" value={pinForm.confirmPin}
              onChange={e => setPinForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '') }))}
              maxLength={6} placeholder="••••"
              onKeyDown={e => e.key === 'Enter' && handleChangePIN()}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
          <button onClick={handleChangePIN}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">
            Update PIN
          </button>
        </div>
      </Modal>

      {/* Close Shift Modal */}
      <Modal open={showCloseShift} onClose={() => setShowCloseShift(false)} title="Close Shift" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the closing cash balance in your drawer. This will end your shift and log you out.
          </p>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Closing Cash Balance ({currencySymbol})
            </label>
            <input
              type="number"
              value={closingBalance}
              onChange={e => setClosingBalance(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCloseShift()}
              placeholder="0"
              className="w-full px-4 py-3 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 text-center"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCloseShift(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseShift}
              disabled={closing}
              className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-gray-200 text-white font-bold flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {closing ? 'Closing...' : 'Close Shift & Logout'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
