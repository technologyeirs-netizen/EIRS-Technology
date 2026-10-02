const assert = require('assert');
const Coupon = require('../model/couponSchema');
const CouponUsage = require('../model/couponUsageSchema');
const svc = require('../services/couponService');

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; } };

const day = 86400000;
const base = (o = {}) => ({
  code: 'SAVE10', discountType: 'percentage', discountValue: 10, minOrderAmount: 0, maxDiscount: 0,
  maxUsesPerUser: 1, totalUsageLimit: 0, usedCount: 0, isActive: true,
  startDate: new Date(Date.now() - day), endDate: new Date(Date.now() + day), _id: 'c1', ...o,
});

(async () => {
  console.log('computeDiscount / computeTotals');
  await t('percentage', () => assert.strictEqual(svc.computeDiscount(base(), 1000), 100));
  await t('percentage capped by maxDiscount', () => assert.strictEqual(svc.computeDiscount(base({ discountValue: 50, maxDiscount: 200 }), 1000), 200));
  await t('percentage under cap not raised', () => assert.strictEqual(svc.computeDiscount(base({ discountValue: 10, maxDiscount: 500 }), 1000), 100));
  await t('flat', () => assert.strictEqual(svc.computeDiscount(base({ discountType: 'flat', discountValue: 250 }), 1000), 250));
  await t('flat never exceeds subtotal', () => assert.strictEqual(svc.computeDiscount(base({ discountType: 'flat', discountValue: 5000 }), 1000), 1000));
  await t('rounding to 2dp', () => assert.strictEqual(svc.computeDiscount(base({ discountValue: 12.5 }), 333.33), 41.67));
  await t('totals: GST charged on discounted amount', () => {
    const r = svc.computeTotals(1000, 100);
    assert.deepStrictEqual(r, { subtotal: 1000, discount: 100, taxable: 900, gst: 162, total: 1062 });
  });
  await t('totals without coupon', () => assert.strictEqual(svc.computeTotals(1000, 0).total, 1180));

  console.log('getStaticIneligibility');
  await t('ok', () => assert.strictEqual(svc.getStaticIneligibility(base(), 500), null));
  await t('inactive', () => assert.match(svc.getStaticIneligibility(base({ isActive: false }), 500), /not active/));
  await t('not started', () => assert.match(svc.getStaticIneligibility(base({ startDate: new Date(Date.now() + day) }), 500), /not valid yet/));
  await t('expired', () => assert.match(svc.getStaticIneligibility(base({ endDate: new Date(Date.now() - 1000) }), 500), /expired/));
  await t('total limit reached', () => assert.match(svc.getStaticIneligibility(base({ totalUsageLimit: 5, usedCount: 5 }), 500), /usage limit/));
  await t('total limit 0 = unlimited', () => assert.strictEqual(svc.getStaticIneligibility(base({ totalUsageLimit: 0, usedCount: 999 }), 500), null));
  await t('min order not met', () => assert.match(svc.getStaticIneligibility(base({ minOrderAmount: 1000 }), 400), /600/));
  await t('min order exactly met', () => assert.strictEqual(svc.getStaticIneligibility(base({ minOrderAmount: 1000 }), 1000), null));

  console.log('validateCouponForUser (DB stubbed)');
  const stub = (coupon, used) => { Coupon.findOne = async () => coupon; CouponUsage.countDocuments = async () => used; };
  await t('unknown code', async () => { stub(null, 0); assert.strictEqual((await svc.validateCouponForUser('nope', 'u1', 500)).valid, false); });
  await t('code is case-insensitive / trimmed', async () => {
    let q; Coupon.findOne = async (x) => { q = x; return base(); }; CouponUsage.countDocuments = async () => 0;
    await svc.validateCouponForUser('  save10 ', 'u1', 500); assert.strictEqual(q.code, 'SAVE10');
  });
  await t('valid returns discount + totals', async () => {
    stub(base(), 0); const r = await svc.validateCouponForUser('SAVE10', 'u1', 2000);
    assert.ok(r.valid); assert.strictEqual(r.discount, 200); assert.strictEqual(r.totals.total, 2124);
  });
  await t('per-user limit blocks', async () => { stub(base({ maxUsesPerUser: 1 }), 1); const r = await svc.validateCouponForUser('SAVE10', 'u1', 500); assert.ok(!r.valid); assert.match(r.message, /already used/); });
  await t('per-user limit 3 allows 2nd use', async () => { stub(base({ maxUsesPerUser: 3 }), 2); assert.ok((await svc.validateCouponForUser('SAVE10', 'u1', 500)).valid); });
  await t('per-user limit 3 blocks 4th', async () => { stub(base({ maxUsesPerUser: 3 }), 3); assert.ok(!(await svc.validateCouponForUser('SAVE10', 'u1', 500)).valid); });

  console.log('Coupon schema validation');
  const mk = (o) => new Coupon({ code: 'abc10', discountType: 'percentage', discountValue: 10, startDate: new Date(), endDate: new Date(Date.now() + day), ...o });
  await t('code uppercased', async () => { const c = mk({}); await c.validate(); assert.strictEqual(c.code, 'ABC10'); });
  await t('percentage > 100 rejected', async () => { await assert.rejects(mk({ discountValue: 150 }).validate(), /cannot exceed 100/); });
  await t('flat > 100 allowed', async () => { await mk({ discountType: 'flat', discountValue: 500 }).validate(); });
  await t('end before start rejected', async () => { await assert.rejects(mk({ endDate: new Date(Date.now() - day) }).validate(), /End date/); });
  await t('bad code chars rejected', async () => { await assert.rejects(mk({ code: 'a b!' }).validate(), /Code must be/); });
  await t('missing type rejected', async () => { await assert.rejects(mk({ discountType: undefined }).validate(), /Discount type/); });

  console.log(`\n${passed} passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
})();
