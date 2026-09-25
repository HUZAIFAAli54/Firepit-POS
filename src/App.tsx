import { useEffect, useState, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { initializeDatabase, getSetting, db } from './db/database';
import { useAppStore } from './store/useAppStore';
import LoginScreen from './components/auth/LoginScreen';
import type { SessionUser } from './types';

// Heavy layouts are code-split: the login screen loads instantly, and the
// cashier/admin bundles (charts, KDS, etc.) download only after login.
const CashierLayout = lazy(() => import('./components/cashier/CashierLayout'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

function LayoutFallback() {
  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-3xl">🔥</span>
        </div>
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  const session = useAppStore(s => s.session);
  const setCafeName = useAppStore(s => s.setCafeName);
  const setCurrencySymbol = useAppStore(s => s.setCurrencySymbol);
  const setTaxRate = useAppStore(s => s.setTaxRate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDatabase().then(async () => {
      const [name, currency, tax] = await Promise.all([
        getSetting('cafeName'),
        getSetting('currency'),
        getSetting('taxRate'),
      ]);
      if (name) setCafeName(name);
      if (currency) setCurrencySymbol(currency);
      if (tax) setTaxRate(parseFloat(tax) || 0);
      // Restore session from localStorage (survives refresh), but validate it
      // against the database first — a hand-edited localStorage entry must
      // not be able to grant access (e.g. escalating to the admin role).
      const saved = localStorage.getItem('pos_session');
      if (saved && !useAppStore.getState().session) {
        try {
          const parsed = JSON.parse(saved) as SessionUser;
          const user = parsed?.id ? await db.users.get(parsed.id) : undefined;
          if (user && user.active) {
            useAppStore.getState().setSession({
              id: user.id!,
              name: user.name,
              role: user.role,
              loginTime: parsed.loginTime || new Date().toISOString(),
              shiftId: parsed.shiftId,
            });
          } else {
            localStorage.removeItem('pos_session');
          }
        } catch {
          localStorage.removeItem('pos_session');
        }
      }
      setReady(true);
    });
  }, [setCafeName, setCurrencySymbol, setTaxRate]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">☕</span>
          </div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 2500 }} />
      {!session ? (
        <LoginScreen />
      ) : (
        <Suspense fallback={<LayoutFallback />}>
          {session.role === 'admin' ? <AdminLayout /> : <CashierLayout />}
        </Suspense>
      )}
    </>
  );
}
