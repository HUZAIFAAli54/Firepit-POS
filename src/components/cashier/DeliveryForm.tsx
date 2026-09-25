import { useEffect, useState } from 'react';
import { Bike, MapPin, Phone, User, Clock, Banknote, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { db, getSetting } from '../../db/database';
import type { DeliveryInfo, Rider } from '../../types';

const EMPTY: DeliveryInfo = {
  customerName: '', phone: '', address: '', area: '',
  deliveryFee: 0, estimatedMinutes: 0, riderId: undefined, riderName: '', notes: '',
};

export default function DeliveryForm() {
  const deliveryInfo = useAppStore(s => s.deliveryInfo);
  const setDeliveryInfo = useAppStore(s => s.setDeliveryInfo);
  const currencySymbol = useAppStore(s => s.currencySymbol);
  const [riders, setRiders] = useState<Rider[]>([]);

  const info: DeliveryInfo = deliveryInfo ?? EMPTY;

  useEffect(() => {
    if (!deliveryInfo) {
      getSetting('defaultDeliveryFee', '100').then(fee => {
        setDeliveryInfo({ ...EMPTY, deliveryFee: parseFloat(fee) || 0 });
      });
    }
    db.riders.filter(r => r.active === true).toArray().then(setRiders);
  }, [deliveryInfo, setDeliveryInfo]);

  const set = (key: keyof DeliveryInfo, value: string | number | undefined) =>
    setDeliveryInfo({ ...info, [key]: value });

  const handleRiderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      set('riderId', undefined);
      set('riderName', '');
    } else {
      const rider = riders.find(r => r.id === Number(val));
      if (rider) {
        setDeliveryInfo({ ...info, riderId: rider.id, riderName: rider.name });
      }
    }
  };

  return (
    <div className="border border-green-200 rounded-xl p-2 bg-green-50 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
        <Bike className="w-3.5 h-3.5" /> Delivery Details
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={info.customerName} onChange={e => set('customerName', e.target.value)}
            placeholder="Customer name *"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-300 bg-white" />
        </div>
        <div className="relative">
          <Phone className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={info.phone} onChange={e => set('phone', e.target.value)}
            placeholder="Phone *" type="tel"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-300 bg-white" />
        </div>
        <div className="col-span-2 relative">
          <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={info.address} onChange={e => set('address', e.target.value)}
            placeholder="Delivery address *"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-300 bg-white" />
        </div>
        <input value={info.area} onChange={e => set('area', e.target.value)}
          placeholder="Area / Zone"
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-300 bg-white" />
        <div className="relative">
          <Banknote className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={info.deliveryFee || ''} onChange={e => set('deliveryFee', parseFloat(e.target.value) || 0)}
            placeholder={`Fee (${currencySymbol})`} type="number"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-300 bg-white" />
        </div>
        <div className="relative">
          <Clock className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={info.estimatedMinutes || ''} onChange={e => set('estimatedMinutes', parseInt(e.target.value) || 0)}
            placeholder="ETA (mins)" type="number"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-300 bg-white" />
        </div>

        {/* Rider selection */}
        <div className="col-span-2 relative">
          <Bike className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <select
            value={info.riderId ?? ''}
            onChange={handleRiderChange}
            className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-300 bg-white appearance-none"
          >
            <option value="">Assign Rider (optional)</option>
            {riders.map(r => (
              <option key={r.id} value={r.id}>{r.name} — {r.vehicleType || 'Rider'}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
