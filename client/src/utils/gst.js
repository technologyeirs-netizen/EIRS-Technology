/**
 * GST breakdown for ORDER VIEW only (cart & checkout never show GST).
 * The amount the customer paid stays unchanged; it is treated as GST-inclusive:
 *   taxable = paid / (1 + rate),  GST = paid - taxable,  CGST = SGST = GST / 2
 * Keep in sync with server/utils/gstBreakdown.js (invoice PDF).
 */
export const GST_PERCENT = 18;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const getOrderGst = (order, percent = GST_PERCENT) => {
  const paid = round2(order?.totalPrice ?? order?.totalAmount ?? 0);
  const taxable = round2(paid / (1 + percent / 100));
  const gst = round2(paid - taxable);
  const cgst = round2(gst / 2);
  const sgst = round2(gst - cgst);
  return { percent, half: percent / 2, paid, taxable, gst, cgst, sgst };
};
