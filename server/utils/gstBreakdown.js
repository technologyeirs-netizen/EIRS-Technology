/**
 * GST breakdown for INVOICES / ORDER VIEW only.
 *
 * Customer pays the same price as before (cart + checkout show NO GST).
 * For the bill we treat the amount actually paid as GST-INCLUSIVE and split it:
 *
 *    taxable = paid / (1 + rate)
 *    gst     = paid - taxable          (CGST = SGST = gst / 2)
 *
 * so  taxable + CGST + SGST === paid   (always, to the paisa).
 * Coupon discount is shared across items in proportion to their value.
 */

// Total GST rate in percent (18 => 9% CGST + 9% SGST). Override with env INVOICE_GST_PERCENT.
const GST_PERCENT = Number(process.env.INVOICE_GST_PERCENT) > 0
  ? Number(process.env.INVOICE_GST_PERCENT)
  : 18;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const splitInclusive = (paid, percent = GST_PERCENT) => {
  const amount = round2(paid);
  const taxable = round2(amount / (1 + percent / 100));
  const gst = round2(amount - taxable);
  const cgst = round2(gst / 2);
  const sgst = round2(gst - cgst); // keeps cgst + sgst === gst exactly
  return { taxable, cgst, sgst, gst, paid: amount };
};

const computeOrderGst = (order, percent = GST_PERCENT) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const paidTotal = round2(order?.totalPrice ?? order?.totalAmount ?? 0);

  const lines = items.map((item) => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const discount = Number(item.discount || 0);
    const gross = price * (1 - discount / 100) * qty;
    return { item, qty, price, discount, gross };
  });

  const grossSum = lines.reduce((s, l) => s + l.gross, 0);

  // Share of the final paid amount that belongs to each line (coupon / legacy GST spread proportionally)
  let allocated = 0;
  const result = lines.map((l, idx) => {
    let paid;
    if (idx === lines.length - 1) {
      paid = round2(paidTotal - allocated); // last line absorbs rounding
    } else {
      paid = grossSum > 0 ? round2((l.gross / grossSum) * paidTotal) : 0;
      allocated = round2(allocated + paid);
    }
    return { ...l, ...splitInclusive(paid, percent) };
  });

  // Order-level totals: derive from the paid total so CGST === SGST and everything adds up to `paid`
  const whole = splitInclusive(paidTotal, percent);
  const totals = { taxable: whole.taxable, cgst: whole.cgst, sgst: whole.sgst };

  return {
    percent,
    halfPercent: percent / 2,
    lines: result,
    taxable: totals.taxable,
    cgst: totals.cgst,
    sgst: totals.sgst,
    gst: whole.gst,
    paid: paidTotal,
  };
};

module.exports = { GST_PERCENT, splitInclusive, computeOrderGst };
