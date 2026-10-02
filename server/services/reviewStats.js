const Review = require('../model/reviewSchema');

/**
 * Returns { [productId]: { rating, reviewCount } } for visible (non-hidden) reviews.
 * One aggregation for the whole product list - avoids an API call per product card.
 */
const getRatingsMap = async () => {
  const rows = await Review.aggregate([
    { $match: { isHidden: { $ne: true } } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const map = {};
  rows.forEach((r) => {
    map[String(r._id)] = { rating: Math.round(r.avg * 10) / 10, reviewCount: r.count };
  });
  return map;
};

module.exports = { getRatingsMap };
