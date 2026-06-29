export type UserRole = string; // 'admin' and 'cashier' have POS access; any string allowed for staff records

export interface User {
  id?: number;
  name: string;
  pin: string;
  role: string; // 'admin' / 'cashier' = POS access; any other string = staff record only
  active: boolean;
  createdAt: string;
  lastLogin?: string;
  monthlySalary?: number;
  workingDaysPerMonth?: number; // default 26
  joiningDate?: string;
}

export interface Category {
  id?: number;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  group?: string; // optional group header, e.g. "Pizza", "Sides", "Drinks"
  active: boolean;
}

export interface ModifierItem {
  name: string;
  price: number;
}

export interface ModifierGroup {
  id?: number;
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  items: ModifierItem[];
}

export interface MenuItemModifierLink {
  id?: number;
  menuItemId: number;
  modifierGroupId: number;
}

export interface MenuItem {
  id?: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  cost: number;
  available: boolean;
  sortOrder: number;
}

export interface Table {
  id?: number;
  name: string;
  capacity: number;
  status: 'free' | 'occupied';
  activeOrderId?: number;
}

export type OrderStatus = 'open' | 'preparing' | 'ready' | 'served' | 'paid' | 'voided' | 'pending-payment';
export type PaymentMethod = 'cash' | 'card' | 'split' | 'cod' | 'pending';
export type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export interface SelectedModifier {
  groupId: number;
  groupName: string;
  itemName: string;
  price: number;
}

export interface OrderItem {
  menuItemId: number;
  name: string;
  basePrice: number;
  price: number;
  quantity: number;
  notes: string;
  subtotal: number;
  modifiers: SelectedModifier[];
}

export interface DeliveryInfo {
  customerName: string;
  phone: string;
  address: string;
  area: string;
  deliveryFee: number;
  estimatedMinutes: number;
  riderId?: number;
  riderName: string;
  notes: string;
}

export interface SplitPayment {
  method: PaymentMethod;
  amount: number;
}

export interface Order {
  id?: number;
  orderType: OrderType;
  tableId?: number;
  tableName: string;
  userId: number;
  userName: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountId?: number;
  discountLabel: string;
  discountAmount: number;
  deliveryFee: number;
  total: number;
  paymentMethod?: PaymentMethod;
  splitPayments?: SplitPayment[];
  amountPaid?: number;
  change?: number;
  customerId?: number;
  customerName: string;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountAmount: number;
  deliveryInfo?: DeliveryInfo;
  notes: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  shiftId?: number;
}

export interface Shift {
  id?: number;
  openedBy: number;
  openedByName: string;
  openedAt: string;
  closedBy?: number;
  closedByName?: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  totalSales: number;
  totalOrders: number;
  totalCash: number;
  totalCard: number;
  totalVoided: number;
}

export type LogCategory =
  | 'auth' | 'order' | 'menu' | 'staff' | 'settings' | 'shift'
  | 'inventory' | 'discount' | 'customer' | 'delivery' | 'expense' | 'supplier';

export interface ActivityLog {
  id?: number;
  userId: number;
  userName: string;
  role: UserRole;
  action: string;
  category: LogCategory;
  details: string;
  timestamp: string;
}

export type DiscountType = 'percent' | 'fixed';

export interface Discount {
  id?: number;
  name: string;
  type: DiscountType;
  value: number;
  code: string;
  minOrder: number;
  active: boolean;
  usageCount: number;
}

export interface InventoryItem {
  id?: number;
  menuItemId: number;
  itemName: string;
  currentStock: number;
  unit: string;
  lowStockAlert: number;
  lastUpdated: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
}

export interface Recipe {
  id?: number;
  menuItemId: number;
  menuItemName: string;
  ingredients: RecipeIngredient[];
  totalCost: number;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  email: string;
  points: number;
  totalOrders: number;
  totalSpent: number;
  notes: string;
  createdAt: string;
  lastVisit?: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface SessionUser {
  id: number;
  name: string;
  role: UserRole;
  loginTime: string;
  shiftId?: number;
}

export interface CartItem extends OrderItem {
  tempId: string;
}

export interface DailySummary {
  date: string;
  totalOrders: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  avgOrderValue: number;
}

// ─── New types for Phase 3 ───────────────────────────────────────────────────

export interface Expense {
  id?: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  paidVia: string;
  paidTo: string;
  notes: string;
  createdAt: string;
  createdBy: string;
}

export interface Supplier {
  id?: number;
  name: string;
  contactPerson: string;
  phone: string;
  category: string;
  address: string;
  notes: string;
  active: boolean;
  createdAt: string;
}

export interface SupplierTransaction {
  id?: number;
  supplierId: number;
  supplierName: string;
  description: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  date: string;
  dueDate: string;
  status: 'pending' | 'partial' | 'paid';
  notes: string;
  createdAt: string;
}

export interface Rider {
  id?: number;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleNumber: string;
  active: boolean;
  totalDeliveries: number;
  createdAt: string;
}

export type LeaveType = 'sick' | 'casual' | 'annual' | 'lop';

export interface StaffLeave {
  id?: number;
  userId: number;
  userName: string;
  date: string; // YYYY-MM-DD
  leaveType: LeaveType;
  reason: string;
  approved: boolean;
  createdAt: string;
  createdBy: string;
}

export interface StaffAdvance {
  id?: number;
  userId: number;
  userName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  reason: string;
  repaid: boolean;
  repaidDate?: string;
  notes: string;
  createdAt: string;
  createdBy: string;
}
