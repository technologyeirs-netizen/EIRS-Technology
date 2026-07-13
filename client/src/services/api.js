import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

// Determine API base URL
// For production: use deployed backend URL
// For development: use localhost backend
const API_BASE_URL = getApiBaseUrl();



const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for production
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    
    }
    return config;
  },
  (error) => {

    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
   
    return response;
  },
  async (error) => {
    const config = error.config;
    
   
    
    // Retry logic for network errors (max 2 retries)
    if (!config || !config.retry) {
      config.retry = 0;
    }
    
    // Retry on network errors or 5xx errors (but not 401)
    if (
      config.retry < 2 &&
      (error.code === 'ECONNABORTED' || 
       error.code === 'ERR_NETWORK' ||
       (error.response && error.response.status >= 500))
    ) {
      config.retry += 1;
     
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * config.retry));
      
      return api(config);
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/signin';
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authService = {
  signup: async (formData) => {
    try {
      
      const response = await api.post('/auth/signup', formData);

      return response.data;
    } catch (error) {
     
      const errorMessage = error.response?.data?.message || error.message || 'Signup failed';
      const err = new Error(errorMessage);
      err.status = error.response?.status;
      throw err;
    }
  },

  signin: async (credentials) => {
    try {
      
      const response = await api.post('/auth/signin', credentials);

      if (response.data.token) {
        // Store token in localStorage
        localStorage.setItem('token', response.data.token);
        // Store in axios default headers
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      return response.data;
    } catch (error) {
      
      const errorMessage = error.response?.data?.message || error.message || 'Sign in failed';
      const err = new Error(errorMessage);
      err.status = error.response?.status;
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getUser: async () => {
    try {
      const response = await api.get('/auth/user');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  editUserProfile: async (id) => {
    try {
      const response = await api.get(`/auth/users/edit/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateUserProfile: async (id, formData) => {
    try {
      const response = await api.put(`/auth/users/edit/${id}`, formData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  requestPasswordChangeOTP: async (email, purpose) => {
    try {
      const response = await api.post('/auth/request-otp', { email, purpose });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  verifyOTP: async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  resetPasswordWithOTP: async (email, otp, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/auth/reset-password-otp', { 
        email, 
        otp, 
        newPassword, 
        confirmPassword 
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  changePasswordWithOTP: async (email, otp, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/auth/change-password-otp', { 
        email, 
        otp, 
        newPassword, 
        confirmPassword 
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // ── Phone OTP Popup ────────────────────────────────────────────
  sendPhoneOTP: async (phone) => {
    try {
      const response = await api.post('/auth/otp/send', { phone });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Failed to send OTP');
    }
  },

  verifyPhoneOTP: async (phone, otp) => {
    try {
      const response = await api.post('/auth/otp/verify', { phone, otp });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Failed to verify OTP');
    }
  },

  completePhoneRegistration: async (tempToken, name, email, address) => {
    try {
      const response = await api.post('/auth/otp/register', { tempToken, name, email, address });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Registration failed');
    }
  },

  // ── Twilio Phone OTP Login / Registration (now using Fast2SMS) ──────────────
  sendFast2SMSOTP: async (phone) => {
    try {
      const response = await api.post('/auth/phone-otp/send', { phone });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Failed to send OTP');
    }
  },

  verifyFast2SMSOTP: async (phone, code) => {
    try {
      const response = await api.post('/auth/phone-otp/verify', { phone, code });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'OTP verification failed');
    }
  },

  registerWithFast2SMSOTP: async ({ phoneToken, name, email, address }) => {
    try {
      const response = await api.post('/auth/phone-otp/register', { phoneToken, name, email, address });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Registration failed');
    }
  },
};

// Products Services
export const productService = {
  getAllProducts: async (page = 1, limit = 1000, skipCache = false) => {
    const cacheKey = `products_cache_${page}_${limit}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheKey + '_time');
    const isDirty = localStorage.getItem('products_dirty') === 'true';
    const shouldBypassCache = skipCache || isDirty || limit >= 1000;

    try {
      // Use cache only for small non-public requests and only when not marked dirty.
      if (!shouldBypassCache && cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 5 * 60 * 1000) {
        const parsed = JSON.parse(cached);
        const firstProduct = Array.isArray(parsed) ? parsed[0] : (parsed?.data?.[0]);
        if (firstProduct && !('discount' in firstProduct)) {
          
        } else {
          return parsed;
        }
      }

      // Append a cache-buster so the browser and API do not serve stale catalog data.
      const bustParam = shouldBypassCache ? `&_t=${Date.now()}` : '';
      const response = await api.get(`/auth/products?page=${page}&limit=${limit}${bustParam}`, {
        // Products endpoint may take longer on slow servers, especially first load
        timeout: 45000, // 45 seconds (increased from 15 to handle slow servers/first load)
      });
      
      // Cache the response; only clear the dirty flag on normal (non-forced) fetches.
      // Admin's skipCache=true fetches must NOT clear dirty — the user-facing page
      // must still see isDirty=true so it bypasses any stale cache on its next load.
      try {
        localStorage.setItem(cacheKey, JSON.stringify(response.data));
        localStorage.setItem(cacheKey + '_time', Date.now().toString());
        if (!skipCache) {
          localStorage.removeItem('products_dirty'); // only a normal fetch marks data as fresh
        }
      } catch (storageError) {
        // Handle quota exceeded
        
        localStorage.removeItem(`products_cache_${page}_${limit}`);
        localStorage.removeItem(`products_cache_${page}_${limit}_time`);
      }
      
      return response.data;
    } catch (error) {
      
      
      // Return cached data even if expired when network fails
      if (cached) {
       
        return JSON.parse(cached);
      }
      
      throw error.response?.data || error.message;
    }
  },

  // New method to clear product cache for fresh data
  clearProductCache: () => {
    try {
      // Clear all product cache keys regardless of page/limit
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('products_cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      // Mark dirty so every page bypasses client cache on the very next fetch
      localStorage.setItem('products_dirty', 'true');
     
    } catch (error) {
     
    }
  },

  // Fetch products with fresh data (bypasses cache)
  getProductsFresh: async (page = 1, limit = 1000) => {
    return productService.getAllProducts(page, limit, true);
  },

  getProductById: async (id) => {
    try {
      const response = await api.get(`/auth/products/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  createProduct: async (formData) => {
    try {
      const response = await api.post('/auth/products/add', formData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateProduct: async (id, formData) => {
    try {
      const response = await api.put(`/auth/products/${id}`, formData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  deleteProduct: async (id) => {
    try {
      const response = await api.delete(`/auth/products/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getFeaturedProducts: async () => {
    try {
      const response = await api.get('/auth/products/featured');
      return Array.isArray(response.data) ? response.data : response.data.data || [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  toggleFeatured: async (id) => {
    try {
      const response = await api.put(`/auth/products/${id}/featured`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getSubcategoriesByCategory: async (category) => {
    try {
      const response = await api.get(`/auth/subcategories/category/${category}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getProductsByCategory: async (category) => {
    try {
      const response = await productService.getAllProducts(1, 1000, true);
      const payload = response?.data ?? response;
      const allProducts = Array.isArray(payload)
        ? payload
        : (payload?.data || payload?.products || []);

      return allProducts.filter((product) => {
        const productCategory = typeof product.category === 'object'
          ? product.category?.name
          : product.category;
        return productCategory === category || product.mainCategory === category;
      });
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Services (Company Services like Installation, AMC, etc.)
export const serviceService = {
  getAllServices: async () => {
    try {
      const response = await api.get('/auth/services');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getServiceById: async (id) => {
    try {
      const response = await api.get(`/auth/services/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getAdminServices: async () => {
    try {
      const response = await api.get('/auth/services/admin');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  addService: async (formData) => {
    try {
      const response = await api.post('/auth/services/add', formData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateService: async (id, formData) => {
    try {
      const response = await api.put(`/auth/services/update/${id}`, formData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  deleteService: async (id) => {
    try {
      const response = await api.delete(`/auth/services/delete/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  createBooking: async (bookingData) => {
    try {
      const response = await api.post('/auth/service-bookings', bookingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  deleteBooking: async (id) => {
    try {
      const response = await api.delete(`/auth/service-bookings/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getMyBookings: async () => {
    try {
      const response = await api.get('/auth/service-bookings/my');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getAllBookings: async () => {
    try {
      const response = await api.get('/auth/service-bookings/admin/all');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateBookingStatus: async (id, status) => {
    try {
      const response = await api.put(`/auth/service-bookings/${id}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Contact Services
export const contactService = {
  submitContact: async (formData) => {
    try {
      const response = await api.post('/auth/contact', formData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Location Service – save detected coordinates + address to MongoDB
export const locationService = {
  /**
   * Save the user's detected location to the backend.
   * @param {{ latitude: number, longitude: number, address: string }} payload
   */
  saveLocation: async (payload) => {
    try {
      const response = await api.post('/api/location', payload);
      return response.data;
    } catch (error) {
      // Non-critical – don't block the form; just propagate so LocationPicker
      // can show a subtle indicator
      throw error.response?.data || error.message;
    }
  },

  /**
   * Find locations within `radius` metres of the given coordinates.
   * @param {{ lat: number, lng: number, radius?: number }} params
   */
  getNearby: async ({ lat, lng, radius = 5000 }) => {
    try {
      const response = await api.get('/api/location/nearby', {
        params: { lat, lng, radius },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Admin Services
export const adminService = {
  getAllUsers: async () => {
    try {
      const response = await api.get('/auth/users');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  deleteUserById: async (id) => {
    try {
      const response = await api.delete(`/auth/users/delete/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  promoteToAdmin: async (userId) => {
    try {
      const response = await api.post(`/auth/users/promote/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getContacts: async () => {
    try {
      const response = await api.get('/auth/contacts');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  deleteContact: async (id) => {
    try {
      const response = await api.delete(`/auth/contacts/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getCrmSyncOverview: async () => {
    try {
      const response = await api.get('/auth/integrations/crm/overview');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Order Services
export const orderService = {
  createOrder: async (orderData) => {
    try {
      const response = await api.post('/auth/orders/create', orderData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getUserOrders: async () => {
    try {
      const response = await api.get('/auth/orders');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getOrderById: async (orderId) => {
    try {
      const response = await api.get(`/auth/orders/${orderId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      const response = await api.put(`/auth/orders/${orderId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getAllOrders: async () => {
    try {
      const response = await api.get('/auth/orders/admin/all');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  deleteOrder: async (orderId) => {
    try {
      const response = await api.delete(`/auth/orders/${orderId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  // Allow users to delete their own pending/failed orders
  deleteUserOrder: async (orderId) => {
    try {
      const response = await api.delete(`/auth/orders/user/${orderId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  cancelOrder: async (orderId, data) => {
    try {
      const response = await api.post(`/auth/orders/${orderId}/cancel`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  requestRefund: async (orderId, data) => {
    try {
      const response = await api.post(`/auth/orders/${orderId}/refund`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  requestAfterDeliveryAction: async (orderId, data) => {
    try {
      const response = await api.post(`/auth/orders/${orderId}/after-delivery-request`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Admin Refund Management
  approveRefund: async (orderId, data) => {
    try {
      const response = await api.post(`/auth/refunds/${orderId}/approve`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  rejectRefund: async (orderId, data) => {
    try {
      const response = await api.post(`/auth/refunds/${orderId}/reject`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  processRefund: async (orderId) => {
    try {
      const response = await api.post(`/auth/refunds/${orderId}/process`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  approveAfterDeliveryRequest: async (orderId, data) => {
    try {
      const response = await api.post(`/auth/after-delivery-requests/${orderId}/approve`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  rejectAfterDeliveryRequest: async (orderId, data) => {
    try {
      const response = await api.post(`/auth/after-delivery-requests/${orderId}/reject`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  processAfterDeliveryRequest: async (orderId) => {
    try {
      const response = await api.post(`/auth/after-delivery-requests/${orderId}/process`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// Review Services
export const reviewService = {
  addReview: async (reviewData) => {
    try {
    
      const response = await api.post('/auth/reviews/add', reviewData);
     
      return response.data;
    } catch (error) {
      
      throw error.response?.data || error;
    }
  },

  getProductReviews: async (productId) => {
    try {
    
      const response = await api.get(`/auth/reviews/product/${productId}`);
     
      return response.data;
    } catch (error) {
     
      throw error.response?.data || error;
    }
  },

  getUserProductReview: async (productId) => {
    try {
      
      const response = await api.get(`/auth/reviews/product/${productId}/user`);
     
      return response.data;
    } catch (error) {
      
      throw error.response?.data || error;
    }
  },

  updateReview: async (reviewId, reviewData) => {
    try {
      
      const response = await api.put(`/auth/reviews/${reviewId}`, reviewData);
    
      return response.data;
    } catch (error) {
      
      throw error.response?.data || error;
    }
  },

  deleteReview: async (reviewId) => {
    try {
      
      const response = await api.delete(`/auth/reviews/${reviewId}`);
     
      return response.data;
    } catch (error) {
     
      throw error.response?.data || error;
    }
  },
};

export default api;
