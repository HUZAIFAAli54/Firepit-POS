import { UtensilsCrossed, ShoppingBag, Bike } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { OrderType } from '../../types';

const types: { value: OrderType; label: string; icon: React.FC<any>; color: string }[] = [
  { value: 'dine-in',  label: 'Dine In',  icon: UtensilsCrossed, color: 'bg-amber-500' },
  { value: 'takeaway', label: 'Takeaway', icon: ShoppingBag,      color: 'bg-blue-500' },
  { value: 'delivery', label: 'Delivery', icon: Bike,             color: 'bg-green-500' },
];

export default function OrderTypeBar() {
  const orderType = useAppStore(s => s.orderType);
  const setOrderType = useAppStore(s => s.setOrderType);
  const setTable = useAppStore(s => s.setTable);
  const setDeliveryInfo = useAppStore(s => s.setDeliveryInfo);

  const handleSelect = (t: OrderType) => {
    setOrderType(t);
    if (t === 'takeaway') setTable(null, 'Takeaway');
    if (t === 'delivery') setTable(null, 'Delivery');
    if (t === 'dine-in') setTable(null, 'Takeaway');
    if (t !== 'delivery') setDeliveryInfo(null);
  };

  return (
    <div className="grid grid-cols-3 gap-1.5 p-3 bg-white border-b border-gray-100">
      {types.map(({ value, label, icon: Icon, color }) => {
        const active = orderType === value;
        return (
          <button
            key={value}
            onClick={() => handleSelect(value)}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all ${
              active
                ? `${color} text-white shadow-sm`
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
