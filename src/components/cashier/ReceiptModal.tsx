import { useEffect, useState } from 'react';
import { Printer, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import { db, getSetting } from '../../db/database';
import { formatDateTime } from '../../utils/format';
import type { Order } from '../../types';

interface Props {
  orderId: number;
  onClose: () => void;
}

export default function ReceiptModal({ orderId, onClose }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [cafeName, setCafeName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [footer, setFooter] = useState('');
  const [currency, setCurrency] = useState('Rs.');

  useEffect(() => {
    db.orders.get(orderId).then(o => setOrder(o ?? null));
    Promise.all([
      getSetting('cafeName'),
      getSetting('address'),
      getSetting('phone'),
      getSetting('receiptFooter'),
      getSetting('currency'),
    ]).then(([n, a, p, f, c]) => {
      setCafeName(n);
      setAddress(a);
      setPhone(p);
      setFooter(f);
      setCurrency(c);
    });
  }, [orderId]);

  const handlePrint = () => window.print();

  if (!order) return null;

  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;

  const orderTypeLabel =
    order.orderType === 'dine-in' ? `Dine In — ${order.tableName}` :
    order.orderType === 'takeaway' ? 'Takeaway' :
    'Delivery';

  return (
    <Modal open title="Receipt" onClose={onClose} size="sm">
      <div id="receipt-print" className="font-mono text-xs text-gray-800">
        <div className="text-center mb-3">
          <div className="text-base font-bold">{cafeName}</div>
          {address && <div className="text-gray-500">{address}</div>}
          {phone && <div className="text-gray-500">Tel: {phone}</div>}
          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="font-bold">Order #{orderId}</div>
          <div>{order.createdAt ? formatDateTime(order.createdAt) : ''}</div>
          <div className="font-medium mt-0.5">{orderTypeLabel}</div>
          <div>Cashier: {order.userName}</div>
          {order.customerName && <div>Customer: {order.customerName}</div>}
          <div className="border-t border-dashed border-gray-300 my-2" />
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dashed border-gray-300">
              <th className="text-left pb-1">Item</th>
              <th className="text-center pb-1">Qty</th>
              <th className="text-right pb-1">Price</th>
              <th className="text-right pb-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-0.5 pr-1">{item.name}{item.notes ? ` (${item.notes})` : ''}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">{fmt(item.price)}</td>
                <td className="text-right">{fmt(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-300 mt-2 pt-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
          </div>
          {order.taxAmount > 0 && (
            <div className="flex justify-between">
              <span>Tax ({order.taxRate}%)</span><span>{fmt(order.taxAmount)}</span>
            </div>
          )}
          {order.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Discount ({order.discountLabel})</span><span>-{fmt(order.discountAmount)}</span>
            </div>
          )}
          {order.loyaltyDiscountAmount > 0 && (
            <div className="flex justify-between">
              <span>Loyalty</span><span>-{fmt(order.loyaltyDiscountAmount)}</span>
            </div>
          )}
          {order.deliveryFee > 0 && (
            <div className="flex justify-between">
              <span>Delivery Fee</span><span>+{fmt(order.deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-dashed border-gray-300 pt-1 mt-1">
            <span>TOTAL</span><span>{fmt(order.total)}</span>
          </div>
          {order.paymentMethod && order.paymentMethod !== 'pending' && (
            <div className="flex justify-between mt-1">
              <span>Payment</span>
              <span className="capitalize">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}</span>
            </div>
          )}
          {order.paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between">
                <span>Amount Paid</span><span>{fmt(order.amountPaid || 0)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Change</span><span>{fmt(order.change || 0)}</span>
              </div>
            </>
          )}
        </div>

        {footer && (
          <div className="text-center mt-3 text-gray-500 border-t border-dashed border-gray-300 pt-2">
            {footer}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-4 print:hidden">
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
        <button
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold"
        >
          <Check className="w-4 h-4" /> Done
        </button>
      </div>
    </Modal>
  );
}
