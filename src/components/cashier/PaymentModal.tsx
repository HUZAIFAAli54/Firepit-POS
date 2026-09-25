import { useState, useRef, useEffect } from 'react';
import { CreditCard, Banknote, CheckCircle, SplitSquareHorizontal, Bike, Clock } from 'lucide-react';
import Modal from '../ui/Modal';
import { db, getSetting } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { PaymentMethod } from '../../types';
import ReceiptModal from './ReceiptModal';
import SplitPaymentModal from './SplitPaymentModal';
import type { SplitPayment } from '../../types';

interface Props {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  loyaltyDiscount: number;
  loyaltyPointsRedeemed: number;
  deliveryFee: number;
  discountId?: number;
  discountLabel: string;
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({
  subtotal, taxAmount, discountAmount, loyaltyDiscount, loyaltyPointsRedeemed,
  deliveryFee, discountId, discountLabel, total, onClose, onSuccess,
}: Props) {
  const {
    cart, selectedTableId, selectedTableName, orderNotes, session, taxRate, currencySymbol,
    clearCart, orderType, selectedCustomer, deliveryInfo, setSelectedCustomer,
    takeawayCustomerName,
  } = useAppStore();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<number | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDineIn = orderType === 'dine-in';
  const isDelivery = orderType === 'delivery';
  const isCODMethod = method === 'cod';
  const isPending = method === 'pending';

  useEffect(() => {
    if (method === 'cash') inputRef.current?.focus();
  }, [method]);

  const paid = parseFloat(amountPaid) || 0;
  const change = method === 'cash' ? paid - total : 0;
  const canPay = method === 'card' || method === 'cod' || method === 'pending' || paid >= total;

  const quickAmounts = [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000]
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);

  const handlePay = async (splitPayments?: SplitPayment[]) => {
    if (!session) return;
    if (!splitPayments && !canPay) return;
    setLoading(true);
    try {
      // All database writes for one payment run inside a single transaction,
      // so a failure midway can't leave half-written state (e.g. an order
      // without its shift totals or customer points update).
      const result = await db.transaction(
        'rw',
        [db.orders, db.shifts, db.cafeTables, db.customers, db.discounts, db.riders, db.settings, db.activityLogs],
        async () => {
          const now = new Date().toISOString();

          let shiftId = session.shiftId;
          if (!shiftId) {
            shiftId = await db.shifts.add({
              openedBy: session.id,
              openedByName: session.name,
              openedAt: now,
              openingBalance: 0,
              totalSales: 0,
              totalOrders: 0,
              totalCash: 0,
              totalCard: 0,
              totalVoided: 0,
            });
            useAppStore.getState().setShiftId(shiftId);
          }

          const pointsPerAmount = Number(await getSetting('pointsPerAmount', '10'));
          const pointsEarned = selectedCustomer ? Math.floor(subtotal / pointsPerAmount) : 0;

          const effectiveMethod = splitPayments ? 'split' as PaymentMethod : method;
          const customerName = orderType === 'takeaway'
            ? takeawayCustomerName
            : (selectedCustomer?.name ?? '');
          const items = cart.map(({ tempId: _tempId, ...rest }) => rest);

          // Pending payment: save order as pending-payment, no financial records yet
          if (isPending) {
            const orderId = await db.orders.add({
              tableId: selectedTableId ?? undefined,
              tableName: selectedTableName,
              userId: session.id,
              userName: session.name,
              status: 'pending-payment',
              items,
              subtotal,
              taxRate,
              taxAmount,
              discountId,
              discountLabel,
              discountAmount,
              loyaltyPointsEarned: 0,
              loyaltyPointsRedeemed: 0,
              loyaltyDiscountAmount: 0,
              total,
              paymentMethod: 'pending',
              notes: orderNotes,
              orderType,
              customerId: selectedCustomer?.id,
              customerName,
              deliveryFee,
              deliveryInfo: deliveryInfo ?? undefined,
              createdAt: now,
              updatedAt: now,
              shiftId,
            });
            // Mark table as occupied
            if (selectedTableId) {
              await db.cafeTables.update(selectedTableId, { status: 'occupied', activeOrderId: orderId });
            }
            await logActivity(session.id, session.name, session.role, 'order', 'Order Pending',
              `Order #${orderId} | ${selectedTableName} | ${currencySymbol} ${total} | Pending payment`);
            return { orderId, pending: true as const };
          }

          // Orders go to 'preparing' so kitchen sees them in KDS; payment is already recorded
          const orderId = await db.orders.add({
            tableId: selectedTableId ?? undefined,
            tableName: selectedTableName,
            userId: session.id,
            userName: session.name,
            status: 'preparing',
            items,
            subtotal,
            taxRate,
            taxAmount,
            discountId,
            discountLabel,
            discountAmount,
            loyaltyPointsEarned: pointsEarned,
            loyaltyPointsRedeemed,
            loyaltyDiscountAmount: loyaltyDiscount,
            total,
            paymentMethod: effectiveMethod,
            amountPaid: splitPayments ? total : (method === 'cash' ? paid : total),
            change: splitPayments ? 0 : (method === 'cash' ? change : 0),
            notes: orderNotes,
            orderType,
            customerId: selectedCustomer?.id,
            customerName,
            deliveryFee,
            deliveryInfo: deliveryInfo ?? undefined,
            splitPayments,
            createdAt: now,
            updatedAt: now,
            completedAt: now,
            shiftId,
          });

          const shift = await db.shifts.get(shiftId);
          if (shift) {
            const cashAmt = splitPayments
              ? splitPayments.filter(s => s.method === 'cash').reduce((a, s) => a + s.amount, 0)
              : (method === 'cash' ? total : 0);
            const cardAmt = splitPayments
              ? splitPayments.filter(s => s.method === 'card').reduce((a, s) => a + s.amount, 0)
              : (method === 'card' ? total : 0);
            await db.shifts.update(shiftId, {
              totalSales: (shift.totalSales || 0) + total,
              totalOrders: (shift.totalOrders || 0) + 1,
              totalCash: (shift.totalCash || 0) + cashAmt,
              totalCard: (shift.totalCard || 0) + cardAmt,
            });
          }
          if (deliveryInfo?.riderId && orderType === 'delivery') {
            const rider = await db.riders.get(deliveryInfo.riderId);
            if (rider) {
              await db.riders.update(deliveryInfo.riderId, { totalDeliveries: (rider.totalDeliveries || 0) + 1 });
            }
          }
          if (selectedTableId) {
            await db.cafeTables.update(selectedTableId, { status: 'free', activeOrderId: undefined });
          }
          if (discountId) {
            const disc = await db.discounts.get(discountId);
            if (disc) await db.discounts.update(discountId, { usageCount: (disc.usageCount || 0) + 1 });
          }
          if (selectedCustomer) {
            const pointsChange = pointsEarned - loyaltyPointsRedeemed;
            const newPoints = Math.max(0, (selectedCustomer.points || 0) + pointsChange);
            await db.customers.update(selectedCustomer.id!, {
              points: newPoints,
              totalOrders: (selectedCustomer.totalOrders || 0) + 1,
              totalSpent: (selectedCustomer.totalSpent || 0) + total,
              lastVisit: now,
            });
          }
          await logActivity(session.id, session.name, session.role, 'order', 'Order Paid',
            `Order #${orderId} | ${selectedTableName} | ${currencySymbol} ${total} | ${effectiveMethod}`);
          return { orderId, pending: false as const };
        }
      );

      if (result.pending) {
        clearCart();
        setSelectedCustomer(null);
        onSuccess();
      } else {
        if (selectedCustomer) setSelectedCustomer(null);
        setCompletedOrder(result.orderId);
      }
    } finally {
      setLoading(false);
    }
  };

  if (completedOrder) {
    return <ReceiptModal orderId={completedOrder} onClose={() => { clearCart(); onSuccess(); }} />;
  }

  if (showSplit) {
    return (
      <SplitPaymentModal
        total={total}
        currencySymbol={currencySymbol}
        onConfirm={splits => { setShowSplit(false); handlePay(splits); }}
        onCancel={() => setShowSplit(false)}
      />
    );
  }

  return (
    <Modal open title="Payment" onClose={onClose} size="sm">
      <div className="space-y-4">
        {/* Order Summary */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{currencySymbol} {subtotal.toLocaleString()}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Tax</span><span>{currencySymbol} {taxAmount.toLocaleString()}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({discountLabel})</span><span>- {currencySymbol} {discountAmount.toLocaleString()}</span>
            </div>
          )}
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Loyalty Discount</span><span>- {currencySymbol} {loyaltyDiscount.toLocaleString()}</span>
            </div>
          )}
          {deliveryFee > 0 && (
            <div className="flex justify-between text-blue-600">
              <span>Delivery Fee</span><span>+ {currencySymbol} {deliveryFee.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200 text-gray-900">
            <span>Total</span><span className="text-amber-600">{currencySymbol} {total.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMethod('cash')}
            className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 font-medium text-sm transition-all ${method === 'cash' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <Banknote className="w-4 h-4" /> Cash
          </button>
          <button onClick={() => setMethod('card')}
            className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 font-medium text-sm transition-all ${method === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <CreditCard className="w-4 h-4" /> Card
          </button>
          {/* Pending — for dine-in and delivery */}
          {(isDineIn || isDelivery) && (
            <button onClick={() => setMethod('pending')}
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 font-medium text-sm transition-all ${method === 'pending' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'}`}>
              <Clock className="w-4 h-4" /> Pending
            </button>
          )}
          {isDelivery && (
            <button onClick={() => setMethod('cod')}
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 font-medium text-sm transition-all ${method === 'cod' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-600'}`}>
              <Bike className="w-4 h-4" /> COD
            </button>
          )}
          {!isDelivery && (
            <button onClick={() => setShowSplit(true)}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600 font-medium text-sm transition-all">
              <SplitSquareHorizontal className="w-4 h-4" /> Split
            </button>
          )}
          {isDelivery && (
            <button onClick={() => setShowSplit(true)}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600 font-medium text-sm transition-all">
              <SplitSquareHorizontal className="w-4 h-4" /> Split
            </button>
          )}
        </div>

        {/* Cash input */}
        {method === 'cash' && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Amount Received</label>
            <input ref={inputRef} type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
              placeholder={`${currencySymbol} 0`}
              className="w-full px-4 py-3 text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {quickAmounts.map(amt => (
                <button key={amt} onClick={() => setAmountPaid(String(amt))}
                  className="py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-700 font-medium transition-all">
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
            {paid >= total && (
              <div className="mt-3 p-3 bg-green-50 rounded-xl flex items-center justify-between">
                <span className="text-sm font-medium text-green-700">Change</span>
                <span className="text-lg font-bold text-green-700">{currencySymbol} {change.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {method === 'card' && (
          <div className="p-4 bg-blue-50 rounded-xl text-center text-sm text-blue-700">
            Process card payment on terminal, then confirm below.
          </div>
        )}

        {isCODMethod && (
          <div className="p-4 bg-green-50 rounded-xl text-center text-sm text-green-700 border border-green-200">
            <Bike className="w-5 h-5 mx-auto mb-1" />
            Cash on Delivery — rider will collect <strong>{currencySymbol} {total.toLocaleString()}</strong> upon delivery.
          </div>
        )}

        {isPending && (
          <div className="p-4 bg-orange-50 rounded-xl text-center text-sm text-orange-700 border border-orange-200">
            <Clock className="w-5 h-5 mx-auto mb-1" />
            Order will be saved as <strong>Pending Payment</strong>.
            {isDineIn && ' Table will be marked occupied.'}
            {isDelivery && ' Rider will collect payment on delivery.'}
            <br />Change status to Paid when customer pays.
          </div>
        )}

        <button onClick={() => handlePay()} disabled={!canPay || loading}
          className="w-full py-3.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-base transition-all flex items-center justify-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {loading ? 'Processing...' : isPending ? 'Confirm — Pending Payment' : 'Confirm Payment'}
        </button>
      </div>
    </Modal>
  );
}
