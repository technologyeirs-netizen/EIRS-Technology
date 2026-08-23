const express = require('express');
const router = express.Router();

const {
    getActiveBanners,
    getAllBannersAdmin,
    createBanner,
    updateBanner,
    deleteBanner,
    reorderBanners,
} = require('../controller/bannerController');

const jwtAuth = require('../middleware/jwtAuth');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { bannerUpload } = require('../config/cloudinary');

// ── Public: consumed by the mobile app only ─────────────────────────────
router.get('/', getActiveBanners);

// ── Admin (used by CRM's B2C section / a future web admin panel) ───────
router.get('/admin/all', jwtAuth, adminMiddleware, getAllBannersAdmin);

router.post(
    '/upload-image',
    jwtAuth,
    adminMiddleware,
    (req, res, next) => {
        bannerUpload.single('image')(req, res, (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            next();
        });
    },
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }
        res.json({
            success: true,
            url: req.file.path,
            public_id: req.file.filename,
        });
    }
);

router.post('/', jwtAuth, adminMiddleware, createBanner);
router.put('/reorder', jwtAuth, adminMiddleware, reorderBanners);
router.put('/:id', jwtAuth, adminMiddleware, updateBanner);
router.delete('/:id', jwtAuth, adminMiddleware, deleteBanner);

module.exports = router;
