import { useState, useEffect } from 'react';
import { Save, Store, Receipt, Coffee, Star, Bike, Shield, RefreshCw } from 'lucide-react';
import { db, getSetting, setSetting, ensureRecoveryCode, regenerateRecoveryCode } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import toast from 'react-hot-toast';

export default function AppSettings() {
  const session = useAppStore(s => s.session);
  const setCafeName = useAppStore(s => s.setCafeName);
  const setCurrencySymbol = useAppStore(s => s.setCurrencySymbol);
  const setTaxRate = useAppStore(s => s.setTaxRate);

  const [form, setForm] = useState({
    cafeName: '',
    currency: '',
    taxRate: '',
    address: '',
    phone: '',
    receiptFooter: '',
  });

  const [loyalty, setLoyalty] = useState({
    loyaltyEnabled: 'false',
    pointsPerAmount: '10',
    pointsRedeemValue: '1',
  });

  const [delivery, setDelivery] = useState({
    defaultDeliveryFee: '100',
  });

  const [tableCount, setTableCount] = useState(0);
  const [savedTableCount, setSavedTableCount] = useState(0);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    Promise.all([
      getSetting('cafeName'),
      getSetting('currency'),
      getSetting('taxRate'),
      getSetting('address'),
      getSetting('phone'),
      getSetting('receiptFooter'),
      getSetting('loyaltyEnabled', 'false'),
      getSetting('pointsPerAmount', '10'),
      getSetting('pointsRedeemValue', '1'),
      getSetting('defaultDeliveryFee', '100'),
    ]).then(([cafeName, currency, taxRate, address, phone, receiptFooter, loyaltyEnabled, pointsPerAmount, pointsRedeemValue, defaultDeliveryFee]) => {
      setForm({ cafeName, currency, taxRate, address, phone, receiptFooter });
      setLoyalty({ loyaltyEnabled, pointsPerAmount, pointsRedeemValue });
      setDelivery({ defaultDeliveryFee });
    });
    db.cafeTables.count().then(c => { setTableCount(c); setSavedTableCount(c); });
    ensureRecoveryCode().then(setRecoveryCode);
  }, []);

  const save = async () => {
    if (!session) return;
    await setSetting('cafeName', form.cafeName);
    await setSetting('currency', form.currency);
    await setSetting('taxRate', form.taxRate);
    await setSetting('address', form.address);
    await setSetting('phone', form.phone);
    await setSetting('receiptFooter', form.receiptFooter);
    await setSetting('loyaltyEnabled', loyalty.loyaltyEnabled);
    await setSetting('pointsPerAmount', loyalty.pointsPerAmount);
    await setSetting('pointsRedeemValue', loyalty.pointsRedeemValue);
    await setSetting('defaultDeliveryFee', delivery.defaultDeliveryFee);

    setCafeName(form.cafeName);
    setCurrencySymbol(form.currency);
    setTaxRate(parseFloat(form.taxRate) || 0);

    // Update tables if count changed
    const currentTables = await db.cafeTables.toArray();
    if (tableCount !== savedTableCount) {
      if (tableCount > savedTableCount) {
        const toAdd = Array.from({ length: tableCount - savedTableCount }, (_, i) => ({
          name: `Table ${savedTableCount + i + 1}`,
          capacity: 4,
          status: 'free' as const,
        }));
        await db.cafeTables.bulkAdd(toAdd);
      } else {
        const toRemove = currentTables.slice(tableCount);
        await db.cafeTables.bulkDelete(toRemove.map(t => t.id!));
      }
      setSavedTableCount(tableCount);
    }

    await logActivity(session.id, session.name, session.role, 'settings', 'Settings Updated', 'General settings saved');
    toast.success('Settings saved!');
  };

  const f = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleRegenerateCode = async () => {
    if (!session || regenerating) return;
    setRegenerating(true);
    try {
      const code = await regenerateRecoveryCode();
      setRecoveryCode(code);
      await logActivity(session.id, session.name, session.role, 'settings', 'Recovery Code Regenerated', 'A new PIN-recovery code was generated');
      toast.success('New recovery code generated!');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Cafe Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-semibold">
            <Store className="w-5 h-5 text-amber-500" /> Cafe Information
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-600">Cafe Name</label>
              <input value={form.cafeName} onChange={e => f('cafeName', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-600">Address</label>
              <input value={form.address} onChange={e => f('address', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Phone</label>
              <input value={form.phone} onChange={e => f('phone', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>
        </div>

        {/* POS Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-semibold">
            <Coffee className="w-5 h-5 text-amber-500" /> POS Settings
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Currency Symbol</label>
              <input value={form.currency} onChange={e => f('currency', e.target.value)} placeholder="Rs."
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Tax Rate (%)</label>
              <input type="number" min="0" max="100" value={form.taxRate} onChange={e => f('taxRate', e.target.value)} placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Number of Tables</label>
              <input type="number" min="1" max="50" value={tableCount} onChange={e => setTableCount(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>
        </div>

        {/* Loyalty Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-semibold">
            <Star className="w-5 h-5 text-amber-500" /> Loyalty Program
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-700">Enable Loyalty</div>
                <div className="text-xs text-gray-400">Allow customers to earn & redeem points</div>
              </div>
              <button
                onClick={() => setLoyalty(l => ({ ...l, loyaltyEnabled: l.loyaltyEnabled === 'true' ? 'false' : 'true' }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${loyalty.loyaltyEnabled === 'true' ? 'bg-amber-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${loyalty.loyaltyEnabled === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {loyalty.loyaltyEnabled === 'true' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-600">Points per amount spent</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 whitespace-nowrap">1 point per</span>
                    <input type="number" min="1" value={loyalty.pointsPerAmount}
                      onChange={e => setLoyalty(l => ({ ...l, pointsPerAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    <span className="text-xs text-gray-400">spent</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Point redemption value</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 whitespace-nowrap">1 pt =</span>
                    <input type="number" min="0.1" step="0.1" value={loyalty.pointsRedeemValue}
                      onChange={e => setLoyalty(l => ({ ...l, pointsRedeemValue: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    <span className="text-xs text-gray-400">currency</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-semibold">
            <Bike className="w-5 h-5 text-amber-500" /> Delivery Settings
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Default Delivery Fee</label>
            <input type="number" min="0" value={delivery.defaultDeliveryFee}
              onChange={e => setDelivery({ defaultDeliveryFee: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
        </div>

        {/* Receipt Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-semibold">
            <Receipt className="w-5 h-5 text-amber-500" /> Receipt Settings
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Receipt Footer Message</label>
            <textarea value={form.receiptFooter} onChange={e => f('receiptFooter', e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              placeholder="Thank you for visiting!" />
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-semibold">
            <Shield className="w-5 h-5 text-amber-500" /> Security
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-gray-700">PIN Recovery Code</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Needed on the login screen to reset forgotten PINs. Store it somewhere safe —
                anyone with this code can reset all PINs.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-4 py-2 bg-gray-900 text-green-300 font-mono tracking-[0.25em] rounded-lg text-lg select-all">
                {recoveryCode || '••••••••'}
              </span>
              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                title="Generate a new code (old code stops working)"
                className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <button onClick={save}
          className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold shadow-sm transition-all">
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </div>
  );
}
