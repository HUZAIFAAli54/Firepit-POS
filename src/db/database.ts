import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  User, Category, MenuItem, Table as TableType,
  Order, Shift, ActivityLog, Discount, InventoryItem, Setting,
  Customer, ModifierGroup, MenuItemModifierLink, Recipe,
  Expense, Supplier, SupplierTransaction, Rider,
  StaffLeave, StaffAdvance
} from '../types';

class CafePosDatabase extends Dexie {
  users!: Table<User, number>;
  categories!: Table<Category, number>;
  menuItems!: Table<MenuItem, number>;
  cafeTables!: Table<TableType, number>;
  orders!: Table<Order, number>;
  shifts!: Table<Shift, number>;
  activityLogs!: Table<ActivityLog, number>;
  discounts!: Table<Discount, number>;
  inventory!: Table<InventoryItem, number>;
  settings!: Table<Setting, string>;
  customers!: Table<Customer, number>;
  modifierGroups!: Table<ModifierGroup, number>;
  menuItemModifiers!: Table<MenuItemModifierLink, number>;
  recipes!: Table<Recipe, number>;
  expenses!: Table<Expense, number>;
  suppliers!: Table<Supplier, number>;
  supplierTransactions!: Table<SupplierTransaction, number>;
  riders!: Table<Rider, number>;
  staffLeaves!: Table<StaffLeave, number>;
  staffAdvances!: Table<StaffAdvance, number>;

  constructor() {
    super('CafePosDB');

    this.version(1).stores({
      users: '++id, role, active',
      categories: '++id, sortOrder, active',
      menuItems: '++id, categoryId, available',
      cafeTables: '++id, status',
      orders: '++id, status, shiftId, createdAt, userId, tableId',
      shifts: '++id, openedAt, closedAt',
      activityLogs: '++id, userId, category, timestamp',
      discounts: '++id, code, active',
      inventory: '++id, menuItemId',
      settings: 'key',
    });

    this.version(2).stores({
      orders: '++id, status, shiftId, createdAt, userId, tableId, orderType, customerId',
      customers: '++id, phone, name',
      modifierGroups: '++id',
      menuItemModifiers: '++id, menuItemId, modifierGroupId',
      recipes: '++id, menuItemId',
    });

    this.version(3).stores({
      expenses: '++id, date, category',
      suppliers: '++id, name, active',
      supplierTransactions: '++id, supplierId, date, status',
      riders: '++id, active',
    });

    this.version(4).stores({
      categories: '++id, sortOrder, active, group',
    });

    this.version(5).stores({
      staffLeaves:   '++id, userId, date, leaveType, approved',
      staffAdvances: '++id, userId, date, repaid',
    });

    // v6: index sortOrder on menuItems (DeveloperTools "Fix Sort Orders"
    // uses orderBy('sortOrder') — without this index Dexie throws SchemaError)
    this.version(6).stores({
      menuItems: '++id, categoryId, available, sortOrder',
    });
  }
}

export const db = new CafePosDatabase();

// Singleton promise — prevents concurrent double-init (React dev mode, etc.)
let _initPromise: Promise<void> | null = null;
export function initializeDatabase(): Promise<void> {
  if (!_initPromise) _initPromise = _doInit();
  return _initPromise;
}

async function _doInit() {
  const userCount = await db.users.count();

  if (userCount === 0) {
    const adminPin = await hashPin('1234');
    const cashierPin = await hashPin('5678');

    await db.users.bulkAdd([
      { name: 'Admin', pin: adminPin, role: 'admin', active: true, createdAt: new Date().toISOString() },
      { name: 'Cashier', pin: cashierPin, role: 'cashier', active: true, createdAt: new Date().toISOString() },
    ]);

    await db.categories.bulkAdd([
      { name: 'Tandoori Pizza',  icon: '🍕', color: '#f97316', sortOrder: 1,  group: 'Pizza',  active: true },
      { name: 'Special Pizza',   icon: '🍕', color: '#dc2626', sortOrder: 2,  group: 'Pizza',  active: true },
      { name: 'Firepit Specials',icon: '🔥', color: '#eab308', sortOrder: 3,  group: 'Pizza',  active: true },
      { name: 'Burgers',         icon: '🍔', color: '#16a34a', sortOrder: 4,  group: 'Grills', active: true },
      { name: 'Roll Paratha',    icon: '🌯', color: '#8b5cf6', sortOrder: 5,  group: 'Grills', active: true },
      { name: 'Crispy Chicken',  icon: '🍗', color: '#ef4444', sortOrder: 6,  group: 'Grills', active: true },
      { name: 'Wings',           icon: '🍗', color: '#f59e0b', sortOrder: 7,  group: 'Grills', active: true },
      { name: 'Fries',           icon: '🍟', color: '#eab308', sortOrder: 8,  group: 'Sides',  active: true },
      { name: 'Deals',           icon: '🎉', color: '#0ea5e9', sortOrder: 9,  group: 'Deals',  active: true },
      { name: 'Extras',          icon: '➕', color: '#6b7280', sortOrder: 10, group: 'Sides',  active: true },
      { name: 'Drinks',          icon: '🥤', color: '#06b6d4', sortOrder: 11, group: 'Drinks', active: true },
    ]);

    const categories = await db.categories.toArray();
    const catMap: Record<string, number> = {};
    categories.forEach(c => {
      catMap[c.name] = c.id!;
    });

    await db.menuItems.bulkAdd([
      // Tandoori Pizza
      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Fajita (Small)', description: 'Tandoori pizza - small', price: 400, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Fajita (Medium)', description: 'Tandoori pizza - medium', price: 800, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Fajita (Large)', description: 'Tandoori pizza - large', price: 1100, cost: 0, available: true, sortOrder: 3 },

      { categoryId: catMap['Tandoori Pizza'], name: 'Malai Boti (Small)', description: 'Tandoori pizza - small', price: 400, cost: 0, available: true, sortOrder: 4 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Malai Boti (Medium)', description: 'Tandoori pizza - medium', price: 800, cost: 0, available: true, sortOrder: 5 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Malai Boti (Large)', description: 'Tandoori pizza - large', price: 1100, cost: 0, available: true, sortOrder: 6 },

      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Tikka (Small)', description: 'Tandoori pizza - small', price: 400, cost: 0, available: true, sortOrder: 7 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Tikka (Medium)', description: 'Tandoori pizza - medium', price: 800, cost: 0, available: true, sortOrder: 8 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Tikka (Large)', description: 'Tandoori pizza - large', price: 1100, cost: 0, available: true, sortOrder: 9 },

      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Supreme (Small)', description: 'Tandoori pizza - small', price: 400, cost: 0, available: true, sortOrder: 10 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Supreme (Medium)', description: 'Tandoori pizza - medium', price: 800, cost: 0, available: true, sortOrder: 11 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Chicken Supreme (Large)', description: 'Tandoori pizza - large', price: 1100, cost: 0, available: true, sortOrder: 12 },

      { categoryId: catMap['Tandoori Pizza'], name: 'Peri Peri Pizza (Small)', description: 'Tandoori pizza - small', price: 400, cost: 0, available: true, sortOrder: 13 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Peri Peri Pizza (Medium)', description: 'Tandoori pizza - medium', price: 800, cost: 0, available: true, sortOrder: 14 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Peri Peri Pizza (Large)', description: 'Tandoori pizza - large', price: 1100, cost: 0, available: true, sortOrder: 15 },

      { categoryId: catMap['Tandoori Pizza'], name: 'BBQ Ranch (Small)', description: 'Tandoori pizza - small', price: 400, cost: 0, available: true, sortOrder: 16 },
      { categoryId: catMap['Tandoori Pizza'], name: 'BBQ Ranch (Medium)', description: 'Tandoori pizza - medium', price: 800, cost: 0, available: true, sortOrder: 17 },
      { categoryId: catMap['Tandoori Pizza'], name: 'BBQ Ranch (Large)', description: 'Tandoori pizza - large', price: 1100, cost: 0, available: true, sortOrder: 18 },

      { categoryId: catMap['Tandoori Pizza'], name: 'Hot & Spicy (Small)', description: 'Tandoori pizza - small', price: 400, cost: 0, available: true, sortOrder: 19 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Hot & Spicy (Medium)', description: 'Tandoori pizza - medium', price: 800, cost: 0, available: true, sortOrder: 20 },
      { categoryId: catMap['Tandoori Pizza'], name: 'Hot & Spicy (Large)', description: 'Tandoori pizza - large', price: 1100, cost: 0, available: true, sortOrder: 21 },

      // Special Pizza
      { categoryId: catMap['Special Pizza'], name: 'Cheeze Lover (Small)', description: 'Special pizza - small', price: 500, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Special Pizza'], name: 'Cheeze Lover (Medium)', description: 'Special pizza - medium', price: 900, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Special Pizza'], name: 'Cheeze Lover (Large)', description: 'Special pizza - large', price: 1200, cost: 0, available: true, sortOrder: 3 },

      { categoryId: catMap['Special Pizza'], name: 'Bihari Kabab (Small)', description: 'Special pizza - small', price: 500, cost: 0, available: true, sortOrder: 4 },
      { categoryId: catMap['Special Pizza'], name: 'Bihari Kabab (Medium)', description: 'Special pizza - medium', price: 900, cost: 0, available: true, sortOrder: 5 },
      { categoryId: catMap['Special Pizza'], name: 'Bihari Kabab (Large)', description: 'Special pizza - large', price: 1200, cost: 0, available: true, sortOrder: 6 },

      { categoryId: catMap['Special Pizza'], name: 'Kabab Special (Small)', description: 'Special pizza - small', price: 500, cost: 0, available: true, sortOrder: 7 },
      { categoryId: catMap['Special Pizza'], name: 'Kabab Special (Medium)', description: 'Special pizza - medium', price: 900, cost: 0, available: true, sortOrder: 8 },
      { categoryId: catMap['Special Pizza'], name: 'Kabab Special (Large)', description: 'Special pizza - large', price: 1200, cost: 0, available: true, sortOrder: 9 },

      { categoryId: catMap['Special Pizza'], name: 'Bonfire (Spicy) (Small)', description: 'Special pizza - small', price: 500, cost: 0, available: true, sortOrder: 10 },
      { categoryId: catMap['Special Pizza'], name: 'Bonfire (Spicy) (Medium)', description: 'Special pizza - medium', price: 900, cost: 0, available: true, sortOrder: 11 },
      { categoryId: catMap['Special Pizza'], name: 'Bonfire (Spicy) (Large)', description: 'Special pizza - large', price: 1200, cost: 0, available: true, sortOrder: 12 },

      // Firepit Specials
      { categoryId: catMap['Firepit Specials'], name: 'Kabab Crust (Medium)', description: 'Firepit special pizza - medium', price: 1000, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Firepit Specials'], name: 'Kabab Crust (Large)', description: 'Firepit special pizza - large', price: 1400, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Firepit Specials'], name: 'Crown Crust (Medium)', description: 'Firepit special pizza - medium', price: 1000, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Firepit Specials'], name: 'Crown Crust (Large)', description: 'Firepit special pizza - large', price: 1400, cost: 0, available: true, sortOrder: 4 },
      { categoryId: catMap['Firepit Specials'], name: 'Cheeze Crust (Medium)', description: 'Firepit special pizza - medium', price: 1000, cost: 0, available: true, sortOrder: 5 },
      { categoryId: catMap['Firepit Specials'], name: 'Cheeze Crust (Large)', description: 'Firepit special pizza - large', price: 1400, cost: 0, available: true, sortOrder: 6 },
      { categoryId: catMap['Firepit Specials'], name: 'Firepit Special (Medium)', description: 'Firepit special pizza - medium', price: 1000, cost: 0, available: true, sortOrder: 7 },
      { categoryId: catMap['Firepit Specials'], name: 'Firepit Special (Large)', description: 'Firepit special pizza - large', price: 1400, cost: 0, available: true, sortOrder: 8 },

      // Burgers
      { categoryId: catMap['Burgers'], name: 'Zinger Burger', description: 'Burger', price: 350, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Burgers'], name: 'Mighty Burger', description: 'Burger', price: 450, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Burgers'], name: 'Pizza Burger', description: 'Burger', price: 500, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Burgers'], name: 'Fire Pit Special', description: 'Burger', price: 500, cost: 0, available: true, sortOrder: 4 },

      // Roll Paratha
      { categoryId: catMap['Roll Paratha'], name: 'Chicken Paratha Roll', description: 'Roll paratha', price: 300, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Roll Paratha'], name: 'Zinger Paratha Roll', description: 'Roll paratha', price: 350, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Roll Paratha'], name: 'Bihari Roll', description: 'Roll paratha', price: 500, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Roll Paratha'], name: 'Spin Roll', description: 'Roll paratha', price: 600, cost: 0, available: true, sortOrder: 4 },

      // Crispy Chicken
      { categoryId: catMap['Crispy Chicken'], name: 'Leg Broast (4 Pcs)', description: 'Crispy chicken', price: 600, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Crispy Chicken'], name: 'Chest Broast', description: 'Crispy chicken', price: 550, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Crispy Chicken'], name: 'Nuggets (6pc)', description: 'Crispy chicken', price: 300, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Crispy Chicken'], name: 'Nuggets (12pc)', description: 'Crispy chicken', price: 550, cost: 0, available: true, sortOrder: 4 },

      // Wings
      { categoryId: catMap['Wings'], name: 'Crispy Wings (6pc)', description: 'Wings', price: 300, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Wings'], name: 'Crispy Wings (12pc)', description: 'Wings', price: 600, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Wings'], name: 'BBQ Wings (6pc)', description: 'Wings', price: 300, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Wings'], name: 'BBQ Wings (12pc)', description: 'Wings', price: 600, cost: 0, available: true, sortOrder: 4 },

      // Fries
      { categoryId: catMap['Fries'], name: 'Plain Fries (Single)', description: 'Fries', price: 200, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Fries'], name: 'Plain Fries (Double)', description: 'Fries', price: 400, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Fries'], name: 'Loaded Fries (Single)', description: 'Fries', price: 450, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Fries'], name: 'Loaded Fries (Double)', description: 'Fries', price: 650, cost: 0, available: true, sortOrder: 4 },

      // Deals
      { categoryId: catMap['Deals'], name: 'Deal 1', description: '1 Zinger, 1 Fries, 300ml Drink', price: 550, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Deals'], name: 'Deal 2', description: '1 Small Pizza, 1 Fries, 300ml Drink', price: 599, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Deals'], name: 'Deal 3', description: '1 Regular Fries, Wings (6pc), Nuggets (6pc), 300ml Drink', price: 850, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Deals'], name: 'Deal 4', description: '1 Broast Chest, 2 Broast Leg, 1 Single Fries, 1 Ltr Drink', price: 1150, cost: 0, available: true, sortOrder: 4 },
      { categoryId: catMap['Deals'], name: 'Deal 5', description: '1 Zinger, 1 Paratha Roll, 1 Loaded Fries, 1 Ltr Drink', price: 1199, cost: 0, available: true, sortOrder: 5 },
      { categoryId: catMap['Deals'], name: 'Deal 6', description: '1 Medium Pizza, 2 Leg Broast, 1 Fries, 1 Ltr Drink', price: 1350, cost: 0, available: true, sortOrder: 6 },
      { categoryId: catMap['Deals'], name: 'Deal 7', description: '1 Large Pizza, Wings (6), Nuggets (6), 1.5 Ltr Drink', price: 1800, cost: 0, available: true, sortOrder: 7 },
      { categoryId: catMap['Deals'], name: 'Deal 8', description: '5 Zinger, 1.5 Ltr Drink', price: 1850, cost: 0, available: true, sortOrder: 8 },
      { categoryId: catMap['Deals'], name: 'Deal 9', description: '1 Large Pizza, 1 Medium Pizza, 1 Fries, 1 Zinger, 1.5 Ltr Drink', price: 2500, cost: 0, available: true, sortOrder: 9 },
      { categoryId: catMap['Deals'], name: 'Deal 10', description: '2 Large Pizza, 1 Paratha Roll, Nuggets (12pc), Wings (12pc), 1 Loaded Fries, 2.25 Ltr Drink', price: 4000, cost: 0, available: true, sortOrder: 10 },

      // Extras
      { categoryId: catMap['Extras'], name: 'Peri Peri Dip Sauce', description: 'Extra', price: 50, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Extras'], name: 'Garlic Mayo Dip', description: 'Extra', price: 50, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Extras'], name: 'Extra Toppings', description: 'Extra', price: 100, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Extras'], name: 'Cheese Slice', description: 'Extra', price: 50, cost: 0, available: true, sortOrder: 4 },

      // Drinks
      { categoryId: catMap['Drinks'], name: '300ml Drink', description: 'Soft drink', price: 0, cost: 0, available: true, sortOrder: 1 },
      { categoryId: catMap['Drinks'], name: '1 Ltr Drink', description: 'Soft drink', price: 0, cost: 0, available: true, sortOrder: 2 },
      { categoryId: catMap['Drinks'], name: '1.5 Ltr Drink', description: 'Soft drink', price: 0, cost: 0, available: true, sortOrder: 3 },
      { categoryId: catMap['Drinks'], name: '2.25 Ltr Drink', description: 'Soft drink', price: 0, cost: 0, available: true, sortOrder: 4 },
    ]);

    await db.cafeTables.bulkAdd([
      { name: 'Table 1', capacity: 2, status: 'free' },
      { name: 'Table 2', capacity: 2, status: 'free' },
      { name: 'Table 3', capacity: 4, status: 'free' },
      { name: 'Table 4', capacity: 4, status: 'free' },
      { name: 'Table 5', capacity: 6, status: 'free' },
      { name: 'Table 6', capacity: 6, status: 'free' },
      { name: 'Takeaway', capacity: 0, status: 'free' },
    ]);

    await db.settings.bulkAdd([
      { key: 'cafeName', value: 'Fire Pit Tandoori Pizza' },
      { key: 'currency', value: 'Rs.' },
      { key: 'taxRate', value: '0' },
      { key: 'receiptFooter', value: 'Thank you for your order!' },
      { key: 'address', value: 'Opposite Shabbir Road, near Ani Centre, Rachna Town' },
      { key: 'phone', value: '0332-0683333' },
      { key: 'loyaltyEnabled', value: 'true' },
      { key: 'pointsPerAmount', value: '10' },
      { key: 'pointsRedeemValue', value: '1' },
      { key: 'defaultDeliveryFee', value: '100' },
    ]);
  } else {
    // One-time dedup: remove items/categories that were seeded twice due to StrictMode bug
    const dedupDone = await db.settings.get('dedup_v1_done');
    if (!dedupDone) {
      const items = await db.menuItems.toArray();
      const seenItems = new Map<string, number>();
      for (const item of items) {
        const key = `${item.categoryId}::${item.name.trim().toLowerCase()}`;
        if (seenItems.has(key)) {
          await db.menuItems.delete(item.id!);
        } else {
          seenItems.set(key, item.id!);
        }
      }
      const cats = await db.categories.toArray();
      const seenCats = new Map<string, number>();
      for (const cat of cats) {
        const key = cat.name.trim().toLowerCase();
        if (seenCats.has(key)) {
          await db.menuItems.where('categoryId').equals(cat.id!).modify({ categoryId: seenCats.get(key)! });
          await db.categories.delete(cat.id!);
        } else {
          seenCats.set(key, cat.id!);
        }
      }
      await db.settings.put({ key: 'dedup_v1_done', value: 'true' });
    }

    const newDefaults = [
      { key: 'loyaltyEnabled', value: 'true' },
      { key: 'pointsPerAmount', value: '10' },
      { key: 'pointsRedeemValue', value: '1' },
      { key: 'defaultDeliveryFee', value: '100' },
      { key: 'cafeName', value: 'Fire Pit Tandoori Pizza' },
      { key: 'currency', value: 'Rs.' },
      { key: 'phone', value: '0332-0683333' },
    ];

    for (const s of newDefaults) {
      const existing = await db.settings.get(s.key);
      if (!existing) await db.settings.add(s);
    }
  }

  // Every install (new or existing) must have a PIN-recovery code
  await ensureRecoveryCode();
}

function generateRecoveryCode(): string {
  // Unambiguous chars only (no 0/O, 1/I/L)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[arr[i] % chars.length];
  return code;
}

/** Returns the stored PIN-recovery code, generating one on first use. */
export async function ensureRecoveryCode(): Promise<string> {
  let code = await getSetting('recoveryCode');
  if (!code) {
    code = generateRecoveryCode();
    await setSetting('recoveryCode', code);
  }
  return code;
}

/** Replaces the recovery code with a fresh one and returns it. */
export async function regenerateRecoveryCode(): Promise<string> {
  const code = generateRecoveryCode();
  await setSetting('recoveryCode', code);
  return code;
}

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'cafe-pos-secure-salt-v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const s = await db.settings.get(key);
  return s?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
