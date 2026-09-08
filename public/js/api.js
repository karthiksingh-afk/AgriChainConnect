// public/js/api.js

const API_BASE = '/api';

class ApiService {
  static getToken() {
    return localStorage.getItem('agrichain_token');
  }

  static setToken(token) {
    localStorage.setItem('agrichain_token', token);
  }

  static clearToken() {
    localStorage.removeItem('agrichain_token');
  }

  static async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        // If 401 and not on login page, session might be expired
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          this.clearToken();
        }
        throw new Error(data.error?.message || `HTTP Error ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Auth endpoints
  static register(userData) {
    return this.request('/auth/register', { method: 'POST', body: userData });
  }

  static login(credentials) {
    return this.request('/auth/login', { method: 'POST', body: credentials });
  }

  static getMe() {
    return this.request('/auth/me');
  }

  // Profile endpoints
  static updateLanguage(preferred_language) {
    return this.request('/user/language', { method: 'PUT', body: { preferred_language } });
  }

  static updateProfile(profileData) {
    return this.request('/user/profile', { method: 'PUT', body: profileData });
  }

  // Listings endpoints
  static getListings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/listings${query ? `?${query}` : ''}`);
  }

  static getMyListings() {
    return this.request('/listings/my');
  }

  static createListing(listingData) {
    return this.request('/listings', { method: 'POST', body: listingData });
  }

  static getStockPools() {
    return this.request('/listings/stock-pools');
  }

  static createStockPool(poolData) {
    return this.request('/listings/stock-pools', { method: 'POST', body: poolData });
  }

  // Negotiation endpoints
  static getNegotiations() {
    return this.request('/negotiations');
  }

  static getNegotiation(id) {
    return this.request(`/negotiations/${id}`);
  }

  static initiateNegotiation(data) {
    return this.request('/negotiations', { method: 'POST', body: data });
  }

  static submitCounterOffer(threadId, offerData) {
    return this.request(`/negotiations/${threadId}/offers`, { method: 'POST', body: offerData });
  }

  static acceptOffer(threadId, data) {
    return this.request(`/negotiations/${threadId}/accept`, { method: 'POST', body: data });
  }

  // Orders endpoints
  static getOrders(type = null) {
    const query = type ? `?type=${type}` : '';
    return this.request(`/orders${query}`);
  }

  static getOrder(id) {
    return this.request(`/orders/${id}`);
  }

  static createDirectOrder(orderData) {
    return this.request('/orders', { method: 'POST', body: orderData });
  }

  static updateOrderStatus(orderId, statusData) {
    return this.request(`/orders/${orderId}/status`, { method: 'POST', body: statusData });
  }

  static getOrderStatusHistory(orderId) {
    return this.request(`/orders/${orderId}/status-history`);
  }

  // Payments endpoints
  static getPayment(orderId) {
    return this.request(`/payments/${orderId}`);
  }

  static releaseEscrow(orderId, reason) {
    return this.request(`/payments/${orderId}/escrow/release`, { method: 'POST', body: { reason } });
  }

  static disputeEscrow(orderId, reason) {
    return this.request(`/payments/${orderId}/escrow/dispute`, { method: 'POST', body: { reason } });
  }

  static logCashSeller(orderId, cashData) {
    return this.request(`/payments/${orderId}/cash/log`, { method: 'POST', body: cashData });
  }

  static confirmCashBuyer(orderId, cashData) {
    return this.request(`/payments/${orderId}/cash/confirm`, { method: 'POST', body: cashData });
  }

  // Trust Score endpoints
  static getMyTrustScore() {
    return this.request('/trust-score/me');
  }

  static getUserTrustScore(userId) {
    return this.request(`/trust-score/${userId}`);
  }

  static submitReview(reviewData) {
    return this.request('/trust-score/reviews', { method: 'POST', body: reviewData });
  }

  // Route Optimization endpoint
  static getRouteRecommendations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/routes/recommendations${query ? `?${query}` : ''}`);
  }

  // Discovery endpoint
  static discoverNearby(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/discovery/nearby${query ? `?${query}` : ''}`);
  }

  // Value Distribution endpoint
  static getValueDistribution(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/value-distribution${query ? `?${query}` : ''}`);
  }

  // Market Prices endpoint
  static getMarketPrices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/market-prices${query ? `?${query}` : ''}`);
  }
}

window.ApiService = ApiService;
