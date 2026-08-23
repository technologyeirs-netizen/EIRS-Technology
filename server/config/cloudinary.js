const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage that pipes directly to Cloudinary
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'eirs-products',       // All product images go into this folder
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [
            { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }
        ],
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
});

// Separate storage/upload for app banners & carousel images (own Cloudinary folder)
const bannerStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'eirs-app-banners',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 1600, height: 900, crop: 'limit', quality: 'auto:good' }
        ],
    },
});

const bannerUpload = multer({
    storage: bannerStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
});

module.exports = { cloudinary, upload, bannerUpload };
