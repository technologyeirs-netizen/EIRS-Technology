import { useState, useEffect, useCallback, useRef } from "react";
import { couponService } from "../services/api";

const KEY = "appliedCoupon";

const r2 = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const readStored = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};

/**
 * Keeps the applied coupon shared between Cart and Checkout
 * via sessionStorage.
 *
 * Coupon is re-validated whenever subtotal changes.
 *
 * GST / tax is intentionally NOT calculated here.
 *
 * Final total:
 * subtotal - coupon discount
 */
export default function useAppliedCoupon(subtotal) {
  const [applied, setApplied] = useState(readStored);
  const [notice, setNotice] = useState("");
  const seq = useRef(0);

  const persist = (value) => {
    try {
      if (value) {
        sessionStorage.setItem(KEY, JSON.stringify(value));
      } else {
        sessionStorage.removeItem(KEY);
      }
    } catch (_) {
      // Ignore storage errors
    }
  };

  const apply = useCallback((value) => {
    setNotice("");
    persist(value);
    setApplied(value);
  }, []);

  const remove = useCallback(() => {
    persist(null);
    setApplied(null);
    setNotice("");
  }, []);

  const code = applied?.code;

  useEffect(() => {
    if (!code) return;

    if (!(subtotal > 0)) {
      remove();
      return;
    }

    const id = ++seq.current;

    couponService
      .validate(code, subtotal)
      .then((res) => {
        if (id !== seq.current) return;

        const next = {
          code: res?.data?.code,
          discountAmount: Number(res?.data?.discountAmount || 0),
        };

        persist(next);
        setApplied(next);
      })
      .catch((e) => {
        if (id !== seq.current) return;

        setNotice(
          `Coupon ${code} removed: ${
            e?.message || "no longer valid"
          }`
        );

        remove();
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, Math.round(Number(subtotal || 0) * 100)]);

  /*
   * Product subtotal
   */
  const subtotalValue = r2(Math.max(0, Number(subtotal) || 0));

  /*
   * Coupon discount only.
   * GST is completely removed.
   */
  const discount = applied
    ? r2(
        Math.min(
          Math.max(0, Number(applied.discountAmount) || 0),
          subtotalValue
        )
      )
    : 0;

  /*
   * Amount after coupon.
   * NO GST.
   * NO additional tax.
   */
  const taxable = r2(Math.max(0, subtotalValue - discount));

  /*
   * Final payable amount.
   *
   * Keep `total` for compatibility with existing Checkout code.
   * There is intentionally NO GST added here.
   */
  const total = taxable;

  /*
   * Kept as 0 for compatibility with existing UI/code
   * that may still read couponState.gst.
   */
  const gst = 0;

  return {
    applied,
    apply,
    remove,
    notice,
    discount,
    taxable,
    gst,
    total,
  };
}