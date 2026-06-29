import { useState, useEffect } from 'react';
import { Coffee, Shield, User, Delete, ChevronLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { db, hashPin } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { User as UserType, UserRole } from '../../types';

type Portal = UserRole | null;

export default function LoginScreen() {
  const [portal, setPortal] = useState<Portal>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const setSession = useAppStore(s => s.setSession);
  const cafeName = useAppStore(s => s.cafeName);

  useEffect(() => {
    db.users.filter(u => u.active === true).toArray().then(setUsers);
  }, []);

  const handlePinPress = (digit: string) => {
    if (pin.length >= 6) return;
    setError('');
    setPin(p => p + digit);
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  const handleLogin = async () => {
    if (!portal || pin.length < 4) return;
    setLoading(true);
    try {
      const hashed = await hashPin(pin);
      const roleUsers = users.filter(u => u.role === portal);
      const matched = roleUsers.find(u => u.pin === hashed);
      if (matched) {
        await db.users.update(matched.id!, { lastLogin: new Date().toISOString() });
        const session = {
          id: matched.id!,
          name: matched.name,
          role: matched.role,
          loginTime: new Date().toISOString(),
        };
        await logActivity(session.id, session.name, session.role, 'auth', 'Login', `${matched.name} logged in via ${portal} portal`);
        setSession(session);
      } else {
        setError('Incorrect PIN. Try again.');
        setPin('');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length >= 4) handleLogin();
  }, [pin]);

  const handleResetPINs = async () => {
    setResetting(true);
    try {
      const adminHash = await hashPin('1234');
      const cashierHash = await hashPin('5678');
      const allUsers = await db.users.toArray();
      await Promise.all(allUsers.map(u => {
        if (u.role === 'admin') return db.users.update(u.id!, { pin: adminHash });
        if (u.role === 'cashier') return db.users.update(u.id!, { pin: cashierHash });
        return Promise.resolve();
      }));
      await db.users.filter(u => u.active === true).toArray().then(setUsers);
      setResetDone(true);
    } finally {
      setResetting(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  // ── Portal selection screen ──────────────────────────────────────────────
  if (!portal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex flex-col items-center justify-center p-4">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500 rounded-2xl shadow-lg mb-4">
            <Coffee className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">{cafeName}</h1>
          <p className="text-gray-500 mt-1">Point of Sale System</p>
        </div>

        <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-5">Select Portal</p>

        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-sm sm:max-w-lg">
          {/* Admin Portal */}
          <button
            onClick={() => { setPortal('admin'); setError(''); setPin(''); }}
            className="flex-1 flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-xl border-2 border-purple-100 hover:border-purple-400 hover:shadow-2xl transition-all group"
          >
            <div className="w-20 h-20 bg-purple-50 group-hover:bg-purple-500 rounded-2xl flex items-center justify-center transition-all duration-200">
              <Shield className="w-10 h-10 text-purple-500 group-hover:text-white transition-colors duration-200" />
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-800">Admin Portal</div>
              <div className="text-sm text-gray-400 mt-1">Full system access & reports</div>
            </div>
          </button>

          {/* Cashier Portal */}
          <button
            onClick={() => { setPortal('cashier'); setError(''); setPin(''); }}
            className="flex-1 flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-xl border-2 border-amber-100 hover:border-amber-400 hover:shadow-2xl transition-all group"
          >
            <div className="w-20 h-20 bg-amber-50 group-hover:bg-amber-500 rounded-2xl flex items-center justify-center transition-all duration-200">
              <User className="w-10 h-10 text-amber-500 group-hover:text-white transition-colors duration-200" />
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-800">Cashier Portal</div>
              <div className="text-sm text-gray-400 mt-1">Orders, billing & payments</div>
            </div>
          </button>
        </div>

        <p className="mt-10 text-xs text-gray-400">Contact your administrator if you forgot your PIN.</p>
      </div>
    );
  }

  // ── PIN entry screen ─────────────────────────────────────────────────────
  const isAdmin = portal === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex flex-col items-center justify-center p-4">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl shadow-lg mb-3">
          <Coffee className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">{cafeName}</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs">
        <button
          onClick={() => { setPortal(null); setPin(''); setError(''); }}
          className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center mb-6">
          <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3 ${isAdmin ? 'bg-purple-100' : 'bg-amber-100'}`}>
            {isAdmin
              ? <Shield className="w-8 h-8 text-purple-600" />
              : <User className="w-8 h-8 text-amber-600" />
            }
          </div>
          <h2 className="font-bold text-gray-800 text-lg">{isAdmin ? 'Admin Portal' : 'Cashier Portal'}</h2>
          <p className="text-gray-400 text-sm mt-1">Enter your PIN to continue</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length
                  ? isAdmin ? 'bg-purple-500 border-purple-500' : 'bg-amber-500 border-amber-500'
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {digits.map(d => (
            <button
              key={d}
              onClick={() => handlePinPress(d)}
              disabled={loading}
              className={`h-14 text-xl font-semibold rounded-xl bg-gray-50 hover:bg-amber-50 hover:text-amber-600 active:scale-95 transition-all border border-gray-100 ${d === '0' ? 'col-start-2' : ''}`}
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="h-14 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all border border-red-100 col-start-3"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>

      <button
        onClick={() => { setShowForgotPin(true); setResetDone(false); }}
        className="mt-4 text-xs text-gray-400 hover:text-amber-600 hover:underline underline-offset-2 transition-colors"
      >
        Forgot PIN?
      </button>

      {showForgotPin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            {resetDone ? (
              <>
                <div className="text-center mb-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <h3 className="text-lg font-bold text-gray-800">PINs Reset Successfully</h3>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-sm text-green-800 space-y-1 mb-4">
                  <p><strong>Admin PIN:</strong> 1234</p>
                  <p><strong>Cashier PIN:</strong> 5678</p>
                </div>
                <button
                  onClick={() => { setShowForgotPin(false); setPin(''); setError(''); }}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold"
                >
                  OK — Back to Login
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                  <h3 className="text-lg font-bold text-gray-800">Reset PINs to Default</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  This will reset <strong>all</strong> account PINs to their factory defaults:
                </p>
                <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-800 space-y-1 mb-3">
                  <p>All Admin accounts → PIN <strong>1234</strong></p>
                  <p>All Cashier accounts → PIN <strong>5678</strong></p>
                </div>
                <p className="text-xs text-gray-400 mb-5">
                  After logging in, each user can update their PIN from the portal.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowForgotPin(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPINs}
                    disabled={resetting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold"
                  >
                    {resetting ? 'Resetting…' : 'Reset PINs'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
