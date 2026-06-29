import { create } from 'zustand';
import type { SessionUser, CartItem, OrderType, Customer, DeliveryInfo } from '../types';

interface AppState {
  session: SessionUser | null;
  cart: CartItem[];
  orderType: OrderType;
  selectedTableId: number | null;
  selectedTableName: string;
  orderNotes: string;
  activeOrderId: number | null;
  currencySymbol: string;
  cafeName: string;
  taxRate: number;
  selectedCustomer: Customer | null;
  deliveryInfo: DeliveryInfo | null;
  loyaltyRedeemPoints: number;
  takeawayCustomerName: string;
  takeawayPhone: string;

  setSession: (user: SessionUser | null) => void;
  setShiftId: (shiftId: number) => void;
  setTakeawayCustomerName: (name: string) => void;
  setTakeawayPhone: (phone: string) => void;
  setOrderType: (type: OrderType) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setDeliveryInfo: (d: DeliveryInfo | null) => void;
  setLoyaltyRedeemPoints: (pts: number) => void;
  addToCart: (item: Omit<CartItem, 'tempId'>) => void;
  updateCartQty: (tempId: string, qty: number) => void;
  removeFromCart: (tempId: string) => void;
  updateCartItemNote: (tempId: string, note: string) => void;
  clearCart: () => void;
  setTable: (id: number | null, name: string) => void;
  setOrderNotes: (notes: string) => void;
  setActiveOrderId: (id: number | null) => void;
  setCurrencySymbol: (s: string) => void;
  setCafeName: (n: string) => void;
  setTaxRate: (r: number) => void;

  cartSubtotal: () => number;
  cartItemCount: () => number;
}

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  cart: [],
  orderType: 'dine-in',
  selectedTableId: null,
  selectedTableName: 'Table no',
  orderNotes: '',
  activeOrderId: null,
  currencySymbol: 'Rs.',
  cafeName: 'Firepit Tandoori Pizza',
  taxRate: 0,
  selectedCustomer: null,
  deliveryInfo: null,
  loyaltyRedeemPoints: 0,
  takeawayCustomerName: '',
  takeawayPhone: '',

  setSession: (user) => {
    if (user) localStorage.setItem('pos_session', JSON.stringify(user));
    else localStorage.removeItem('pos_session');
    set({ session: user });
  },
  setTakeawayCustomerName: (name) => set({ takeawayCustomerName: name }),
  setTakeawayPhone: (phone) => set({ takeawayPhone: phone }),
  setShiftId: (shiftId) => set((s) => {
    const newSession = s.session ? { ...s.session, shiftId } : null;
    if (newSession) localStorage.setItem('pos_session', JSON.stringify(newSession));
    return { session: newSession };
  }),
  setOrderType: (type) => set({ orderType: type }),
  setSelectedCustomer: (c) => set({ selectedCustomer: c, loyaltyRedeemPoints: 0 }),
  setDeliveryInfo: (d) => set({ deliveryInfo: d }),
  setLoyaltyRedeemPoints: (pts) => set({ loyaltyRedeemPoints: pts }),

  addToCart: (item) => set((state) => {
    // Two items are the same only if same menuItemId AND same modifiers
    const modKey = JSON.stringify(item.modifiers ?? []);
    const existing = state.cart.find(
      c => c.menuItemId === item.menuItemId &&
           c.notes === item.notes &&
           JSON.stringify(c.modifiers ?? []) === modKey
    );
    if (existing) {
      const newQty = existing.quantity + item.quantity;
      return {
        cart: state.cart.map(c =>
          c.tempId === existing.tempId
            ? { ...c, quantity: newQty, subtotal: newQty * c.price }
            : c
        ),
      };
    }
    const tempId = Math.random().toString(36).slice(2);
    return { cart: [...state.cart, { ...item, tempId }] };
  }),

  updateCartQty: (tempId, qty) => set((state) => ({
    cart: qty <= 0
      ? state.cart.filter(c => c.tempId !== tempId)
      : state.cart.map(c =>
          c.tempId === tempId ? { ...c, quantity: qty, subtotal: qty * c.price } : c
        ),
  })),

  removeFromCart: (tempId) => set((state) => ({
    cart: state.cart.filter(c => c.tempId !== tempId),
  })),

  updateCartItemNote: (tempId, note) => set((state) => ({
    cart: state.cart.map(c => c.tempId === tempId ? { ...c, notes: note } : c),
  })),

  clearCart: () => set({
    cart: [],
    orderType: 'dine-in',
    selectedTableId: null,
    selectedTableName: 'Takeaway',
    orderNotes: '',
    activeOrderId: null,
    selectedCustomer: null,
    deliveryInfo: null,
    loyaltyRedeemPoints: 0,
    takeawayCustomerName: '',
    takeawayPhone: '',
  }),

  setTable: (id, name) => set({ selectedTableId: id, selectedTableName: name }),
  setOrderNotes: (notes) => set({ orderNotes: notes }),
  setActiveOrderId: (id) => set({ activeOrderId: id }),
  setCurrencySymbol: (s) => set({ currencySymbol: s }),
  setCafeName: (n) => set({ cafeName: n }),
  setTaxRate: (r) => set({ taxRate: r }),

  cartSubtotal: () => get().cart.reduce((sum, c) => sum + c.subtotal, 0),
  cartItemCount: () => get().cart.reduce((sum, c) => sum + c.quantity, 0),
}));
