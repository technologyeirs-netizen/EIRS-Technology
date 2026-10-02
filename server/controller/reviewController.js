const mongoose = require('mongoose');
const Review = require('../model/reviewSchema');
const Product = require('../model/productSchema.js');
const Order = require('../model/orderSchema.js');

// Orders in these states count as a real purchase
const PURCHASE_STATUSES = ['Confirmed', 'Shipped', 'Delivered'];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateComment = (comment) => {
    const str = comment ? String(comment).trim() : '';
    if (str.length > 0 && str.length < 10) return { error: 'Comment must be at least 10 characters if provided' };
    if (str.length > 500) return { error: 'Comment cannot exceed 500 characters' };
    return { value: str };
};

const findPurchase = (userId, productId) =>
    Order.findOne({
        userId,
        status: { $in: PURCHASE_STATUSES },
        'items.productId': productId,
    })
        .sort({ orderDate: -1 })
        .select('_id status');

const buildSummary = (reviews) => {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });
    const total = reviews.length;
    const average = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    return { averageRating: Math.round(average * 10) / 10, totalReviews: total, distribution };
};

/* ───────────────── CUSTOMER ───────────────── */

// Can the logged-in user review this product? (only buyers can)
exports.canReviewProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        if (!isValidId(productId)) return res.status(400).json({ success: false, canReview: false, message: 'Invalid product ID' });

        const userId = req.user._id;
        const existing = await Review.findOne({ productId, userId });
        const purchase = await findPurchase(userId, productId);

        res.json({
            success: true,
            canReview: Boolean(purchase) || Boolean(existing),
            hasPurchased: Boolean(purchase),
            hasReviewed: Boolean(existing),
            message: purchase || existing ? '' : 'Only customers who have purchased this product can write a review.',
        });
    } catch (error) {
        res.status(500).json({ success: false, canReview: false, message: error.message });
    }
};

exports.addReview = async (req, res) => {
    try {
        const { productId, rating, comment } = req.body;

        if (!productId || !isValidId(productId)) return res.status(400).json({ message: 'Valid product ID is required' });

        const ratingNum = parseInt(rating, 10);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
        }

        const c = validateComment(comment);
        if (c.error) return res.status(400).json({ message: c.error });

        const { _id: userId, name: userName, email: userEmail } = req.user;
        if (!userId || !userName || !userEmail) {
            return res.status(401).json({ message: 'Please sign in again to write a review' });
        }

        const product = await Product.findById(productId).select('_id');
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const existing = await Review.findOne({ productId, userId });
        if (existing) {
            if (existing.isHidden) {
                return res.status(403).json({ message: 'Your review is under moderation and cannot be edited right now' });
            }
            existing.rating = ratingNum;
            existing.comment = c.value;
            existing.updatedAt = new Date();
            await existing.save();
            return res.status(200).json({ message: 'Review updated successfully', review: existing });
        }

        const purchase = await findPurchase(userId, productId);
        if (!purchase) {
            return res.status(403).json({
                message: 'Only customers who have purchased this product can write a review.',
            });
        }

        const review = await Review.create({
            productId,
            userId,
            userName,
            userEmail,
            rating: ratingNum,
            comment: c.value,
            verifiedPurchase: true,
            orderId: purchase._id,
        });

        res.status(201).json({ message: 'Review added successfully', review });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'You have already reviewed this product' });
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: Object.values(error.errors).map((e) => e.message).join(', ') });
        }
        console.error('Error adding review:', error);
        res.status(500).json({ message: 'Error adding review: ' + error.message });
    }
};

// Public: visible reviews of a product + summary
exports.getProductReviews = async (req, res) => {
    const empty = { reviews: [], averageRating: 0, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    try {
        const { productId } = req.params;
        if (!isValidId(productId)) return res.status(200).json({ success: false, message: 'Invalid product ID', ...empty });

        const reviews = await Review.find({ productId, isHidden: { $ne: true } })
            .sort({ createdAt: -1 })
            .select('-userEmail -orderId')
            .lean();

        res.status(200).json({ success: true, reviews, ...buildSummary(reviews) });
    } catch (error) {
        console.error('Error fetching reviews:', error.message);
        res.status(500).json({ success: false, message: 'Error fetching reviews', ...empty });
    }
};

exports.getUserProductReview = async (req, res) => {
    try {
        const review = await Review.findOne({ productId: req.params.productId, userId: req.user._id });
        res.status(200).json({ success: true, review: review || null });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user review', error: error.message });
    }
};

exports.updateReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ message: 'Review not found' });
        if (review.userId.toString() !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to update this review' });
        }
        if (review.isHidden) return res.status(403).json({ message: 'This review is under moderation' });

        const ratingNum = parseInt(req.body.rating, 10);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }
        const c = validateComment(req.body.comment);
        if (c.error) return res.status(400).json({ message: c.error });

        review.rating = ratingNum;
        review.comment = c.value;
        review.updatedAt = new Date();
        await review.save();
        res.status(200).json({ message: 'Review updated successfully', review });
    } catch (error) {
        res.status(500).json({ message: 'Error updating review', error: error.message });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        const isOwner = review.userId.toString() === String(req.user._id);
        if (!isOwner && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to delete this review' });
        }
        await review.deleteOne();
        res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting review', error: error.message });
    }
};

/* ───────────────── ADMIN ───────────────── */

exports.adminGetAllReviews = async (req, res) => {
    try {
        const { rating, status, verified, search } = req.query;
        const filter = {};
        if (rating) filter.rating = Number(rating);
        if (status === 'hidden') filter.isHidden = true;
        if (status === 'visible') filter.isHidden = { $ne: true };
        if (verified === 'true') filter.adminVerified = true;
        if (verified === 'false') filter.adminVerified = { $ne: true };
        if (search) {
            const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ userName: rx }, { userEmail: rx }, { comment: rx }];
        }

        const reviews = await Review.find(filter)
            .populate('productId', 'productName image brand')
            .sort({ createdAt: -1 })
            .limit(1000)
            .lean();

        const [total, hidden, verifiedCount] = await Promise.all([
            Review.countDocuments(),
            Review.countDocuments({ isHidden: true }),
            Review.countDocuments({ adminVerified: true }),
        ]);
        const avgRow = await Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]);

        res.json({
            success: true,
            data: reviews,
            stats: {
                total,
                hidden,
                verified: verifiedCount,
                averageRating: avgRow[0] ? Math.round(avgRow[0].avg * 10) / 10 : 0,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminUpdateReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

        const { rating, comment, adminReply } = req.body;

        if (rating !== undefined) {
            const r = parseInt(rating, 10);
            if (isNaN(r) || r < 1 || r > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
            review.rating = r;
        }
        if (comment !== undefined) {
            const c = validateComment(comment);
            if (c.error) return res.status(400).json({ success: false, message: c.error });
            review.comment = c.value;
        }
        if (adminReply !== undefined) {
            review.adminReply = String(adminReply).trim();
            review.adminReplyAt = review.adminReply ? new Date() : null;
        }
        review.updatedAt = new Date();
        await review.save();
        res.json({ success: true, message: 'Review updated', data: review });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: Object.values(error.errors).map((e) => e.message).join(', ') });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminVerifyReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
        review.adminVerified = !review.adminVerified;
        await review.save();
        res.json({ success: true, data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminToggleHideReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
        review.isHidden = !review.isHidden;
        await review.save();
        res.json({ success: true, data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminDeleteReview = async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.reviewId);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
        res.json({ success: true, message: 'Review deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
