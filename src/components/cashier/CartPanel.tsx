import { useState, useEffect } from 'react';
import { Trash2, Plus, Minus, ChevronDown, ShoppingCart, MessageSquare, PauseCircle, Star, Gift, TableProperties } from 'lucide-react';
import { db, getSetting } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { Table, MenuItem } from '../../types';
import PaymentModal from './PaymentModal';
import OrderTypeBar from './OrderTypeBar';
import CustomerSearch from './CustomerSearch';
import DeliveryForm from './DeliveryForm';

interface Props {
  onOpenHold?: () => void;
}

export default function CartPanel({ onOpenHold }: Props) {
  const {
    cart, updateCartQty, removeFromCart, updateCartItemNote, clearCart,
    selectedTableId, selectedTableName, setTable,
    orderNotes, setOrderNotes,
    currencySymbol, taxRate,
    cartSubtotal, cartItemCount,
    orderType,
    selectedCustomer,
    deliveryInfo,
    setLoyaltyRedeemPoints,
    session, setSelectedCustomer,
    takeawayCustomerName, setTakeawayCustomerName,
    takeawayPhone, setTakeawayPhone,
    addToCart,
  } = useAppStore();

  const [tables, setTables] = useState<Table[]>([]);
  const [dealItems, setDealItems] = useState<MenuItem[]>([]);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [pointsRedeemValue, setPointsRedeemValue] = useState(1);
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(0);
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);

  useEffect(() => {
    db.cafeTables.toArray().then(setTables);
    getSetting('loyaltyEnabled', 'false').then(v => setLoyaltyEnabled(v === 'true'));
    getSetting('pointsRedeemValue', '1').then(v => setPointsRedeemValue(Number(v)));
    getSetting('defaultDeliveryFee', '0').then(v => setDefaultDeliveryFee(Number(v)));
    // Load deals from Deals category
    db.categories.filter(c => c.name.toLowerCase() === 'deals').first().then(cat => {
      if (cat?.id) {
        db.menuItems.where('categoryId').equals(cat.id).filter(i => i.available).toArray().then(setDealItems);
      }
    });
  }, []);

  useEffect(() => {
    if (!redeemLoyalty || !selectedCustomer) setLoyaltyRedeemPoints(0);
  }, [redeemLoyalty, selectedCustomer]);

  const subtotal = cartSubtotal();
  const taxAmount = Math.round(subtotal * (taxRate / 100));
  const loyalty = redeemLoyalty && selectedCustomer
    ? Math.min((selectedCustomer.points || 0) * pointsRedeemValue, subtotal + taxAmount)
    : 0;
  const deliveryFee = orderType === 'delivery' ? (deliveryInfo?.deliveryFee ?? defaultDeliveryFee) : 0;
  const total = subtotal + taxAmount - loyalty + deliveryFee;

  const addDealToCart = (deal: MenuItem) => {
    addToCart({
      menuItemId: deal.id!,
      name: deal.name,
      basePrice: deal.price,
      price: deal.price,
      quantity: 1,
      notes: '',
      subtotal: deal.price,
      modifiers: [],
    });
    if (session) logActivity(session.id, session.name, session.role, 'order', 'Deal Added', deal.name);
  };

  const handleHoldOrder = async () => {
    if (cart.length === 0 || !session) return;
    const now = new Date().toISOString();
    const customerName = orderType === 'takeaway'
      ? takeawayCustomerName
      : (selectedCustomer?.name ?? '');
    const orderId = await db.orders.add({
      items: cart,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount: 0,
      discountLabel: '',
      total: subtotal,
      status: 'open',
      tableId: selectedTableId ?? undefined,
      tableName: selectedTableName,
      userId: session.id,
      userName: session.name,
      notes: orderNotes,
      orderType,
      customerId: selectedCustomer?.id,
      customerName,
      deliveryInfo: deliveryInfo ?? undefined,
      deliveryFee: 0,
      loyaltyPointsEarned: 0,
      loyaltyPointsRedeemed: 0,
      loyaltyDiscountAmount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(session.id, session.name, session.role, 'order', 'Order Held', `Order #${orderId} put on hold`);
    clearCart();
    setSelectedCustomer(null);
    onOpenHold?.();
  };

  const isDineIn = orderType === 'dine-in';
  const noTableSelected = isDineIn && !selectedTableId;

  return (
    <div className="w-80 xl:w-96 flex flex-col bg-white border-l border-gray-200 shrink-0">
      {/* Order Type Bar */}
      <OrderTypeBar />

      {/* Takeaway Info */}
      {orderType === 'takeaway' && (
        <div className="px-3 pb-2 space-y-1.5">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide px-1">🛍️ Takeaway Info</div>
          <input
            value={takeawayCustomerName}
            onChange={e => setTakeawayCustomerName(e.target.value)}
            placeholder="Customer Name *"
            className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 bg-blue-50"
          />
          <input
            value={takeawayPhone}
            onChange={e => setTakeawayPhone(e.target.value)}
            placeholder="Phone (optional)"
            type="tel"
            className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 bg-blue-50"
          />
        </div>
      )}

      {/* Table Selector (dine-in only) */}
      {isDineIn && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowTablePicker(!showTablePicker)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
              noTableSelected
                ? 'border-amber-400 bg-amber-50 text-amber-700 animate-pulse'
                : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-amber-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <TableProperties className="w-4 h-4" />
              {noTableSelected ? 'Select Table (required)' : `📍 ${selectedTableName}`}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {showTablePicker && (
            <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
              <div className="grid grid-cols-3 gap-1.5 p-2 max-h-44 overflow-y-auto">
                {tables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTable(t.id!, t.name); setShowTablePicker(false); }}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                      t.id === selectedTableId
                        ? 'bg-amber-500 text-white border-amber-500'
                        : t.status === 'occupied'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-amber-300'
                    }`}
                  >
                    {t.name}
                    {t.status === 'occupied' && <span className="block text-[10px] opacity-70">Occupied</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer Search (loyalty) */}
      {loyaltyEnabled && (
        <div className="px-3 pb-2">
          {selectedCustomer ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{selectedCustomer.name}</div>
                <div className="text-xs text-amber-600">{selectedCustomer.points || 0} pts</div>
              </div>
              {(selectedCustomer.points || 0) > 0 && (
                <button
                  onClick={() => setRedeemLoyalty(!redeemLoyalty)}
                  className={`text-xs px-2 py-1 rounded-full font-medium transition-all ${redeemLoyalty ? 'bg-amber-500 text-white' : 'bg-white border border-amber-300 text-amber-600'}`}
                >
                  {redeemLoyalty ? `- ${currencySymbol}${loyalty}` : 'Redeem'}
                </button>
              )}
              <button onClick={() => { setShowCustomerSearch(true); setRedeemLoyalty(false); }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowCustomerSearch(true)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-amber-300 text-sm text-gray-500">
              <Star className="w-4 h-4 text-amber-400" />
              Add Customer / Loyalty
            </button>
          )}
        </div>
      )}

      {/* Delivery Form */}
      {orderType === 'delivery' && (
        <div className="px-3 pb-2">
          <DeliveryForm />
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
            <ShoppingCart className="w-16 h-16" />
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs">Tap items to add</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {cart.map(item => (
              <div key={item.tempId} className="bg-gray-50 rounded-lg p-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-amber-600 font-medium">{currencySymbol} {item.price.toLocaleString()}</p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-xs text-gray-400 truncate">{item.modifiers.map(m => m.itemName).join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateCartQty(item.tempId, item.quantity - 1)}
                      className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center hover:border-amber-400 text-gray-600">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.tempId, item.quantity + 1)}
                      className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center hover:border-amber-400 text-gray-600">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeFromCart(item.tempId)}
                      className="w-6 h-6 rounded-md bg-red-50 border border-red-100 flex items-center justify-center hover:bg-red-100 text-red-500 ml-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <button onClick={() => setEditingNoteId(editingNoteId === item.tempId ? null : item.tempId)}
                    className="text-xs text-gray-400 hover:text-amber-600 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {item.notes ? item.notes : 'Add note'}
                  </button>
                  <span className="text-sm font-bold text-gray-700">{currencySymbol} {item.subtotal.toLocaleString()}</span>
                </div>
                {editingNoteId === item.tempId && (
                  <input autoFocus type="text" value={item.notes}
                    onChange={e => updateCartItemNote(item.tempId, e.target.value)}
                    onBlur={() => setEditingNoteId(null)}
                    placeholder="Item note (e.g. no sugar)"
                    className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-300" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Notes */}
      <div className="px-3 pb-2">
        <input type="text" value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
          placeholder="Order note..."
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-300" />
      </div>

      {/* Deals Section — always visible */}
      {dealItems.length > 0 && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Gift className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Deals</span>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-1.5 space-y-1 max-h-36 overflow-y-auto scrollbar-thin">
            {dealItems.map(d => (
              <button key={d.id} onClick={() => addDealToCart(d)}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-purple-100 text-xs transition-all flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-semibold text-gray-800">{d.name}</span>
                  {d.description && <span className="text-gray-400 block truncate">{d.description}</span>}
                </div>
                <span className="text-purple-700 font-bold shrink-0">{currencySymbol} {d.price.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 space-y-1 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal ({cartItemCount()} items)</span>
          <span>{currencySymbol} {subtotal.toLocaleString()}</span>
        </div>
        {taxRate > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Tax ({taxRate}%)</span>
            <span>{currencySymbol} {taxAmount.toLocaleString()}</span>
          </div>
        )}
        {loyalty > 0 && (
          <div className="flex justify-between text-amber-600">
            <span>Loyalty Discount</span>
            <span>- {currencySymbol} {loyalty.toLocaleString()}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between text-blue-600">
            <span>Delivery Fee</span>
            <span>+ {currencySymbol} {deliveryFee.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
          <span>Total</span>
          <span className="text-amber-600">{currencySymbol} {Math.max(0, total).toLocaleString()}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 flex gap-2">
        {cart.length > 0 && (
          <button onClick={handleHoldOrder}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-all">
            <PauseCircle className="w-4 h-4" /> Hold
          </button>
        )}
        <button
          disabled={cart.length === 0 || (isDineIn && noTableSelected)}
          onClick={() => setShowPayment(true)}
          className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-base transition-all active:scale-95"
          title={noTableSelected ? 'Please select a table first' : ''}
        >
          {isDineIn && noTableSelected
            ? 'Select Table First'
            : isDineIn
            ? `Confirm Order`
            : `Charge ${currencySymbol} ${Math.max(0, total).toLocaleString()}`}
        </button>
      </div>

      {showCustomerSearch && (
        <CustomerSearch onClose={() => setShowCustomerSearch(false)} />
      )}

      {showPayment && (
        <PaymentModal
          subtotal={subtotal}
          taxAmount={taxAmount}
          discountAmount={0}
          loyaltyDiscount={loyalty}
          loyaltyPointsRedeemed={redeemLoyalty && selectedCustomer ? Math.floor(loyalty / pointsRedeemValue) : 0}
          deliveryFee={deliveryFee}
          discountId={undefined}
          discountLabel=""
          total={Math.max(0, total)}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false);
            setRedeemLoyalty(false);
          }}
        />
      )}
    </div>
  );
}
