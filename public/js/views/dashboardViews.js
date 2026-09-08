// public/js/views/dashboardViews.js

class DashboardViews {
  /**
   * Main Router for Dashboard
   */
  static render(user, data = {}) {
    const role = user.role;
    const tab = AppState.activeTab || 'overview';

    return `
      <div class="dashboard-layout">
        ${SharedComponents.renderNavbar(user)}
        <div class="dashboard-body">
          ${this.renderSidebar(user, tab)}
          <main class="main-content" id="dashboard-main-content">
            ${this.renderRoleContent(role, tab, data, user)}
          </main>
        </div>
      </div>
    `;
  }

  /**
   * Role-Specific Sidebar Navigation
   * Enforces exact navigation items per Section 4
   */
  static renderSidebar(user, currentTab) {
    const role = user.role;
    let items = [];

    if (role === 'farmer') {
      // PRD Section 4.1: Sell-only (NO BROWSE TO BUY)
      items = [
        { id: 'overview', icon: '📊', label: 'Farm Overview' },
        { id: 'listings', icon: '🌾', label: 'My Crop Listings' },
        { id: 'negotiations', icon: '💬', label: 'Offers Received' },
        { id: 'orders', icon: '📦', label: 'Sales Orders & Status' },
        { id: 'routes', icon: '⚡', label: 'AI Route Recommendations' },
        { id: 'discovery', icon: '📍', label: 'Nearby Aggregators' },
        { id: 'transparency', icon: '⚖️', label: '₹100 Transparency' },
      ];
    } else if (role === 'local_aggregator') {
      // PRD Section 4.2: Dual-sided
      items = [
        { id: 'overview', icon: '📊', label: 'Hub Overview' },
        { id: 'procurement', icon: '🛒', label: 'Procure from Farmers' },
        { id: 'pooling', icon: '📦', label: 'Stock Pooling' },
        { id: 'sales', icon: '🌾', label: 'Pooled Sales Listings' },
        { id: 'negotiations', icon: '💬', label: 'Negotiations' },
        { id: 'orders', icon: '🚚', label: 'Inbound & Outbound Orders' },
        { id: 'routes', icon: '⚡', label: 'AI Route Optimization' },
        { id: 'discovery', icon: '📍', label: 'Nearby Members' },
        { id: 'transparency', icon: '⚖️', label: '₹100 Transparency' },
      ];
    } else if (role === 'wholesaler') {
      // PRD Section 4.3: Dual-sided
      items = [
        { id: 'overview', icon: '📊', label: 'Warehouse Overview' },
        { id: 'procurement', icon: '🛒', label: 'Bulk Procurement' },
        { id: 'inventory', icon: '🏢', label: 'Grain Storage' },
        { id: 'sales', icon: '🌾', label: 'Wholesale Listings' },
        { id: 'negotiations', icon: '💬', label: 'Negotiations' },
        { id: 'orders', icon: '🚚', label: 'Bulk Orders' },
        { id: 'routes', icon: '⚡', label: 'AI Route Optimization' },
        { id: 'discovery', icon: '📍', label: 'Nearby Partners' },
        { id: 'transparency', icon: '⚖️', label: '₹100 Transparency' },
      ];
    } else if (role === 'manufacturer') {
      // PRD Section 4.4: Dual-sided
      items = [
        { id: 'overview', icon: '📊', label: 'Plant Overview' },
        { id: 'procurement', icon: '🛒', label: 'Raw Material Sourcing' },
        { id: 'processing', icon: '⚙️', label: 'Processing Board' },
        { id: 'catalog', icon: '🏷️', label: 'Finished Goods SKUs' },
        { id: 'negotiations', icon: '💬', label: 'Negotiations' },
        { id: 'orders', icon: '🚚', label: 'Distributor Orders' },
        { id: 'routes', icon: '⚡', label: 'AI Route Optimization' },
        { id: 'discovery', icon: '📍', label: 'Nearby Partners' },
        { id: 'transparency', icon: '⚖️', label: '₹100 Transparency' },
      ];
    } else if (role === 'distributor') {
      // PRD Section 4.5: Dual-sided
      items = [
        { id: 'overview', icon: '📊', label: 'Logistics Overview' },
        { id: 'procurement', icon: '🛒', label: 'Source Mfg SKUs' },
        { id: 'inventory', icon: '🏬', label: 'Regional Warehouse' },
        { id: 'negotiations', icon: '💬', label: 'Negotiations' },
        { id: 'orders', icon: '🚚', label: 'Retailer Orders' },
        { id: 'routes', icon: '⚡', label: 'AI Logistics Routing' },
        { id: 'discovery', icon: '📍', label: 'Nearby Outlets' },
        { id: 'transparency', icon: '⚖️', label: '₹100 Transparency' },
      ];
    } else if (role === 'final_retailer') {
      // PRD Section 4.6: Buy-only (NO CREATE LISTING TO SELL)
      items = [
        { id: 'overview', icon: '📊', label: 'Store Overview' },
        { id: 'procurement', icon: '🛒', label: 'Procure Stock' },
        { id: 'negotiations', icon: '💬', label: 'Active Inquiries' },
        { id: 'orders', icon: '📦', label: 'Store Orders & Escrow' },
        { id: 'discovery', icon: '📍', label: 'Nearby Distributors' },
        { id: 'transparency', icon: '⚖️', label: '₹100 Transparency' },
      ];
    }

    return `
      <aside class="role-sidebar">
        <div class="sidebar-heading">${user.role.replace(/_/g, ' ')} Portal</div>
        ${items.map(item => `
          <a class="nav-item ${currentTab === item.id ? 'active' : ''}" onclick="AppController.switchTab('${item.id}')">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>
        `).join('')}
      </aside>
    `;
  }

  /**
   * Route Content Rendering
   */
  static renderRoleContent(role, tab, data, user) {
    switch (role) {
      case 'farmer':
        return this.renderFarmerDashboard(tab, data, user);
      case 'local_aggregator':
        return this.renderAggregatorDashboard(tab, data, user);
      case 'wholesaler':
        return this.renderWholesalerDashboard(tab, data, user);
      case 'manufacturer':
        return this.renderManufacturerDashboard(tab, data, user);
      case 'distributor':
        return this.renderDistributorDashboard(tab, data, user);
      case 'final_retailer':
        return this.renderRetailerDashboard(tab, data, user);
      default:
        return `<div class="glass-panel" style="padding: 2rem;">Unknown role: ${role}</div>`;
    }
  }

  /* =========================================================================
     1. FARMER DASHBOARD (PRD Section 4.1 - Sell-Only)
     ========================================================================= */
  static renderFarmerDashboard(tab, data, user) {
    const { myListings = [], negotiations = [], orders = [], routeRec, discovery, valueDist } = data;

    if (tab === 'listings') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🌾 My Crop Listings</h2>
            <p>Direct from farm to verified aggregators, wholesalers, or processors.</p>
          </div>
          <button class="glow-btn" onclick="AppController.openCreateListingModal('farmer')">
            + Create New Crop Listing
          </button>
        </div>
        ${this.renderListingsTable(myListings, true)}
      `;
    }

    if (tab === 'negotiations') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>💬 Offers & Negotiations Received</h2>
            <p>Review incoming counter-offers, accept, or offer counter-terms.</p>
          </div>
        </div>
        ${this.renderNegotiationsList(negotiations, user)}
      `;
    }

    if (tab === 'orders') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>📦 Farm Sales Orders & Escrow Tracking</h2>
            <p>Track delivery milestones, update dispatch statuses, and verify escrow release.</p>
          </div>
        </div>
        ${this.renderOrdersSection(orders, user)}
      `;
    }

    if (tab === 'routes') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>⚡ AI Route Recommendation & Disintermediation</h2>
            <p>Automated intelligence calculating whether to sell locally or bypass directly to processors.</p>
          </div>
        </div>
        ${SharedComponents.renderRouteRecommendationCard(routeRec)}
      `;
    }

    if (tab === 'discovery') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>📍 Nearby Aggregators & Verified Buyers</h2>
            <p>Local collection centres and procurement hubs within your radius.</p>
          </div>
        </div>
        ${SharedComponents.renderNearbyDiscovery(discovery, 'AppController.initiateDirectTrade')}
      `;
    }

    if (tab === 'transparency') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>⚖️ Supply Chain Transparency</h2>
            <p>Ensuring farmers get fair market price without hidden intermediary extraction.</p>
          </div>
        </div>
        ${SharedComponents.renderValueDistributionPanel(valueDist, 'farmer')}
      `;
    }

    // Default: 'overview'
    const totalHarvestQtl = myListings.reduce((sum, l) => sum + Number(l.quantity_quintals || 0), 0);
    const activeOffersCount = negotiations.filter(n => n.status === 'open').length;
    const activeOrdersCount = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

    return `
      <div class="content-header">
        <div class="content-title">
          <h2>🌾 Farmer Dashboard — Welcome back, ${user.full_name}</h2>
          <p>Mandi / Location: <strong>${user.location_address || 'Unspecified'}</strong> | Direct AgriChain Node</p>
        </div>
        <button class="glow-btn" onclick="AppController.openCreateListingModal('farmer')">
          + Create Crop Listing
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-green">🌾</div>
          <div class="stat-details">
            <span class="stat-label">Listed Inventory</span>
            <span class="stat-val">${totalHarvestQtl} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">Qtl</span></span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-gold">💬</div>
          <div class="stat-details">
            <span class="stat-label">Active Negotiations</span>
            <span class="stat-val">${activeOffersCount}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-blue">📦</div>
          <div class="stat-details">
            <span class="stat-label">Orders in Progress</span>
            <span class="stat-val">${activeOrdersCount}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-purple">⭐</div>
          <div class="stat-details">
            <span class="stat-label">Farmer Trust Score</span>
            <span class="stat-val">${user.trust_score?.star_rating || '4.0'} <span style="font-size: 0.9rem; color: var(--text-dim);">(${user.trust_score?.aggregate_score || 80})</span></span>
          </div>
        </div>
      </div>

      <!-- Quick AI Route Highlight -->
      ${routeRec ? SharedComponents.renderRouteRecommendationCard(routeRec) : ''}

      <!-- Recent Crop Listings -->
      <div style="margin-top: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="color: #fff; font-size: 1.3rem;">My Active Harvest Listings</h3>
          <a href="#" onclick="AppController.switchTab('listings')" style="color: var(--primary-light); font-size: 0.9rem;">View All (${myListings.length}) ➔</a>
        </div>
        ${this.renderListingsTable(myListings.slice(0, 3), true)}
      </div>

      <!-- ₹100 Transparency Preview -->
      <div style="margin-top: 2rem;">
        ${SharedComponents.renderValueDistributionPanel(valueDist, 'farmer')}
      </div>
    `;
  }

  /* =========================================================================
     2. LOCAL AGGREGATOR DASHBOARD (PRD Section 4.2 - Dual-Sided)
     ========================================================================= */
  static renderAggregatorDashboard(tab, data, user) {
    const { browseListings = [], myListings = [], pools = [], negotiations = [], orders = [], routeRec, discovery, valueDist } = data;

    if (tab === 'procurement') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🛒 Procure from Nearby Farmers</h2>
            <p>Browse direct harvest lots, negotiate prices, and build local stock.</p>
          </div>
        </div>
        ${this.renderBrowseListingsGrid(browseListings, user)}
      `;
    }

    if (tab === 'pooling') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>📦 Stock Pooling Hub (PRD Section 4.2)</h2>
            <p>Aggregate smallholder farmer batches into standardized wholesale lots.</p>
          </div>
          <button class="glow-btn" onclick="AppController.openCreateStockPoolModal()">
            + Create New Stock Pool
          </button>
        </div>
        ${this.renderStockPoolsSection(pools)}
      `;
    }

    if (tab === 'sales') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🌾 Aggregated Sales Listings</h2>
            <p>Offer pooled grain lots to regional Wholesalers and Processors.</p>
          </div>
          <button class="glow-btn" onclick="AppController.openCreateListingModal('local_aggregator')">
            + Create Wholesale Listing
          </button>
        </div>
        ${this.renderListingsTable(myListings, true)}
      `;
    }

    if (tab === 'negotiations') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>💬 Dual-Sided Negotiations</h2>
            <p>Manage procurement bids with Farmers and wholesale deals with Buyers.</p>
          </div>
        </div>
        ${this.renderNegotiationsList(negotiations, user)}
      `;
    }

    if (tab === 'orders') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🚚 Aggregator Orders & Dual Escrow</h2>
            <p>Inbound deliveries from farmers and outbound bulk shipments to buyers.</p>
          </div>
        </div>
        ${this.renderOrdersSection(orders, user)}
      `;
    }

    if (tab === 'routes') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>⚡ AI Route Recommendations</h2>
            <p>Optimizing bypass pathways directly to Processors when volume meets criteria.</p>
          </div>
        </div>
        ${SharedComponents.renderRouteRecommendationCard(routeRec)}
      `;
    }

    if (tab === 'discovery') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>📍 Adaptive Discovery: Local Farmers & Commercial Buyers</h2>
          </div>
        </div>
        ${SharedComponents.renderNearbyDiscovery(discovery, 'AppController.initiateDirectTrade')}
      `;
    }

    if (tab === 'transparency') {
      return SharedComponents.renderValueDistributionPanel(valueDist, 'local_aggregator');
    }

    // Default: 'overview'
    return `
      <div class="content-header">
        <div class="content-title">
          <h2>📦 Local Aggregator Hub — ${user.full_name}</h2>
          <p>Mandi / Collection Centre: <strong>${user.location_address || 'Main Hub'}</strong></p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="secondary-btn" onclick="AppController.switchTab('procurement')">🛒 Browse Farmer Crops</button>
          <button class="glow-btn" onclick="AppController.openCreateStockPoolModal()">+ Pool Stock</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-gold">📦</div>
          <div class="stat-details">
            <span class="stat-label">Active Stock Pools</span>
            <span class="stat-val">${pools.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-green">🌾</div>
          <div class="stat-details">
            <span class="stat-label">Pooled Lots for Sale</span>
            <span class="stat-val">${myListings.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-blue">💬</div>
          <div class="stat-details">
            <span class="stat-label">Active Negotiations</span>
            <span class="stat-val">${negotiations.filter(n => n.status === 'open').length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-purple">⭐</div>
          <div class="stat-details">
            <span class="stat-label">Aggregator Trust</span>
            <span class="stat-val">${user.trust_score?.star_rating || '4.0'}</span>
          </div>
        </div>
      </div>

      ${routeRec ? SharedComponents.renderRouteRecommendationCard(routeRec) : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
        <div class="glass-panel" style="padding: 1.5rem;">
          <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 0.75rem;">🌾 Fresh Farmer Harvest Lots</h3>
          ${this.renderBrowseListingsGrid(browseListings.slice(0, 2), user, true)}
          <a href="#" onclick="AppController.switchTab('procurement')" style="display: block; margin-top: 0.75rem; color: var(--primary-light); font-size: 0.85rem;">View All Listings ➔</a>
        </div>

        <div class="glass-panel" style="padding: 1.5rem;">
          <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 0.75rem;">📦 Active Pooled Batches</h3>
          ${this.renderStockPoolsSection(pools.slice(0, 2))}
          <a href="#" onclick="AppController.switchTab('pooling')" style="display: block; margin-top: 0.75rem; color: var(--accent-gold); font-size: 0.85rem;">Manage All Pools ➔</a>
        </div>
      </div>

      <div style="margin-top: 2rem;">
        ${SharedComponents.renderValueDistributionPanel(valueDist, 'local_aggregator')}
      </div>
    `;
  }

  /* =========================================================================
     3. WHOLESALER DASHBOARD (PRD Section 4.3 - Dual-Sided)
     ========================================================================= */
  static renderWholesalerDashboard(tab, data, user) {
    const { browseListings = [], myListings = [], negotiations = [], orders = [], routeRec, discovery, valueDist } = data;

    if (tab === 'procurement') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🛒 Bulk Procurement (Aggregators & Direct)</h2>
            <p>Source high-volume commodities for warehouse intake.</p>
          </div>
        </div>
        ${this.renderBrowseListingsGrid(browseListings, user)}
      `;
    }

    if (tab === 'inventory') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🏢 Regional Warehouse & Grain Storage</h2>
            <p>Manage silo capacity, moisture levels, and grade inventory.</p>
          </div>
        </div>
        <div class="glass-panel" style="padding: 2rem;">
          <h3 style="color: #fff; margin-bottom: 1rem;">Warehouse Facility: Sonipat Terminal Silo A</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-details">
                <span class="stat-label">Total Storage Capacity</span>
                <span class="stat-val">10,000 Qtl</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-details">
                <span class="stat-label">Current Occupancy</span>
                <span class="stat-val">6,450 Qtl (64.5%)</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-details">
                <span class="stat-label">Grain Grade</span>
                <span class="stat-val" style="color: #34d399;">Grade A (FAQ)</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (tab === 'sales') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🌾 Bulk Wholesale Offerings</h2>
            <p>Offer bulk grain lots to Processors and Distributors.</p>
          </div>
          <button class="glow-btn" onclick="AppController.openCreateListingModal('wholesaler')">
            + Create Wholesale Offering
          </button>
        </div>
        ${this.renderListingsTable(myListings, true)}
      `;
    }

    if (tab === 'negotiations') return this.renderNegotiationsList(negotiations, user);
    if (tab === 'orders') return this.renderOrdersSection(orders, user);
    if (tab === 'routes') return SharedComponents.renderRouteRecommendationCard(routeRec);
    if (tab === 'discovery') return SharedComponents.renderNearbyDiscovery(discovery, 'AppController.initiateDirectTrade');
    if (tab === 'transparency') return SharedComponents.renderValueDistributionPanel(valueDist, 'wholesaler');

    // Default overview
    return `
      <div class="content-header">
        <div class="content-title">
          <h2>🏢 Wholesaler Terminal — ${user.full_name}</h2>
          <p>Grain Storage Hub: <strong>${user.location_address || 'Regional Mandi'}</strong></p>
        </div>
        <button class="glow-btn" onclick="AppController.openCreateListingModal('wholesaler')">+ List Bulk Grain</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-blue">🏢</div>
          <div class="stat-details">
            <span class="stat-label">Stored Inventory</span>
            <span class="stat-val">6,450 Qtl</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-green">🌾</div>
          <div class="stat-details">
            <span class="stat-label">Active Sales Listings</span>
            <span class="stat-val">${myListings.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-gold">💬</div>
          <div class="stat-details">
            <span class="stat-label">Pending Deals</span>
            <span class="stat-val">${negotiations.filter(n => n.status === 'open').length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-purple">⭐</div>
          <div class="stat-details">
            <span class="stat-label">Trust Score</span>
            <span class="stat-val">${user.trust_score?.star_rating || '4.0'}</span>
          </div>
        </div>
      </div>

      ${routeRec ? SharedComponents.renderRouteRecommendationCard(routeRec) : ''}
      <div style="margin-top: 2rem;">
        ${SharedComponents.renderValueDistributionPanel(valueDist, 'wholesaler')}
      </div>
    `;
  }

  /* =========================================================================
     4. MANUFACTURER / PROCESSOR DASHBOARD (PRD Section 4.4 - Dual-Sided)
     ========================================================================= */
  static renderManufacturerDashboard(tab, data, user) {
    const { browseListings = [], myListings = [], negotiations = [], orders = [], routeRec, discovery, valueDist } = data;

    if (tab === 'procurement') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🛒 Raw Material Sourcing</h2>
            <p>Procure raw crops (Wheat, Paddy, Pulses) directly from Farmers or Aggregators.</p>
          </div>
        </div>
        ${this.renderBrowseListingsGrid(browseListings, user)}
      `;
    }

    if (tab === 'processing') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>⚙️ Processing Status Board (PRD Section 4.4)</h2>
            <p>Tracking transformation from raw agricultural commodity to branded packaged SKU.</p>
          </div>
        </div>
        <div class="glass-panel" style="padding: 2rem;">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 1.25rem;">
              <h4 style="color: #fbbf24;">1. Sourced & Intake</h4>
              <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 0.35rem;">Wheat Batch #WH-809</p>
              <div style="font-weight: 700; color: #fff; margin-top: 0.5rem;">500 Quintals</div>
              <span class="badge badge-gold" style="margin-top: 0.5rem;">Intake Cleared</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 1.25rem;">
              <h4 style="color: #38bdf8;">2. Milling & Cleaning</h4>
              <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 0.35rem;">Line 2 (Rotary Mill)</p>
              <div style="font-weight: 700; color: #fff; margin-top: 0.5rem;">320 Quintals</div>
              <span class="badge badge-blue" style="margin-top: 0.5rem;">In Progress</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 1.25rem;">
              <h4 style="color: #c084fc;">3. Quality & Packaging</h4>
              <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 0.35rem;">Chakki Atta 10kg Bags</p>
              <div style="font-weight: 700; color: #fff; margin-top: 0.5rem;">1,200 Packs</div>
              <span class="badge badge-purple" style="margin-top: 0.5rem;">Packaging</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 1.25rem;">
              <h4 style="color: #34d399;">4. Ready for Dispatch</h4>
              <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 0.35rem;">SKU: Pure Atta (Premium)</p>
              <div style="font-weight: 700; color: #fff; margin-top: 0.5rem;">4,500 Units</div>
              <span class="badge badge-green" style="margin-top: 0.5rem;">QC Certified</span>
            </div>
          </div>
        </div>
      `;
    }

    if (tab === 'catalog') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🏷️ Finished Goods SKU Catalog</h2>
            <p>Offer packaged commodities to Regional Distributors.</p>
          </div>
          <button class="glow-btn" onclick="AppController.openCreateListingModal('manufacturer')">
            + Add New SKU Offering
          </button>
        </div>
        ${this.renderListingsTable(myListings, true)}
      `;
    }

    if (tab === 'negotiations') return this.renderNegotiationsList(negotiations, user);
    if (tab === 'orders') return this.renderOrdersSection(orders, user);
    if (tab === 'routes') return SharedComponents.renderRouteRecommendationCard(routeRec);
    if (tab === 'discovery') return SharedComponents.renderNearbyDiscovery(discovery, 'AppController.initiateDirectTrade');
    if (tab === 'transparency') return SharedComponents.renderValueDistributionPanel(valueDist, 'manufacturer');

    // Default overview
    return `
      <div class="content-header">
        <div class="content-title">
          <h2>⚙️ Processing Plant — ${user.full_name}</h2>
          <p>Factory / Milling Facility: <strong>${user.location_address || 'Industrial Agro Park'}</strong></p>
        </div>
        <button class="glow-btn" onclick="AppController.openCreateListingModal('manufacturer')">+ Create SKU Offering</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-purple">⚙️</div>
          <div class="stat-details">
            <span class="stat-label">Active Milling Batches</span>
            <span class="stat-val">4 Lines</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-green">🏷️</div>
          <div class="stat-details">
            <span class="stat-label">Packaged SKUs</span>
            <span class="stat-val">${myListings.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-blue">🚚</div>
          <div class="stat-details">
            <span class="stat-label">Distributor Orders</span>
            <span class="stat-val">${orders.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-gold">⭐</div>
          <div class="stat-details">
            <span class="stat-label">Manufacturer Trust</span>
            <span class="stat-val">${user.trust_score?.star_rating || '4.0'}</span>
          </div>
        </div>
      </div>

      ${routeRec ? SharedComponents.renderRouteRecommendationCard(routeRec) : ''}
      <div style="margin-top: 2rem;">
        ${SharedComponents.renderValueDistributionPanel(valueDist, 'manufacturer')}
      </div>
    `;
  }

  /* =========================================================================
     5. DISTRIBUTOR DASHBOARD (PRD Section 4.5 - Dual-Sided)
     ========================================================================= */
  static renderDistributorDashboard(tab, data, user) {
    const { browseListings = [], myListings = [], negotiations = [], orders = [], routeRec, discovery, valueDist } = data;

    if (tab === 'procurement') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🛒 Source Packaged SKUs from Manufacturers</h2>
            <p>Procure pallet-scale stock of finished food products.</p>
          </div>
        </div>
        ${this.renderBrowseListingsGrid(browseListings, user)}
      `;
    }

    if (tab === 'inventory') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🏬 Regional Warehouse & Fleet</h2>
            <p>Multi-drop logistics, cold storage, and inventory staging.</p>
          </div>
          <button class="glow-btn" onclick="AppController.openCreateListingModal('distributor')">
            + List Products for Retailers
          </button>
        </div>
        ${this.renderListingsTable(myListings, true)}
      `;
    }

    if (tab === 'negotiations') return this.renderNegotiationsList(negotiations, user);
    if (tab === 'orders') return this.renderOrdersSection(orders, user);
    if (tab === 'routes') return SharedComponents.renderRouteRecommendationCard(routeRec);
    if (tab === 'discovery') return SharedComponents.renderNearbyDiscovery(discovery, 'AppController.initiateDirectTrade');
    if (tab === 'transparency') return SharedComponents.renderValueDistributionPanel(valueDist, 'distributor');

    // Default overview
    return `
      <div class="content-header">
        <div class="content-title">
          <h2>🚚 Distribution Logistics — ${user.full_name}</h2>
          <p>Regional Hub: <strong>${user.location_address || 'Regional Distribution Hub'}</strong></p>
        </div>
        <button class="glow-btn" onclick="AppController.openCreateListingModal('distributor')">+ List Stock for Retailers</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-blue">🚚</div>
          <div class="stat-details">
            <span class="stat-label">Active Logistics Fleet</span>
            <span class="stat-val">12 Trucks</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-green">🏬</div>
          <div class="stat-details">
            <span class="stat-label">Retailer Offerings</span>
            <span class="stat-val">${myListings.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-gold">💬</div>
          <div class="stat-details">
            <span class="stat-label">Retailer Enquiries</span>
            <span class="stat-val">${negotiations.filter(n => n.status === 'open').length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-purple">⭐</div>
          <div class="stat-details">
            <span class="stat-label">Distributor Trust</span>
            <span class="stat-val">${user.trust_score?.star_rating || '4.0'}</span>
          </div>
        </div>
      </div>

      ${routeRec ? SharedComponents.renderRouteRecommendationCard(routeRec) : ''}
      <div style="margin-top: 2rem;">
        ${SharedComponents.renderValueDistributionPanel(valueDist, 'distributor')}
      </div>
    `;
  }

  /* =========================================================================
     6. FINAL RETAILER DASHBOARD (PRD Section 4.6 - Buy-Only)
     ========================================================================= */
  static renderRetailerDashboard(tab, data, user) {
    const { browseListings = [], negotiations = [], orders = [], discovery, valueDist } = data;

    if (tab === 'procurement') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>🛒 Procure Store Stock</h2>
            <p>Source packaged goods and fresh produce directly from regional distributors.</p>
          </div>
        </div>
        ${this.renderBrowseListingsGrid(browseListings, user)}
      `;
    }

    if (tab === 'negotiations') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>💬 Store Procurement Inquiries & Negotiations</h2>
            <p>Place orders or negotiate delivery schedules with distributors.</p>
          </div>
        </div>
        ${this.renderNegotiationsList(negotiations, user)}
      `;
    }

    if (tab === 'orders') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>📦 Store Orders & Escrow Confirmation</h2>
            <p>Track delivery stages and confirm receipt to release escrow.</p>
          </div>
        </div>
        ${this.renderOrdersSection(orders, user)}
      `;
    }

    if (tab === 'discovery') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>📍 Nearby Wholesale & Distribution Hubs</h2>
            <p>Suppliers servicing your retail pin code.</p>
          </div>
        </div>
        ${SharedComponents.renderNearbyDiscovery(discovery, 'AppController.initiateDirectTrade')}
      `;
    }

    if (tab === 'transparency') {
      return `
        <div class="content-header">
          <div class="content-title">
            <h2>⚖️ Transparency & Consumer Margins</h2>
            <p>Ensuring honest pricing for retailers and consumers alike.</p>
          </div>
        </div>
        ${SharedComponents.renderValueDistributionPanel(valueDist, 'final_retailer')}
      `;
    }

    // Default overview (NO "Create Listing" anywhere!)
    return `
      <div class="content-header">
        <div class="content-title">
          <h2>🛒 Retail Store Dashboard — ${user.full_name}</h2>
          <p>Store Location: <strong>${user.location_address || 'Local Market'}</strong> | Verified Retail Point</p>
        </div>
        <button class="glow-btn" onclick="AppController.switchTab('procurement')">
          🛒 Order Store Stock
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-blue">📦</div>
          <div class="stat-details">
            <span class="stat-label">Orders Placed</span>
            <span class="stat-val">${orders.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-gold">💬</div>
          <div class="stat-details">
            <span class="stat-label">Active Negotiations</span>
            <span class="stat-val">${negotiations.filter(n => n.status === 'open').length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-green">🚚</div>
          <div class="stat-details">
            <span class="stat-label">Pending Deliveries</span>
            <span class="stat-val">${orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-purple">⭐</div>
          <div class="stat-details">
            <span class="stat-label">Retailer Trust</span>
            <span class="stat-val">${user.trust_score?.star_rating || '4.0'}</span>
          </div>
        </div>
      </div>

      <!-- Quick Browse Distributor Inventory -->
      <div style="margin-top: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="color: #fff; font-size: 1.3rem;">Available Stock for Procurement</h3>
          <a href="#" onclick="AppController.switchTab('procurement')" style="color: var(--primary-light); font-size: 0.9rem;">Browse Catalog ➔</a>
        </div>
        ${this.renderBrowseListingsGrid(browseListings.slice(0, 3), user)}
      </div>

      <!-- ₹100 Value Distribution with Retailer Highlighted -->
      <div style="margin-top: 2rem;">
        ${SharedComponents.renderValueDistributionPanel(valueDist, 'final_retailer')}
      </div>
    `;
  }

  /* =========================================================================
     COMMON SUB-COMPONENT RENDERERS
     ========================================================================= */

  /**
   * Listings Table (Seller's view)
   */
  static renderListingsTable(listings = [], isOwner = false) {
    if (!listings || listings.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🌾</div>
          <p>No active listings found.</p>
        </div>
      `;
    }

    return `
      <div class="glass-panel" style="padding: 0.5rem 1.5rem 1.5rem; overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Commodity / Crop</th>
              <th>Variety</th>
              <th>Quantity</th>
              <th>Asking Price</th>
              <th>Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${listings.map(l => `
              <tr>
                <td style="font-weight: 700; color: #fff;">
                  ${l.commodity_type}
                  ${l.is_organic ? '<span class="badge badge-green" style="font-size: 0.65rem; margin-left: 0.4rem;">Organic</span>' : ''}
                </td>
                <td style="color: var(--text-muted);">${l.variety || 'Standard'}</td>
                <td style="font-weight: 600;">${l.quantity_quintals} Qtl</td>
                <td style="color: #34d399; font-weight: 700;">₹${l.target_price_inr}/Qtl</td>
                <td style="color: var(--text-dim); font-size: 0.85rem;">📍 ${l.location_address || 'Local Mandi'}</td>
                <td>
                  <span class="badge ${l.status === 'active' ? 'badge-green' : 'badge-gold'}">
                    ${l.status}
                  </span>
                </td>
                <td>
                  <button class="secondary-btn" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="AppController.viewListingOffers('${l.id}')">
                    Offers
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Browse Listings Grid (Buyer's procurement view)
   */
  static renderBrowseListingsGrid(listings = [], user, compact = false) {
    if (!listings || listings.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <p>No listings currently available from upstream suppliers in your network.</p>
        </div>
      `;
    }

    return `
      <div class="listings-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(${compact ? '260px' : '320px'}, 1fr)); gap: 1.25rem;">
        ${listings.map(l => {
          const isOwn = l.seller_id === user.id;
          return `
            <div class="listing-card glass-panel" style="padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                  <span class="badge badge-green">${l.commodity_type}</span>
                  <span style="font-size: 0.85rem; color: var(--text-dim);">📍 ${l.location_address || 'Local'}</span>
                </div>
                <h4 style="color: #fff; font-size: 1.2rem; margin-bottom: 0.25rem;">${l.variety || l.commodity_type}</h4>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                  Seller: <strong>${l.seller_name || 'Verified Producer'}</strong> 
                  ${l.seller_star_rating ? `<span class="nav-trust-badge" style="display: inline-flex; padding: 0.1rem 0.4rem; font-size: 0.7rem;">★ ${l.seller_star_rating}</span>` : ''}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
                  <div>
                    <span class="stat-label">Available</span>
                    <div style="font-weight: 700; color: #fff;">${l.quantity_quintals} Qtl</div>
                  </div>
                  <div style="text-align: right;">
                    <span class="stat-label">Asking Price</span>
                    <div style="font-size: 1.25rem; font-weight: 800; color: #34d399;">₹${l.target_price_inr}<span style="font-size: 0.75rem; color: var(--text-muted);">/qtl</span></div>
                  </div>
                </div>
              </div>

              <div>
                ${isOwn ? `
                  <button class="secondary-btn" style="width: 100%;" disabled>Your Own Listing</button>
                ` : `
                  <div style="display: flex; gap: 0.5rem;">
                    <button class="secondary-btn" style="flex: 1; padding: 0.6rem; font-size: 0.85rem;" onclick="AppController.openNegotiateModal('${l.id}', '${l.seller_id}', '${l.commodity_type}', ${l.target_price_inr}, ${l.quantity_quintals})">
                      🤝 Negotiate
                    </button>
                    <button class="glow-btn" style="flex: 1; padding: 0.6rem; font-size: 0.85rem;" onclick="AppController.openDirectOrderModal('${l.id}', '${l.seller_id}', '${l.commodity_type}', ${l.target_price_inr}, ${l.quantity_quintals})">
                      ⚡ Buy Now
                    </button>
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Stock Pools Section (Aggregator)
   */
  static renderStockPoolsSection(pools = []) {
    if (!pools || pools.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <p>No stock pools created yet. Aggregate multiple farmer batches to unlock volume buyers.</p>
        </div>
      `;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem;">
        ${pools.map(p => `
          <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span class="badge badge-gold">${p.commodity_type}</span>
              <span class="badge ${p.status === 'open' ? 'badge-green' : 'badge-blue'}">${p.status}</span>
            </div>
            <h4 style="color: #fff; font-size: 1.25rem; margin-bottom: 0.4rem;">${p.pool_name}</h4>
            <div style="display: flex; justify-content: space-between; margin: 0.75rem 0; font-size: 0.9rem;">
              <span style="color: var(--text-muted);">Aggregated Volume:</span>
              <span style="font-weight: 700; color: #fff;">${p.total_quantity_quintals} Quintals</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.9rem;">
              <span style="color: var(--text-muted);">Target Asking Price:</span>
              <span style="font-weight: 700; color: #34d399;">₹${p.target_price_inr}/Qtl</span>
            </div>
            <button class="glow-btn" style="width: 100%; font-size: 0.85rem;" onclick="AppController.listPoolForSale('${p.id}', '${p.pool_name}', '${p.commodity_type}', ${p.total_quantity_quintals}, ${p.target_price_inr})">
              🌾 Offer Lot to Wholesalers
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Negotiations List
   */
  static renderNegotiationsList(negotiations = [], user) {
    if (!negotiations || negotiations.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>No active negotiations or counter-offers.</p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${negotiations.map(n => {
          const isBuyer = n.buyer_id === user.id;
          const counterpartyName = isBuyer ? n.seller_name : n.buyer_name;
          const counterpartyRole = isBuyer ? n.seller_role : n.buyer_role;
          const latestOffer = n.latest_offer || {};

          return `
            <div class="glass-panel" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem;">
                  <span class="badge ${n.status === 'open' ? 'badge-green' : 'badge-gold'}">${n.status.toUpperCase()}</span>
                  <span style="font-size: 0.85rem; color: var(--text-dim);">Negotiation #${n.id.slice(0, 8)}</span>
                </div>
                <h4 style="color: #fff; font-size: 1.2rem;">
                  ${n.commodity_type || 'Commodity Deal'} 
                  <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: normal;">with ${counterpartyName || 'Counterparty'} (${counterpartyRole || 'Partner'})</span>
                </h4>
                <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem; font-size: 0.9rem;">
                  <div>Latest Terms: <strong style="color: #fff;">${latestOffer.quantity_quintals || n.initial_quantity} Qtl</strong></div>
                  <div>Offered Price: <strong style="color: #34d399;">₹${latestOffer.unit_price_inr || n.initial_price}/Qtl</strong></div>
                  <div>Payment: <strong style="color: #fbbf24; text-transform: uppercase;">${latestOffer.payment_method || 'ESCROW'}</strong></div>
                </div>
              </div>

              <div>
                <button class="glow-btn" onclick="AppController.openNegotiationThread('${n.id}')">
                  Open Negotiation Room ➔
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Orders Section & Tracking
   */
  static renderOrdersSection(orders = [], user) {
    if (!orders || orders.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <p>No orders currently on record.</p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 1.75rem;">
        ${orders.map(order => `
          <div>
            ${SharedComponents.renderOrderStatusBar(order, order.history || [], user.role)}
            
            <div class="glass-panel" style="margin-top: -1.25rem; border-top: none; border-top-left-radius: 0; border-top-right-radius: 0; padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
              <div style="display: flex; gap: 2rem;">
                <div>Commodity: <strong style="color: #fff;">${order.commodity_type || 'Grain'} (${order.quantity_quintals} Qtl)</strong></div>
                <div>Total Amount: <strong style="color: #34d399;">₹${Number(order.total_amount_inr || 0).toLocaleString()}</strong></div>
                <div>Payment: <span class="badge ${order.payment_method === 'cash' ? 'badge-gold' : 'badge-blue'}">${(order.payment_method || 'ESCROW').toUpperCase()}</span></div>
                <div>Payment State: <strong style="color: #fff; text-transform: capitalize;">${order.payment_status || 'funded'}</strong></div>
              </div>

              <div style="display: flex; gap: 0.5rem;">
                <button class="secondary-btn" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;" onclick="AppController.openPaymentDetailsModal('${order.id}')">
                  💳 Payment / Escrow Details
                </button>
                ${order.status === 'delivered' ? `
                  <button class="glow-btn" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;" onclick="AppController.openReviewModal('${order.id}', '${order.seller_id === user.id ? order.buyer_id : order.seller_id}')">
                    ⭐ Rate Partner
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

window.DashboardViews = DashboardViews;
