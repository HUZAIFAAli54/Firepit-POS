import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { initializeDatabase, getSetting } from './db/database';
import { useAppStore } from './store/useAppStore';
import LoginScreen from './components/auth/LoginScreen';
import CashierLayout from './components/cashier/CashierLayout';
import AdminLayout from './components/admin/AdminLayout';

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
      // Restore session from localStorage (survives refresh)
      const saved = localStorage.getItem('pos_session');
      if (saved && !useAppStore.getState().session) {
        try { useAppStore.getState().setSession(JSON.parse(saved)); } catch {}
      }
      setReady(true);
    });
  }, []);

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
      ) : session.role === 'admin' ? (
        <AdminLayout />
      ) : (
        <CashierLayout />
      )}
    </>
  );
}
