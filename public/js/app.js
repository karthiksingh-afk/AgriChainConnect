// public/js/app.js

class AppController {
  static init() {
    // Subscribe to state changes
    AppState.subscribe((event, data) => {
      if (event === 'view_change' || event === 'step_change' || event === 'lang_change') {
        this.renderCurrentView();
      }
    });

    // Check existing session
    this.checkSession();

    // Setup periodic polling for real-time order & negotiation updates
    setInterval(() => {
      if (AppState.currentUser && AppState.currentView === 'dashboard') {
        this.pollUpdates();
      }
    }, 4000);
  }

  /**
   * Session Check & Authoritative Role Routing
   * Role is fetched from backend and never re-asked on subsequent visits
   */
  static async checkSession() {
    const token = ApiService.getToken();
    if (!token) {
      AppState.setView('onboarding');
      AppState.setOnboardingStep(1);
      return;
    }

    try {
      const response = await ApiService.getMe();
      if (response && response.user) {
        // Authoritative server-stored user role & language
        AppState.setCurrentUser(response.user);
        AppState.setView('dashboard');
        await this.loadDashboardData();
      } else {
        ApiService.clearToken();
        AppState.setView('onboarding');
      }
    } catch (err) {
      console.warn('Session verification failed, returning to onboarding:', err.message);
      ApiService.clearToken();
      AppState.setView('onboarding');
      AppState.setOnboardingStep(1);
    }
  }

  /**
   * Main View Renderer
   */
  static async renderCurrentView() {
    const root = document.getElementById('app-root');
    if (!root) return;

    if (AppState.currentView === 'onboarding') {
      root.innerHTML = OnboardingView.render();
    } else if (AppState.currentView === 'dashboard') {
      await this.loadDashboardData();
    }
  }

  /**
   * Load Data & Render Role Dashboard
   */
  static async loadDashboardData() {
    const user = AppState.currentUser;
    if (!user) return;

    const root = document.getElementById('app-root');
    if (!root) return;

    try {
      // Gather relevant data concurrently
      const promises = [
        user.role !== 'final_retailer' ? ApiService.getMyListings().catch(() => ({ listings: [] })) : Promise.resolve({ listings: [] }),
        user.role !== 'farmer' ? ApiService.getListings().catch(() => ({ listings: [] })) : Promise.resolve({ listings: [] }),
        ApiService.getNegotiations().catch(() => ({ negotiations: [] })),
        ApiService.getOrders().catch(() => ({ orders: [] })),
        ApiService.getValueDistribution().catch(() => ({ distributions: [] })),
        ApiService.discoverNearby({ radius_km: 25 }).catch(() => ({ members: [], search_radius_km: 25 })),
      ];

      if (user.role !== 'final_retailer') {
        promises.push(ApiService.getRouteRecommendations({ commodity_type: 'Wheat' }).catch(() => null));
      } else {
        promises.push(Promise.resolve(null));
      }

      if (user.role === 'local_aggregator') {
        promises.push(ApiService.getStockPools().catch(() => ({ pools: [] })));
      } else {
        promises.push(Promise.resolve({ pools: [] }));
      }

      const [myListingsRes, browseRes, negRes, ordersRes, valDistRes, discoveryRes, routeRes, poolsRes] = await Promise.all(promises);

      const dashboardData = {
        myListings: myListingsRes?.listings || [],
        browseListings: browseRes?.listings || [],
        negotiations: negRes?.threads || negRes?.negotiations || [],
        orders: ordersRes?.orders || [],
        valueDist: valDistRes?.value_distributions || valDistRes?.distributions || [],
        discovery: discoveryRes || { members: [], search_radius_km: 25 },
        routeRec: routeRes?.recommendation || null,
        pools: poolsRes?.pools || []
      };

      root.innerHTML = DashboardViews.render(user, dashboardData);
    } catch (err) {
      console.error('Error rendering dashboard:', err);
      AppState.showToast('Failed to load dashboard data: ' + err.message, 'error');
    }
  }

  /**
   * Background polling for real-time negotiation and order changes
   */
  static async pollUpdates() {
    try {
      const activeModal = document.querySelector('.modal-overlay');
      if (activeModal && activeModal.dataset.threadId) {
        // Refresh open negotiation thread
        this.refreshNegotiationThread(activeModal.dataset.threadId);
      }
    } catch (e) {
      // Silently ignore polling transient errors
    }
  }

  /* =========================================================================
     ONBOARDING EVENT HANDLERS (Section 11)
     ========================================================================= */

  static selectLanguage(lang) {
    AppState.selectedLanguage = lang;
    I18nService.setLang(lang);
    AppState.setOnboardingStep(2); // Move to Step 2: Role Selection
  }

  static selectRole(role) {
    AppState.selectedRole = role;
    AppState.setOnboardingStep(3); // Move to Step 3: Login/Register
    setTimeout(() => {
      this.switchAuthTab('register'); // Prefer register if role was picked
    }, 50);
  }

  static switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (!tabLogin || !tabRegister || !formLogin || !formRegister) return;

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formRegister.style.display = 'block';
      formLogin.style.display = 'none';
    }
  }

  static async handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    if (btn) btn.disabled = true;

    const username = document.getElementById('login-username')?.value?.trim();
    const password = document.getElementById('login-password')?.value;

    try {
      const res = await ApiService.login({ username, password });
      if (res && res.token) {
        ApiService.setToken(res.token);
        AppState.setCurrentUser(res.user);
        AppState.showToast(`Welcome back, ${res.user.full_name}!`, 'success');
        AppState.setView('dashboard');
      }
    } catch (err) {
      AppState.showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  static async handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('register-submit-btn');
    if (btn) btn.disabled = true;

    const full_name = document.getElementById('reg-name')?.value?.trim();
    const username = document.getElementById('reg-username')?.value?.trim();
    const password = document.getElementById('reg-password')?.value;
    const mobile_number = document.getElementById('reg-mobile')?.value?.trim();
    const location_address = document.getElementById('reg-location')?.value?.trim();
    const role = AppState.selectedRole || 'farmer';
    const preferred_language = AppState.selectedLanguage || 'en';

    try {
      const res = await ApiService.register({
        full_name,
        username,
        password,
        mobile_number,
        location_address,
        role,
        preferred_language
      });

      if (res && res.token) {
        ApiService.setToken(res.token);
        AppState.setCurrentUser(res.user);
        AppState.showToast(`Account registered successfully as ${role}!`, 'success');
        AppState.setView('dashboard');
      }
    } catch (err) {
      AppState.showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  static async handleLanguageChange(lang) {
    AppState.selectedLanguage = lang;
    I18nService.setLang(lang);
    if (AppState.currentUser) {
      try {
        await ApiService.updateLanguage(lang);
        AppState.showToast('Language preference updated & saved', 'success');
      } catch (e) {
        console.warn('Language update backend error:', e);
      }
    }
    this.renderCurrentView();
  }

  static handleLogout() {
    ApiService.clearToken();
    AppState.setCurrentUser(null);
    AppState.setView('onboarding');
    AppState.setOnboardingStep(1);
    AppState.showToast('Logged out successfully', 'info');
  }

  static switchTab(tabId) {
    AppState.setActiveTab(tabId);
    this.renderCurrentView();
  }

  /* =========================================================================
     MODAL CONTROLLERS & ACTIONS
     ========================================================================= */

  /**
   * Create Listing Modal (Role-specific)
   */
  static openCreateListingModal(role) {
    let title = 'Create Crop Listing';
    let commodityDefault = 'Wheat';
    if (role === 'wholesaler') title = 'Create Bulk Grain Listing';
    if (role === 'manufacturer') {
      title = 'Add Finished Goods SKU';
      commodityDefault = 'Wheat Flour (Atta)';
    }
    if (role === 'distributor') {
      title = 'Create Distribution Stock Offering';
      commodityDefault = 'Atta 10kg Bags';
    }

    const modalHtml = `
      <div class="modal-overlay" id="action-modal" onclick="if(event.target === this) this.remove()">
        <div class="modal-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.4rem; color: #fff;">${title}</h3>
            <button class="secondary-btn" style="padding: 0.3rem 0.6rem;" onclick="document.getElementById('action-modal').remove()">✕</button>
          </div>

          <form id="create-listing-form" onsubmit="AppController.handleCreateListingSubmit(event)">
            <div class="form-group">
              <label>Commodity / Product Name</label>
              <input type="text" id="list-commodity" class="form-input" value="${commodityDefault}" required />
            </div>

            <div class="form-group">
              <label>Variety / Grade / SKU Code</label>
              <input type="text" id="list-variety" class="form-input" placeholder="e.g. Sharbati Grade A" required />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label>Quantity (Quintals / Units)</label>
                <input type="number" step="0.1" id="list-quantity" class="form-input" placeholder="e.g. 50" required />
              </div>

              <div class="form-group">
                <label>Asking Price (₹ per unit/Qtl)</label>
                <input type="number" id="list-price" class="form-input" placeholder="e.g. 2400" required />
              </div>
            </div>

            <div class="form-group">
              <label>Location / Mandi Hub</label>
              <input type="text" id="list-location" class="form-input" value="${AppState.currentUser?.location_address || 'Sonipat Mandi'}" required />
            </div>

            <div class="form-group" style="display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem;">
              <input type="checkbox" id="list-organic" style="width: 18px; height: 18px; cursor: pointer;" />
              <label for="list-organic" style="margin-bottom: 0; cursor: pointer;">Certified Organic Commodity (+15% Premium potential)</label>
            </div>

            <button type="submit" class="glow-btn" style="width: 100%; margin-top: 1.5rem;" id="submit-listing-btn">
              Publish Listing ➔
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  static async handleCreateListingSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-listing-btn');
    if (btn) btn.disabled = true;

    const commodity_type = document.getElementById('list-commodity')?.value?.trim();
    const variety = document.getElementById('list-variety')?.value?.trim();
    const quantity_quintals = parseFloat(document.getElementById('list-quantity')?.value);
    const target_price_inr = parseFloat(document.getElementById('list-price')?.value);
    const location_address = document.getElementById('list-location')?.value?.trim();
    const is_organic = document.getElementById('list-organic')?.checked || false;

    try {
      await ApiService.createListing({
        commodity_type,
        variety,
        quantity_quintals,
        target_price_inr,
        location_address,
        is_organic
      });

      AppState.showToast('Listing published successfully!', 'success');
      document.getElementById('action-modal')?.remove();
      this.renderCurrentView();
    } catch (err) {
      AppState.showToast('Failed to create listing: ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /**
   * Stock Pooling Modal (Aggregator)
   */
  static openCreateStockPoolModal() {
    const modalHtml = `
      <div class="modal-overlay" id="action-modal" onclick="if(event.target === this) this.remove()">
        <div class="modal-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.4rem; color: #fff;">📦 Create Stock Pool</h3>
            <button class="secondary-btn" style="padding: 0.3rem 0.6rem;" onclick="document.getElementById('action-modal').remove()">✕</button>
          </div>

          <form id="create-pool-form" onsubmit="AppController.handleCreateStockPoolSubmit(event)">
            <div class="form-group">
              <label>Pool Name</label>
              <input type="text" id="pool-name" class="form-input" placeholder="e.g. Sonipat Wheat Bulk Lot #1" required />
            </div>

            <div class="form-group">
              <label>Commodity Type</label>
              <input type="text" id="pool-commodity" class="form-input" value="Wheat" required />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label>Aggregated Quantity (Qtl)</label>
                <input type="number" step="0.1" id="pool-quantity" class="form-input" placeholder="e.g. 500" required />
              </div>

              <div class="form-group">
                <label>Target Asking Price (₹/Qtl)</label>
                <input type="number" id="pool-price" class="form-input" placeholder="e.g. 2350" required />
              </div>
            </div>

            <button type="submit" class="glow-btn" style="width: 100%; margin-top: 1.5rem;" id="submit-pool-btn">
              Create Stock Pool ➔
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  static async handleCreateStockPoolSubmit(e) {
    e.preventDefault();
    const pool_name = document.getElementById('pool-name')?.value?.trim();
    const commodity_type = document.getElementById('pool-commodity')?.value?.trim();
    const total_quantity_quintals = parseFloat(document.getElementById('pool-quantity')?.value);
    const target_price_inr = parseFloat(document.getElementById('pool-price')?.value);

    try {
      await ApiService.createStockPool({
        pool_name,
        commodity_type,
        total_quantity_quintals,
        target_price_inr
      });

      AppState.showToast('Stock pool created successfully!', 'success');
      document.getElementById('action-modal')?.remove();
      this.renderCurrentView();
    } catch (err) {
      AppState.showToast('Failed to create stock pool: ' + err.message, 'error');
    }
  }

  static async listPoolForSale(poolId, poolName, commodity, quantity, price) {
    try {
      await ApiService.createListing({
        commodity_type: commodity,
        variety: `Pooled Lot: ${poolName}`,
        quantity_quintals: quantity,
        target_price_inr: price,
        location_address: AppState.currentUser?.location_address || 'Aggregator Hub'
      });
      AppState.showToast(`Pooled lot "${poolName}" published for wholesale!`, 'success');
      this.switchTab('sales');
    } catch (e) {
      AppState.showToast('Failed to list pooled stock: ' + e.message, 'error');
    }
  }

  /**
   * Direct Buy Now Modal
   */
  static openDirectOrderModal(listingId, sellerId, commodity, unitPrice, maxQty) {
    const modalHtml = `
      <div class="modal-overlay" id="order-modal" onclick="if(event.target === this) this.remove()">
        <div class="modal-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.4rem; color: #fff;">⚡ Instant Purchase Order</h3>
            <button class="secondary-btn" style="padding: 0.3rem 0.6rem;" onclick="document.getElementById('order-modal').remove()">✕</button>
          </div>

          <form id="direct-order-form" onsubmit="AppController.handleDirectOrderSubmit(event, '${listingId}', '${sellerId}', ${unitPrice})">
            <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
              <div>Commodity: <strong style="color: #fff;">${commodity}</strong></div>
              <div>Unit Price: <strong style="color: #34d399;">₹${unitPrice}/Qtl</strong></div>
              <div>Available Stock: <strong style="color: #fff;">${maxQty} Qtl</strong></div>
            </div>

            <div class="form-group">
              <label>Purchase Quantity (Quintals)</label>
              <input type="number" step="0.1" max="${maxQty}" id="order-qty" class="form-input" value="${Math.min(10, maxQty)}" required oninput="document.getElementById('order-total-display').innerText = '₹' + (this.value * ${unitPrice}).toLocaleString()" />
            </div>

            <div class="form-group">
              <label>Payment Method (Dual Flow per Section 5.1)</label>
              <select id="order-payment-method" class="form-input" style="cursor: pointer;">
                <option value="escrow">🔒 Escrow (UPI / Bank Transfer Held until Delivery)</option>
                <option value="cash">💵 Cash-on-Delivery (Dual Confirmation Flow)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Delivery Destination Address</label>
              <input type="text" id="order-address" class="form-input" value="${AppState.currentUser?.location_address || 'Main Storage Hub'}" required />
            </div>

            <div style="display: flex; justify-content: space-between; align-items: baseline; margin: 1.5rem 0 1rem; padding-top: 1rem; border-top: 1px solid var(--border-glass);">
              <span style="font-weight: 600; color: var(--text-muted);">Total Order Value:</span>
              <span id="order-total-display" style="font-size: 1.6rem; font-weight: 800; font-family: 'Outfit'; color: #34d399;">
                ₹${(Math.min(10, maxQty) * unitPrice).toLocaleString()}
              </span>
            </div>

            <button type="submit" class="glow-btn" style="width: 100%;" id="confirm-order-btn">
              Confirm Order & Secure Escrow ➔
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  static async handleDirectOrderSubmit(e, listingId, sellerId, unitPrice) {
    e.preventDefault();
    const btn = document.getElementById('confirm-order-btn');
    if (btn) btn.disabled = true;

    const quantity_quintals = parseFloat(document.getElementById('order-qty')?.value);
    const payment_method = document.getElementById('order-payment-method')?.value;
    const delivery_address = document.getElementById('order-address')?.value?.trim();

    try {
      const res = await ApiService.createDirectOrder({
        listing_id: listingId,
        seller_id: sellerId,
        quantity_quintals,
        unit_price_inr: unitPrice,
        payment_method,
        delivery_address
      });

      AppState.showToast('Order confirmed and initialized in 6-stage tracker!', 'success');
      document.getElementById('order-modal')?.remove();
      this.switchTab('orders');
    } catch (err) {
      AppState.showToast('Order creation failed: ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /**
   * Initiate Direct Trade / Negotiation
   */
  static openNegotiateModal(listingId, sellerId, commodity, price, quantity) {
    const modalHtml = `
      <div class="modal-overlay" id="negotiate-modal" onclick="if(event.target === this) this.remove()">
        <div class="modal-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.4rem; color: #fff;">🤝 Initiate Negotiation</h3>
            <button class="secondary-btn" style="padding: 0.3rem 0.6rem;" onclick="document.getElementById('negotiate-modal').remove()">✕</button>
          </div>

          <form onsubmit="AppController.handleInitiateNegotiationSubmit(event, '${listingId}', '${sellerId}')">
            <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
              <div>Commodity: <strong style="color: #fff;">${commodity}</strong></div>
              <div>Asking Price: <strong style="color: #34d399;">₹${price}/Qtl</strong></div>
              <div>Available: <strong>${quantity} Qtl</strong></div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label>Offered Quantity (Qtl)</label>
                <input type="number" step="0.1" id="neg-qty" class="form-input" value="${quantity}" required />
              </div>

              <div class="form-group">
                <label>Your Counter-Bid (₹/Qtl)</label>
                <input type="number" id="neg-price" class="form-input" value="${price}" required />
              </div>
            </div>

            <div class="form-group">
              <label>Payment Method</label>
              <select id="neg-payment" class="form-input">
                <option value="escrow">Escrow Guaranteed</option>
                <option value="cash">Cash on Delivery</option>
              </select>
            </div>

            <div class="form-group">
              <label>Delivery Terms & Proposal Note</label>
              <textarea id="neg-note" class="form-input" rows="2" placeholder="e.g. Can pick up at Sonipat hub by Friday morning."></textarea>
            </div>

            <button type="submit" class="glow-btn" style="width: 100%; margin-top: 1rem;" id="submit-negotiate-btn">
              Send Bid to Seller ➔
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  static async handleInitiateNegotiationSubmit(e, listingId, sellerId) {
    e.preventDefault();
    const btn = document.getElementById('submit-negotiate-btn');
    if (btn) btn.disabled = true;

    const initial_quantity = parseFloat(document.getElementById('neg-qty')?.value);
    const initial_price = parseFloat(document.getElementById('neg-price')?.value);
    const payment_method = document.getElementById('neg-payment')?.value;
    const note = document.getElementById('neg-note')?.value?.trim();

    try {
      const res = await ApiService.initiateNegotiation({
        listing_id: listingId,
        seller_id: sellerId,
        initial_quantity,
        initial_price,
        payment_method,
        note
      });

      AppState.showToast('Negotiation bid submitted!', 'success');
      document.getElementById('negotiate-modal')?.remove();
      const newThreadId = res.negotiation?.id || res.thread?.id;
      this.openNegotiationThread(newThreadId);
    } catch (err) {
      AppState.showToast('Failed to initiate negotiation: ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /**
   * Full Negotiation Thread Modal (PRD Section 5.2)
   */
  static async openNegotiationThread(threadId) {
    try {
      const res = await ApiService.getNegotiation(threadId);
      const negotiation = res.negotiation || res.thread;
      const offers = res.offers || [];
      const user = AppState.currentUser;
      const isBuyer = negotiation.buyer_id === user.id;
      const counterpartyName = isBuyer ? negotiation.seller_name : negotiation.buyer_name;
      const counterpartyRole = isBuyer ? negotiation.seller_role : negotiation.buyer_role;

      const modalHtml = `
        <div class="modal-overlay" id="thread-modal" data-thread-id="${threadId}" onclick="if(event.target === this) this.remove()">
          <div class="modal-content" style="max-width: 780px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
              <div>
                <span class="badge ${negotiation.status === 'open' ? 'badge-green' : 'badge-gold'}">${negotiation.status.toUpperCase()}</span>
                <h3 style="font-size: 1.4rem; color: #fff; margin-top: 0.25rem;">
                  Negotiation: ${negotiation.commodity_type || 'Commodity'}
                </h3>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  Trading with <strong>${counterpartyName || 'Partner'}</strong> (${counterpartyRole?.replace(/_/g, ' ')})
                </div>
              </div>
              <button class="secondary-btn" style="padding: 0.3rem 0.6rem;" onclick="document.getElementById('thread-modal').remove()">✕</button>
            </div>

            <!-- Offers Timeline -->
            <div class="chat-history" id="thread-chat-history">
              ${offers.map((offer, idx) => {
                const isMine = offer.sender_id === user.id;
                const isLatest = idx === offers.length - 1;

                return `
                  <div class="offer-bubble ${isMine ? 'sent' : 'received'}">
                    <div class="bubble-header">
                      <span>${isMine ? 'You' : counterpartyName} (${offer.sender_role?.replace(/_/g, ' ')})</span>
                      <span>${new Date(offer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div class="bubble-terms">
                      <div class="term-item">
                        <span class="term-label">Quantity</span>
                        <span class="term-val">${offer.quantity_quintals} Qtl</span>
                      </div>
                      <div class="term-item">
                        <span class="term-label">Unit Price</span>
                        <span class="term-val" style="color: #34d399;">₹${offer.unit_price_inr}</span>
                      </div>
                      <div class="term-item">
                        <span class="term-label">Total Value</span>
                        <span class="term-val">₹${(offer.quantity_quintals * offer.unit_price_inr).toLocaleString()}</span>
                      </div>
                    </div>

                    ${offer.note ? `<div class="bubble-msg">"${offer.note}"</div>` : ''}

                    <div class="bubble-footer">
                      <span>Method: <strong style="text-transform: uppercase;">${offer.payment_method}</strong></span>
                      ${isLatest && !isMine && negotiation.status === 'open' ? `
                        <button class="glow-btn" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; background: #10b981;" onclick="AppController.acceptNegotiationOffer('${threadId}', '${offer.id}')">
                          ✓ Accept This Offer
                        </button>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            ${negotiation.status === 'open' ? `
              <!-- Submit Counter-Offer Form -->
              <form id="counter-offer-form" onsubmit="AppController.handleCounterOfferSubmit(event, '${threadId}')" style="margin-top: 1.25rem; background: rgba(0,0,0,0.25); padding: 1.25rem; border-radius: var(--radius-sm);">
                <h4 style="color: #fff; font-size: 0.95rem; margin-bottom: 0.75rem;">💬 Propose Counter-Terms</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
                  <div>
                    <label style="font-size: 0.75rem; color: var(--text-dim);">Quantity (Qtl)</label>
                    <input type="number" step="0.1" id="counter-qty" class="form-input" value="${offers[offers.length - 1]?.quantity_quintals || 10}" required />
                  </div>
                  <div>
                    <label style="font-size: 0.75rem; color: var(--text-dim);">Price (₹/Qtl)</label>
                    <input type="number" id="counter-price" class="form-input" value="${offers[offers.length - 1]?.unit_price_inr || 2200}" required />
                  </div>
                  <div>
                    <label style="font-size: 0.75rem; color: var(--text-dim);">Payment Method</label>
                    <select id="counter-payment" class="form-input">
                      <option value="escrow">Escrow</option>
                      <option value="cash">Cash on Delivery</option>
                    </select>
                  </div>
                </div>

                <div style="margin-top: 0.75rem;">
                  <input type="text" id="counter-note" class="form-input" placeholder="Add custom terms or delivery notes..." />
                </div>

                <button type="submit" class="glow-btn" style="width: 100%; margin-top: 0.75rem; padding: 0.7rem;" id="send-counter-btn">
                  Send Counter-Offer ➔
                </button>
              </form>
            ` : `
              <div style="text-align: center; padding: 1rem; color: #34d399; font-weight: 700;">
                ✓ This negotiation has been accepted and closed into an active order.
              </div>
            `}
          </div>
        </div>
      `;

      // Remove existing if open, then append
      document.getElementById('thread-modal')?.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      // Auto scroll to bottom of chat
      const chatEl = document.getElementById('thread-chat-history');
      if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    } catch (err) {
      AppState.showToast('Failed to open negotiation room: ' + err.message, 'error');
    }
  }

  static async refreshNegotiationThread(threadId) {
    const threadModal = document.getElementById('thread-modal');
    if (!threadModal || threadModal.dataset.threadId !== threadId) return;

    try {
      const res = await ApiService.getNegotiation(threadId);
      const user = AppState.currentUser;
      const isBuyer = res.negotiation.buyer_id === user.id;
      const counterpartyName = isBuyer ? res.negotiation.seller_name : res.negotiation.buyer_name;
      const chatEl = document.getElementById('thread-chat-history');

      if (chatEl && res.offers) {
        chatEl.innerHTML = res.offers.map((offer, idx) => {
          const isMine = offer.sender_id === user.id;
          const isLatest = idx === res.offers.length - 1;

          return `
            <div class="offer-bubble ${isMine ? 'sent' : 'received'}">
              <div class="bubble-header">
                <span>${isMine ? 'You' : counterpartyName} (${offer.sender_role?.replace(/_/g, ' ')})</span>
                <span>${new Date(offer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="bubble-terms">
                <div class="term-item">
                  <span class="term-label">Quantity</span>
                  <span class="term-val">${offer.quantity_quintals} Qtl</span>
                </div>
                <div class="term-item">
                  <span class="term-label">Unit Price</span>
                  <span class="term-val" style="color: #34d399;">₹${offer.unit_price_inr}</span>
                </div>
              </div>
              ${offer.note ? `<div class="bubble-msg">"${offer.note}"</div>` : ''}
              <div class="bubble-footer">
                <span>Method: <strong style="text-transform: uppercase;">${offer.payment_method}</strong></span>
                ${isLatest && !isMine && res.negotiation.status === 'open' ? `
                  <button class="glow-btn" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; background: #10b981;" onclick="AppController.acceptNegotiationOffer('${threadId}', '${offer.id}')">
                    ✓ Accept Offer
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (e) {
      // Ignore background refresh errors
    }
  }

  static async handleCounterOfferSubmit(e, threadId) {
    e.preventDefault();
    const btn = document.getElementById('send-counter-btn');
    if (btn) btn.disabled = true;

    const quantity_quintals = parseFloat(document.getElementById('counter-qty')?.value);
    const unit_price_inr = parseFloat(document.getElementById('counter-price')?.value);
    const payment_method = document.getElementById('counter-payment')?.value;
    const note = document.getElementById('counter-note')?.value?.trim();

    try {
      await ApiService.submitCounterOffer(threadId, {
        quantity_quintals,
        unit_price_inr,
        payment_method,
        note
      });

      AppState.showToast('Counter-offer sent!', 'success');
      this.openNegotiationThread(threadId);
    } catch (err) {
      AppState.showToast('Failed to submit offer: ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  static async acceptNegotiationOffer(threadId, offerId) {
    if (!confirm('Accept this offer and confirm the deal? This will convert the offer into a legally binding supply chain order.')) return;

    try {
      const res = await ApiService.acceptOffer(threadId, { offer_id: offerId });
      AppState.showToast('Deal accepted! Order created successfully.', 'success');
      document.getElementById('thread-modal')?.remove();
      this.switchTab('orders');
    } catch (err) {
      AppState.showToast('Failed to accept offer: ' + err.message, 'error');
    }
  }

  /**
   * Update Order Status Tracking (PRD Section 12)
   */
  static async updateOrderStatus(orderId, nextStatus) {
    try {
      await ApiService.updateOrderStatus(orderId, {
        status: nextStatus,
        location: AppState.currentUser?.location_address || 'Regional Transshipment Hub',
        notes: `Milestone advanced to ${nextStatus.replace(/_/g, ' ')}`
      });

      AppState.showToast(`Order status updated to: ${nextStatus.replace(/_/g, ' ')}`, 'success');
      this.renderCurrentView();
    } catch (err) {
      AppState.showToast('Failed to update status: ' + err.message, 'error');
    }
  }

  /**
   * Payment & Escrow / Cash Dual-Flow Modal (PRD Section 5.1)
   */
  static async openPaymentDetailsModal(orderId) {
    try {
      const payment = await ApiService.getPayment(orderId);
      const user = AppState.currentUser;
      const isSeller = payment.seller_id === user.id;
      const isBuyer = payment.buyer_id === user.id;

      const isCash = payment.payment_method === 'cash';
      const isEscrow = payment.payment_method === 'escrow' || payment.payment_method === 'upi';

      const modalHtml = `
        <div class="modal-overlay" id="payment-modal" onclick="if(event.target === this) this.remove()">
          <div class="modal-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <h3 style="font-size: 1.4rem; color: #fff;">💳 Payment & Settlement Ledger</h3>
              <button class="secondary-btn" style="padding: 0.3rem 0.6rem;" onclick="document.getElementById('payment-modal').remove()">✕</button>
            </div>

            <div style="background: rgba(0,0,0,0.3); padding: 1.25rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span class="stat-label">Order Total</span>
                <span style="font-size: 1.4rem; font-weight: 800; color: #34d399;">₹${Number(payment.amount_inr).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span class="stat-label">Payment Channel</span>
                <span class="badge ${isCash ? 'badge-gold' : 'badge-green'}" style="text-transform: uppercase;">${payment.payment_method}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span class="stat-label">Escrow / Payment State</span>
                <strong style="color: #fff; text-transform: capitalize;">${payment.status}</strong>
              </div>
            </div>

            ${isEscrow ? `
              <!-- Escrow Flow -->
              <div style="background: rgba(16, 185, 129, 0.08); border-left: 3px solid #10b981; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem;">
                <h4 style="color: #34d399; font-size: 0.95rem;">🔒 Escrow Protection Guarantee</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem;">
                  Payment is safely locked in platform escrow. Funds are automatically released to the seller upon verified buyer delivery confirmation.
                </p>
              </div>

              ${isBuyer && payment.status === 'funded' ? `
                <div style="display: flex; gap: 0.75rem;">
                  <button class="glow-btn" style="flex: 2;" onclick="AppController.releaseEscrow('${orderId}')">
                    ✓ Confirm Delivery & Release Funds
                  </button>
                  <button class="secondary-btn" style="flex: 1; border-color: #ef4444; color: #f87171;" onclick="AppController.disputeEscrow('${orderId}')">
                    ⚠️ Raise Dispute
                  </button>
                </div>
              ` : ''}
            ` : ''}

            ${isCash ? `
              <!-- Cash Dual Confirmation Flow (PRD Section 5.1) -->
              <div style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem;">
                <h4 style="color: #fbbf24; font-size: 0.95rem;">💵 Cash-on-Delivery Dual Confirmation</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem;">
                  Both buyer and seller must independently log the physical cash amount transacted to verify complete settlement.
                </p>
                <div style="display: flex; gap: 1.5rem; margin-top: 0.75rem; font-size: 0.85rem;">
                  <div>Seller Collected: <strong style="color: #fff;">${payment.cash_collected_amount !== null ? '₹' + payment.cash_collected_amount : 'Pending'}</strong></div>
                  <div>Buyer Confirmed: <strong style="color: #fff;">${payment.cash_buyer_confirmed_amount !== null ? '₹' + payment.cash_buyer_confirmed_amount : 'Pending'}</strong></div>
                </div>
              </div>

              ${payment.is_cash_mismatch ? `
                <div class="cash-mismatch-banner">
                  <span>⚠️</span>
                  <span><strong>Cash Mismatch Detected:</strong> Seller logged ₹${payment.cash_collected_amount} but Buyer logged ₹${payment.cash_buyer_confirmed_amount}. Resolution ticket opened.</span>
                </div>
              ` : ''}

              ${isSeller && payment.cash_collected_amount === null ? `
                <form onsubmit="AppController.handleSellerCashLog(event, '${orderId}')" style="margin-top: 1rem;">
                  <div class="form-group">
                    <label>Log Physical Cash Received (₹)</label>
                    <input type="number" id="cash-seller-amount" class="form-input" value="${payment.amount_inr}" required />
                  </div>
                  <button type="submit" class="glow-btn" style="width: 100%;">
                    Log Cash Received ➔
                  </button>
                </form>
              ` : ''}

              ${isBuyer && payment.cash_buyer_confirmed_amount === null ? `
                <form onsubmit="AppController.handleBuyerCashConfirm(event, '${orderId}')" style="margin-top: 1rem;">
                  <div class="form-group">
                    <label>Confirm Physical Cash Paid to Seller (₹)</label>
                    <input type="number" id="cash-buyer-amount" class="form-input" value="${payment.amount_inr}" required />
                  </div>
                  <button type="submit" class="glow-btn" style="width: 100%;">
                    Confirm Cash Paid ➔
                  </button>
                </form>
              ` : ''}
            ` : ''}
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (err) {
      AppState.showToast('Failed to load payment details: ' + err.message, 'error');
    }
  }

  static async releaseEscrow(orderId) {
    if (!confirm('Release escrow funds to the seller now?')) return;

    try {
      await ApiService.releaseEscrow(orderId, 'Buyer confirmed receipt');
      AppState.showToast('Escrow released successfully! Transaction settled.', 'success');
      document.getElementById('payment-modal')?.remove();
      this.renderCurrentView();
    } catch (err) {
      AppState.showToast('Failed to release escrow: ' + err.message, 'error');
    }
  }

  static async disputeEscrow(orderId) {
    const reason = prompt('Please describe the dispute reason (e.g. damaged goods, moisture non-compliance):');
    if (!reason) return;

    try {
      await ApiService.disputeEscrow(orderId, reason);
      AppState.showToast('Dispute logged. Escrow held securely.', 'warning');
      document.getElementById('payment-modal')?.remove();
      this.renderCurrentView();
    } catch (err) {
      AppState.showToast('Failed to dispute escrow: ' + err.message, 'error');
    }
  }

  static async handleSellerCashLog(e, orderId) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('cash-seller-amount')?.value);

    try {
      await ApiService.logCashSeller(orderId, { amount, notes: 'Cash logged by seller' });
      AppState.showToast('Cash collection logged successfully!', 'success');
      document.getElementById('payment-modal')?.remove();
      this.openPaymentDetailsModal(orderId);
    } catch (err) {
      AppState.showToast('Failed to log cash: ' + err.message, 'error');
    }
  }

  static async handleBuyerCashConfirm(e, orderId) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('cash-buyer-amount')?.value);

    try {
      await ApiService.confirmCashBuyer(orderId, { amount, notes: 'Cash confirmed by buyer' });
      AppState.showToast('Cash confirmation submitted!', 'success');
      document.getElementById('payment-modal')?.remove();
      this.openPaymentDetailsModal(orderId);
    } catch (err) {
      AppState.showToast('Failed to confirm cash: ' + err.message, 'error');
    }
  }

  /**
   * Review Counterparty Modal & Trust Score Update (PRD Section 9.2 Pillar 4)
   */
  static openReviewModal(orderId, revieweeId) {
    const modalHtml = `
      <div class="modal-overlay" id="review-modal" onclick="if(event.target === this) this.remove()">
        <div class="modal-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.4rem; color: #fff;">⭐ Review Trading Partner</h3>
            <button class="secondary-btn" style="padding: 0.3rem 0.6rem;" onclick="document.getElementById('review-modal').remove()">✕</button>
          </div>

          <form onsubmit="AppController.handleReviewSubmit(event, '${orderId}', '${revieweeId}')">
            <div class="form-group">
              <label>Overall Star Rating (1 to 5 Stars)</label>
              <select id="review-stars" class="form-input">
                <option value="5">★★★★★ (5 Stars - Exceptional Service)</option>
                <option value="4" selected>★★★★☆ (4 Stars - Prompt & Professional)</option>
                <option value="3">★★★☆☆ (3 Stars - Satisfactory)</option>
                <option value="2">★★☆☆☆ (2 Stars - Below Expectation)</option>
                <option value="1">★☆☆☆☆ (1 Star - Poor Compliance)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Written Experience & Notes</label>
              <textarea id="review-comments" class="form-input" rows="3" placeholder="Punctual delivery, high quality grain, smooth transaction."></textarea>
            </div>

            <button type="submit" class="glow-btn" style="width: 100%; margin-top: 1rem;" id="submit-review-btn">
              Submit Review & Update Trust Score ➔
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  static async handleReviewSubmit(e, orderId, revieweeId) {
    e.preventDefault();
    const btn = document.getElementById('submit-review-btn');
    if (btn) btn.disabled = true;

    const rating = parseInt(document.getElementById('review-stars')?.value, 10);
    const comments = document.getElementById('review-comments')?.value?.trim();

    try {
      await ApiService.submitReview({
        order_id: orderId,
        reviewee_id: revieweeId,
        rating,
        comments
      });

      AppState.showToast('Peer review submitted! Partner Trust Score recalculated.', 'success');
      document.getElementById('review-modal')?.remove();
      this.renderCurrentView();
    } catch (err) {
      AppState.showToast('Failed to submit review: ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  static initiateDirectTrade(memberId, memberName) {
    AppState.showToast(`Initiating direct trade channel with ${memberName}`, 'info');
    // Open negotiation modal targeting member's active offerings
    this.openNegotiateModal(null, memberId, 'Wheat', 2300, 100);
  }

  static viewListingOffers(listingId) {
    this.switchTab('negotiations');
  }
}

window.AppController = AppController;

// Auto boot on DOM load
document.addEventListener('DOMContentLoaded', () => {
  AppController.init();
});
