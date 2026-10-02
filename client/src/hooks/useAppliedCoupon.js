import { useState, useEffect, useCallback, useRef } from 'react';
import { couponService } from '../services/api';

const KEY = 'appliedCoupon';
const GST = 0.18;
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const readStored = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
};

/**
 * Keeps the applied coupon (shared between Cart and Checkout via sessionStorage)
 * and re-validates it on the server whenever the cart subtotal changes,
 * so the discount always matches the current cart.
 */
export default function useAppliedCoupon(subtotal) {
  const [applied, setApplied] = useState(readStored);
  const [notice, setNotice] = useState('');
  const seq = useRef(0);

  const persist = (value) => {
    try {
      if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
      else sessionStorage.removeItem(KEY);
    } catch (_) { /* ignore */ }
  };

  const apply = useCallback((value) => { setNotice(''); persist(value); setApplied(value); }, []);
  const remove = useCallback(() => { persist(null); setApplied(null); }, []);

  const code = applied?.code;
  useEffect(() => {
    if (!code) return;
    if (!(subtotal > 0)) { remove(); return; }
    const id = ++seq.current;
    couponService
      .validate(code, subtotal)
      .then((res) => {
        if (id !== seq.current) return;
        const next = { code: res.data.code, discountAmount: res.data.discountAmount };
        persist(next);
        setApplied(next);
      })
      .catch((e) => {
        if (id !== seq.current) return;
        setNotice(`Coupon ${code} removed: ${e.message || 'no longer valid'}`);
        remove();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, Math.round(subtotal * 100)]);

  const discount = applied ? Math.min(applied.discountAmount || 0, subtotal) : 0;
  const taxable = r2(Math.max(0, subtotal - discount));
  const gst = r2(taxable * GST);
  const total = r2(taxable + gst);

  return { applied, apply, remove, notice, discount, taxable, gst, total };
}
