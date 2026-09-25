import { useState } from 'react';
import {
  LayoutDashboard, UtensilsCrossed, ClipboardList, Users,
  BarChart2, ScrollText, Settings, Package, Tag, Coffee,
  LogOut, ChevronLeft, ChevronRight, Timer, Shield, Star, Sliders, FlaskConical,
  Bike, TrendingDown, Truck, Wrench, CalendarDays, KeyRound
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import { db, hashPin } from '../../db/database';
import Modal from '../ui/Modal';
import Dashboard from './Dashboard';
import MenuManager from './MenuManager';
import OrderHistory from './OrderHistory';
import StaffManager from './StaffManager';
import Reports from './Reports';
import ActivityLog from './ActivityLog';
import AppSettings from './AppSettings';
import InventoryManager from './InventoryManager';
import DiscountManager from './DiscountManager';
import ShiftManager from './ShiftManager';
import CustomerManager from './CustomerManager';
import ModifierManager from './ModifierManager';
import RecipeManager from './RecipeManager';
import DeliveryManager from './DeliveryManager';
import ExpenseManager from './ExpenseManager';
import SupplierManager from './SupplierManager';
import RiderManager from './RiderManager';
import DeveloperTools from './DeveloperTools';
import StaffHR from './StaffHR';

type AdminView =
  | 'dashboard' | 'menu' | 'orders' | 'staff' | 'staffhr' | 'reports' | 'logs' | 'settings'
  | 'inventory' | 'discounts' | 'shifts' | 'customers' | 'modifiers' | 'recipes'
  | 'delivery' | 'expenses' | 'suppliers' | 'riders' | 'developer';

const navItems: { key: AdminView; label: string; icon: React.FC<any>; section?: string }[] = [
  { key: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard, section: 'Main' },
  { key: 'orders',     label: 'Orders',          icon: ClipboardList },
  { key: 'delivery',   label: 'Delivery Board',  icon: Bike },
  { key: 'customers',  label: 'Customers',       icon: Star },
  { key: 'menu',       label: 'Menu',            icon: UtensilsCrossed, section: 'Catalog' },
  { key: 'modifiers',  label: 'Modifiers',       icon: Sliders },
  { key: 'recipes',    label: 'Recipes & Cost',  icon: FlaskConical },
  { key: 'inventory',  label: 'Inventory',       icon: Package },
  { key: 'discounts',  label: 'Discounts',       icon: Tag },
  { key: 'expenses',   label: 'Expenses',        icon: TrendingDown, section: 'Finance' },
  { key: 'suppliers',  label: 'Suppliers',       icon: Truck },
  { key: 'riders',     label: 'Riders',          icon: Bike },
  { key: 'staff',      label: 'Staff',           icon: Users, section: 'Admin' },
  { key: 'staffhr',   label: 'HR & Payroll',    icon: CalendarDays },
  { key: 'shifts',     label: 'Shifts',          icon: Timer },
  { key: 'reports',    label: 'Reports',         icon: BarChart2 },
  { key: 'logs',       label: 'Activity Logs',   icon: ScrollText },
  { key: 'settings',   label: 'Settings',        icon: Settings },
  { key: 'developer',  label: 'Developer Tools', icon: Wrench },
];

export default function AdminLayout() {
  const [view, setView] = useState<AdminView>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const session = useAppStore(s => s.session);
  const setSession = useAppStore(s => s.setSession);
  const cafeName = useAppStore(s => s.cafeName);

  const [showChangePIN, setShowChangePIN] = useState(false);
  const [pinForm, setPinForm] = useState({ newPin: '', confirmPin: '' });
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const handleLogout = async () => {
    if (!session) return;
    await logActivity(session.id, session.name, session.role, 'auth', 'Logout', 'Admin logged out');
    setSession(null);
  };

  const handleChangePIN = async () => {
    setPinError('');
    if (pinForm.newPin.length < 4) { setPinError('PIN must be at least 4 digits'); return; }
    if (pinForm.newPin !== pinForm.confirmPin) { setPinError('PINs do not match'); return; }
    if (!session) return;
    setPinSaving(true);
    try {
      const hashed = await hashPin(pinForm.newPin);
      await db.users.update(session.id, { pin: hashed });
      await logActivity(session.id, session.name, session.role, 'auth', 'PIN Changed', `${session.name} changed their PIN`);
      setShowChangePIN(false);
      setPinForm({ newPin: '', confirmPin: '' });
    } finally {
      setPinSaving(false);
    }
  };

  const views: Record<AdminView, React.ReactNode> = {
    dashboard: <Dashboard />,
    menu:       <MenuManager />,
    orders:     <OrderHistory />,
    staff:      <StaffManager />,
    reports:    <Reports />,
    logs:       <ActivityLog />,
    settings:   <AppSettings />,
    inventory:  <InventoryManager />,
    discounts:  <DiscountManager />,
    shifts:     <ShiftManager />,
    customers:  <CustomerManager />,
    modifiers:  <ModifierManager />,
    recipes:    <RecipeManager />,
    delivery:   <DeliveryManager />,
    expenses:   <ExpenseManager />,
    suppliers:  <SupplierManager />,
    riders:     <RiderManager />,
    staffhr:    <StaffHR />,
    developer:  <DeveloperTools />,
  };

  let lastSection = '';

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-gray-900 flex flex-col transition-all duration-200 shrink-0`}>
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b border-gray-700 ${collapsed ? 'justify-center' : ''}`}>
          <div className="bg-amber-500 p-1.5 rounded-lg shrink-0">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-bold text-white text-sm truncate">{cafeName}</div>
              <div className="text-xs text-gray-400">Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
          {navItems.map(({ key, label, icon: Icon, section }) => {
            const showSection = section && section !== lastSection && !collapsed;
            if (section) lastSection = section;
            return (
              <div key={key}>
                {showSection && (
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{section}</div>
                )}
                <button
                  onClick={() => setView(key)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                    view === key
                      ? 'bg-amber-500 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </button>
              </div>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t border-gray-700 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-1">
              <Shield className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">{session?.name}</div>
                <div className="text-xs text-gray-500">Administrator</div>
              </div>
            </div>
          )}
          <button
            onClick={() => { setPinForm({ newPin: '', confirmPin: '' }); setPinError(''); setShowChangePIN(true); }}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-amber-400 hover:bg-amber-900/20 hover:text-amber-300 text-sm transition-all ${collapsed ? 'justify-center' : ''}`}
            title="Change my PIN"
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            {!collapsed && 'Change PIN'}
          </button>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-red-400 hover:bg-red-900/30 hover:text-red-300 text-sm transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && 'Logout'}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-1 text-gray-500 hover:text-gray-300 transition-all"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {views[view]}
        </div>
      </main>

      {/* Change PIN Modal */}
      <Modal open={showChangePIN} onClose={() => setShowChangePIN(false)} title="Change My PIN" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Changing PIN for <strong>{session?.name}</strong> ({session?.role})</p>
          <div>
            <label className="text-sm font-medium text-gray-700">New PIN (min 4 digits)</label>
            <input
              type="password"
              value={pinForm.newPin}
              onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value.replace(/\D/g, '') }))}
              maxLength={6}
              placeholder="••••"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Confirm New PIN</label>
            <input
              type="password"
              value={pinForm.confirmPin}
              onChange={e => setPinForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '') }))}
              maxLength={6}
              placeholder="••••"
              onKeyDown={e => e.key === 'Enter' && handleChangePIN()}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
          <button onClick={handleChangePIN} disabled={pinSaving}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white rounded-xl font-semibold">
            {pinSaving ? 'Saving...' : 'Update PIN'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
