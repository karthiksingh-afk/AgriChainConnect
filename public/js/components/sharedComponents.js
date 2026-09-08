// public/js/components/sharedComponents.js

class SharedComponents {
  /**
   * Top Navbar with Role Pill, Language Switcher, and Trust Score Badge
   */
  static renderNavbar(user) {
    const t = I18nService.t.bind(I18nService);
    const roleKey = user ? user.role : 'farmer';
    const roleLabel = t(`roles.${roleKey}`);

    const score = user?.trust_score?.aggregate_score || 80.0;
    const stars = user?.trust_score?.star_rating || 4.0;
    const isHighRisk = user?.trust_score?.is_high_risk;

    return `
      <header class="top-navbar">
        <a href="#" class="nav-brand" onclick="AppState.setActiveTab('overview')">
          <span class="brand-icon">🌾</span>
          <span class="brand-title">AgriChain<span>Connect</span></span>
        </a>

        <div class="nav-center">
          <div class="role-pill pill-${roleKey}">
            <span>●</span> ${roleLabel}
          </div>
        </div>

        <div class="nav-right">
          <!-- Language Switcher (Section 7) -->
          <select class="lang-select" id="navbar-lang-select" onchange="AppController.handleLanguageChange(this.value)">
            <option value="en" ${I18nService.currentLang === 'en' ? 'selected' : ''}>🇬🇧 English</option>
            <option value="hi" ${I18nService.currentLang === 'hi' ? 'selected' : ''}>🇮🇳 हिंदी</option>
            <option value="pa" ${I18nService.currentLang === 'pa' ? 'selected' : ''}>🇮🇳 ਪੰਜਾਬੀ</option>
            <option value="mr" ${I18nService.currentLang === 'mr' ? 'selected' : ''}>🇮🇳 मराठी</option>
          </select>

          <!-- Trust Score Badge (Section 9.3) -->
          <div class="nav-trust-badge" onclick="SharedComponents.openTrustScoreModal('${user.id}')" title="Click to view detailed Trust Score & 4 Pillars">
            <span class="star-icon">★</span>
            <span class="score-val">${stars} (${score})</span>
            ${isHighRisk ? '<span class="badge badge-red" style="font-size:0.65rem; padding:0.1rem 0.4rem;">High Risk</span>' : ''}
          </div>

          <!-- User Profile & Logout -->
          <button class="secondary-btn" style="padding: 0.45rem 0.9rem; font-size: 0.85rem;" onclick="AppController.handleLogout()">
            ${t('logout')}
          </button>
        </div>
      </header>
    `;
  }

  /**
   * Order Status Tracking Bar (PRD Section 12)
   * 6 Stages: Order Placed -> Confirmed -> Packed -> Shipped -> Out for Delivery -> Delivered
   */
  static renderOrderStatusBar(order, history = [], currentUserRole) {
    const stages = [
      { id: 'order_placed', label: 'Order Placed', icon: '📝' },
      { id: 'confirmed', label: 'Confirmed', icon: '✅' },
      { id: 'packed', label: 'Packed', icon: '📦' },
      { id: 'shipped', label: 'Shipped', icon: '🚚' },
      { id: 'out_for_delivery', label: 'Out for Delivery', icon: '📍' },
      { id: 'delivered', label: 'Delivered', icon: '🎉' },
    ];

    const currentIdx = stages.findIndex(s => s.id === order.status);
    const progressPercent = currentIdx >= 0 ? (currentIdx / (stages.length - 1)) * 100 : 0;

    const historyMap = {};
    history.forEach(h => {
      historyMap[h.status] = new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    });

    // Action buttons based on current state and user authorization
    let actionsHtml = '';
    const isSeller = order.seller_id === AppState.currentUser?.id;
    const isBuyer = order.buyer_id === AppState.currentUser?.id;

    if (isSeller) {
      if (order.status === 'confirmed') {
        actionsHtml = `<button class="glow-btn" onclick="AppController.updateOrderStatus('${order.id}', 'packed')">📦 Mark Packed</button>`;
      } else if (order.status === 'packed') {
        actionsHtml = `<button class="glow-btn" onclick="AppController.updateOrderStatus('${order.id}', 'shipped')">🚚 Dispatch & Ship</button>`;
      } else if (order.status === 'shipped') {
        actionsHtml = `<button class="glow-btn" onclick="AppController.updateOrderStatus('${order.id}', 'out_for_delivery')">📍 Mark Out for Delivery</button>`;
      }
    }

    if (isBuyer) {
      if (order.status === 'out_for_delivery' || order.status === 'shipped') {
        actionsHtml = `<button class="glow-btn" style="background: linear-gradient(135deg, #10b981 0%, #047857 100%);" onclick="AppController.updateOrderStatus('${order.id}', 'delivered')">🎉 Confirm Delivery & Release Escrow</button>`;
      }
    }

    return `
      <div class="status-tracker-card glass-panel">
        <div class="tracker-header">
          <div>
            <span class="stat-label">Order #${order.id.slice(0, 8)}</span>
            <h3 style="color: #fff; margin-top: 0.2rem;">Tracking Status: <span style="color: var(--accent-gold); text-transform: capitalize;">${order.status.replace(/_/g, ' ')}</span></h3>
          </div>
          <div style="text-align: right;">
            <span class="stat-label">Est. Delivery</span>
            <div style="font-weight: 700; color: #fff;">${order.estimated_delivery_date ? new Date(order.estimated_delivery_date).toLocaleDateString() : '3-5 Days'}</div>
          </div>
        </div>

        <div class="tracker-steps">
          <div class="tracker-line">
            <div class="tracker-line-progress" style="width: ${progressPercent}%;"></div>
          </div>

          ${stages.map((stage, idx) => {
            let stateClass = '';
            if (idx < currentIdx) stateClass = 'completed';
            else if (idx === currentIdx) stateClass = 'current';

            return `
              <div class="step-node ${stateClass}">
                <div class="node-circle">
                  ${idx < currentIdx ? '✓' : stage.icon}
                </div>
                <div class="node-title">${stage.label}</div>
                <div class="node-time">${historyMap[stage.id] || ''}</div>
              </div>
            `;
          }).join('')}
        </div>

        ${actionsHtml ? `<div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem;">${actionsHtml}</div>` : ''}
      </div>
    `;
  }

  /**
   * AI Route Recommendation Card (PRD Section 8)
   * Displays visual chain with skipped nodes struck through and profitability comparison
   */
  static renderRouteRecommendationCard(rec) {
    if (!rec) return '';

    const formatTier = (tier) => {
      const map = {
        farmer: '🌾 Farmer',
        local_aggregator: '📦 Local Aggregator',
        wholesaler: '🏢 Wholesaler',
        manufacturer: '⚙️ Processor/Mfg',
        distributor: '🚚 Distributor',
        final_retailer: '🛒 Final Retailer'
      };
      return map[tier] || tier;
    };

    const isBypass = rec.is_bypass_recommended;
    const profit = rec.net_profitability_analysis || {};

    return `
      <div class="route-card glass-panel">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <div class="badge ${isBypass ? 'badge-gold' : 'badge-green'}">
              ${isBypass ? '⚡ AI Skip-Node Bypass Activated' : '✓ Standard Optimized Path'}
            </div>
            <h3 style="font-size: 1.5rem; color: #fff; margin-top: 0.5rem;">AI Route Optimization & Profitability</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Dynamically evaluating availability, trust scores (≥80), and fair market pricing (≥-5% variance).
            </p>
          </div>
          <div style="text-align: right;">
            <span class="stat-label">Live Mandi Index</span>
            <div style="font-size: 1.4rem; font-weight: 800; color: #34d399;">₹${rec.live_market_price || 2250}/qtl</div>
          </div>
        </div>

        <!-- Visual Route Chain -->
        <div class="route-chain-visual">
          ${rec.optimized_route.map((node, index) => {
            if (node.status === 'source') {
              return `
                <div class="route-node-pill">
                  ${formatTier(node.tier)}
                </div>
                <span style="color: var(--text-dim); font-size: 1.2rem;">⟶</span>
              `;
            } else if (node.status === 'skipped') {
              return `
                <div class="route-node-pill skipped" onclick="alert('Justification for bypassing ${node.tier}:\\n\\n${node.reason}')" title="Click to view skip reason">
                  ${formatTier(node.tier)} <span style="font-size: 0.75rem; color: #f87171;">(Bypassed ✕)</span>
                </div>
                <span style="color: var(--text-dim); font-size: 1.2rem;">⟶</span>
              `;
            } else if (node.status === 'recommended_destination') {
              return `
                <div class="route-node-pill recommended">
                  ${formatTier(node.tier)} <span style="font-size: 0.75rem;">★ Recommended Buyer</span>
                </div>
              `;
            }
            return '';
          }).join('')}
        </div>

        <!-- Skipped Nodes Justification Details -->
        ${rec.skipped_nodes && rec.skipped_nodes.length > 0 ? `
          <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 0.85rem 1.2rem; border-radius: 4px; margin-bottom: 1.5rem; font-size: 0.9rem;">
            <strong style="color: #fca5a5;">Bypass Protocol Reasoning:</strong>
            <ul style="margin: 0.4rem 0 0 1.2rem; color: var(--text-muted);">
              ${rec.skipped_nodes.map(sn => `<li><strong>${formatTier(sn.tier)}:</strong> ${sn.reason}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Net Profitability Comparison Table -->
        <div style="background: rgba(0, 0, 0, 0.25); border-radius: var(--radius-sm); padding: 1.25rem;">
          <h4 style="color: #fff; font-size: 1rem; margin-bottom: 0.75rem;">📊 Net Profitability Analysis (Direct Bypass vs Standard Tier)</h4>
          <table class="profit-comparison-table">
            <thead>
              <tr>
                <th>Route Option</th>
                <th>Destination</th>
                <th>Unit Price</th>
                <th>Gross Return</th>
                <th>Transport Cost</th>
                <th>Net Return</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="color: var(--text-muted);">Standard Intermediate Route</td>
                <td>${formatTier(profit.standard_route?.destination_tier)}</td>
                <td>₹${profit.standard_route?.unit_price}/qtl</td>
                <td>₹${profit.standard_route?.gross_return?.toLocaleString()}</td>
                <td>-₹${profit.standard_route?.transport_cost?.toLocaleString()}</td>
                <td style="font-weight: 700; color: #fff;">₹${profit.standard_route?.net_return?.toLocaleString()}</td>
              </tr>
              <tr style="background: rgba(16, 185, 129, 0.08);">
                <td style="color: #34d399; font-weight: 700;">🚀 Recommended Direct Route</td>
                <td style="color: #fff; font-weight: 600;">${formatTier(profit.optimized_route?.destination_tier)}</td>
                <td style="color: #34d399; font-weight: 700;">₹${profit.optimized_route?.unit_price}/qtl</td>
                <td>₹${profit.optimized_route?.gross_return?.toLocaleString()}</td>
                <td>-₹${profit.optimized_route?.transport_cost?.toLocaleString()}</td>
                <td style="font-weight: 800; color: #34d399; font-size: 1.1rem;">₹${profit.optimized_route?.net_return?.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border-glass);">
            <div style="font-size: 0.85rem; color: var(--text-dim);">
              Transport delta: +₹${profit.optimized_route?.transport_cost_delta || 0} (Fully absorbed by direct price realization)
            </div>
            <div class="profit-gain-highlight">
              Net Gain: +₹${profit.net_gain_amount?.toLocaleString() || 0} (+${profit.net_gain_percentage || 0}%)
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ₹100 Value Distribution Transparency Panel (PRD Section 6)
   * Exact breakdown seeded with PRD Section 6.2 with viewer role highlighted
   */
  static renderValueDistributionPanel(distributions, viewerRole) {
    if (!distributions || distributions.length === 0) return '';
    const dist = distributions[0]; // Active or selected category

    const tierColorMap = {
      farmer: '#10b981',
      local_aggregator: '#f59e0b',
      wholesaler: '#0ea5e9',
      manufacturer: '#a855f7',
      distributor: '#ec4899',
      final_retailer: '#3b82f6'
    };

    return `
      <div class="glass-panel" style="padding: 2rem; margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="badge badge-green">Transparency Commitment</div>
            <h3 style="font-size: 1.5rem; color: #fff; margin-top: 0.4rem;">₹100 Consumer Value Distribution</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Standardized across all six roles to ensure price transparency and eliminate hidden intermediary extraction.
            </p>
          </div>
          <span style="font-size: 2rem;">🌾 ➔ 🛒</span>
        </div>

        <!-- Single Continuous Stacked Bar -->
        <div class="transparency-bar">
          ${dist.tiers.map(t => `
            <div class="segment-${t.tier.replace(/local_|_/g, '')}" style="width: ${t.share_inr}%; background: ${tierColorMap[t.tier] || '#fff'};" title="${t.role_name}: ₹${t.share_inr}"></div>
          `).join('')}
        </div>

        <!-- Tier Grid Cards with Active User Highlighting -->
        <div class="tier-legend-grid">
          ${dist.tiers.map(t => {
            const isUser = t.tier === viewerRole;
            return `
              <div class="tier-legend-item ${isUser ? 'highlighted' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <span style="font-size: 0.8rem; font-weight: 700; color: ${tierColorMap[t.tier]}; text-transform: uppercase;">
                    ${t.role_name}
                  </span>
                  ${isUser ? '<span class="badge badge-green" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">You</span>' : ''}
                </div>
                <div style="font-size: 1.75rem; font-weight: 800; font-family: 'Outfit'; color: #fff;">
                  ₹${t.share_inr}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.25rem;">
                  ${t.drivers}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Adaptive Nearby Member Discovery Component (PRD Section 10)
   */
  static renderNearbyDiscovery(discoveryData, onConnectCallbackName = 'AppController.openNegotiateModal') {
    if (!discoveryData) return '';

    const isExpanded = discoveryData.expanded;

    return `
      <div class="glass-panel" style="padding: 2rem; margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <div>
            <h3 style="color: #fff; font-size: 1.4rem;">📍 Adaptive Nearby Member Discovery</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem;">
              Connecting verified upstream producers and downstream buyers with automatic radius expansion.
            </p>
          </div>
          <span class="badge ${isExpanded ? 'badge-blue' : 'badge-green'}">
            Search Radius: ${discoveryData.search_radius_km} km
          </span>
        </div>

        ${isExpanded ? `
          <div class="radius-expansion-alert">
            <span>ℹ️</span>
            <span><strong>Smart Radius Expanded:</strong> Showing results up to ${discoveryData.search_radius_km} km — no closer matches found in local radius.</span>
          </div>
        ` : ''}

        <div class="nearby-member-grid">
          ${discoveryData.members && discoveryData.members.length > 0 ? discoveryData.members.map(m => `
            <div class="member-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div>
                  <h4 style="color: #fff; font-size: 1.1rem;">${m.name}</h4>
                  <span class="role-tag tag-dual" style="font-size: 0.7rem;">${m.role.replace(/_/g, ' ')}</span>
                </div>
                <div class="nav-trust-badge" style="padding: 0.2rem 0.6rem;">
                  ★ ${m.star_rating}
                </div>
              </div>

              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
                <div>📍 ${m.location_address || 'Verified Hub'}</div>
                <div style="font-weight: 600; color: #38bdf8; margin-top: 0.2rem;">🚗 ~${m.distance_km} km away</div>
              </div>

              <button class="glow-btn" style="width: 100%; padding: 0.6rem; font-size: 0.85rem;" onclick="${onConnectCallbackName}('${m.id}', '${m.name}')">
                🤝 Initiate Direct Trade
              </button>
            </div>
          `).join('') : `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-dim);">
              No active members found in this radius.
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Opens Trust Score Modal with 4 Pillars (PRD Section 9)
   */
  static async openTrustScoreModal(userId) {
    try {
      const isOwner = userId === AppState.currentUser?.id;
      let scoreData = null;

      if (isOwner) {
        const res = await ApiService.getMyTrustScore();
        scoreData = res;
      } else {
        const res = await ApiService.getUserTrustScore(userId);
        scoreData = { trust_score: res };
      }

      const ts = scoreData.trust_score || {};
      const pillars = scoreData.pillars || {};

      const modalHtml = `
        <div class="modal-overlay" id="trust-modal" onclick="if(event.target === this) this.remove()">
          <div class="modal-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <h3 style="font-size: 1.5rem; color: #fff;">🏆 Trust Score & Reputation Profile</h3>
              <button class="secondary-btn" style="padding: 0.3rem 0.6rem;" onclick="document.getElementById('trust-modal').remove()">✕</button>
            </div>

            <div style="display: flex; align-items: center; gap: 1.5rem; background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
              <div style="font-size: 3.5rem; font-weight: 800; font-family: 'Outfit'; color: #f59e0b; line-height: 1;">
                ${ts.star_rating || 4.0} <span style="font-size: 1.5rem; color: var(--text-dim);">/ 5.0</span>
              </div>
              <div>
                <div style="font-size: 1.25rem; font-weight: 700; color: #fff;">Score: ${ts.aggregate_score || 80}/100</div>
                <div style="color: var(--text-muted); font-size: 0.85rem;">Total Transactions: ${ts.total_transactions || 0}</div>
                ${ts.is_high_risk ? '<span class="badge badge-red" style="margin-top: 0.4rem;">High Risk (&lt;80)</span>' : '<span class="badge badge-green" style="margin-top: 0.4rem;">Verified Active Member</span>'}
              </div>
            </div>

            <!-- Four Pillars (Section 9.2) -->
            ${isOwner && pillars.payment_reliability ? `
              <h4 style="color: #fff; font-size: 1rem; margin-bottom: 0.75rem;">Four Core Pillars Breakdown:</h4>
              <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
                <div style="background: rgba(255,255,255,0.03); padding: 0.85rem; border-radius: var(--radius-sm);">
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600;">
                    <span>1. Payment Reliability & Speed (35%)</span>
                    <span style="color: #34d399;">${pillars.payment_reliability.score}/100</span>
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.2rem;">${pillars.payment_reliability.description}</div>
                </div>

                <div style="background: rgba(255,255,255,0.03); padding: 0.85rem; border-radius: var(--radius-sm);">
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600;">
                    <span>2. Order Fulfillment & Rejection Rate (25%)</span>
                    <span style="color: #38bdf8;">${pillars.order_fulfillment.score}/100</span>
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.2rem;">${pillars.order_fulfillment.description}</div>
                </div>

                <div style="background: rgba(255,255,255,0.03); padding: 0.85rem; border-radius: var(--radius-sm);">
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600;">
                    <span>3. Operational Punctuality (20%)</span>
                    <span style="color: #fbbf24;">${pillars.operational_punctuality.score}/100</span>
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.2rem;">${pillars.operational_punctuality.description}</div>
                </div>

                <div style="background: rgba(255,255,255,0.03); padding: 0.85rem; border-radius: var(--radius-sm);">
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600;">
                    <span>4. Community Peer Reviews (20%)</span>
                    <span style="color: #c084fc;">${pillars.community_reviews.score}/100</span>
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.2rem;">${pillars.community_reviews.description}</div>
                </div>
              </div>
            ` : `
              <p style="color: var(--text-dim); font-size: 0.85rem;">
                Per PRD Section 9.3, granular pillar score history is private to the account owner. Counterparties see the aggregate score and star rating.
              </p>
            `}

            <button class="glow-btn" style="width: 100%;" onclick="document.getElementById('trust-modal').remove()">
              Close Reputation Profile
            </button>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (e) {
      AppState.showToast('Failed to load Trust Score details: ' + e.message, 'error');
    }
  }
}

window.SharedComponents = SharedComponents;
