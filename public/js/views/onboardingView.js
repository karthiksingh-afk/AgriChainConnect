// public/js/views/onboardingView.js

class OnboardingView {
  static render() {
    const step = AppState.onboardingStep;
    const t = I18nService.t.bind(I18nService);

    return `
      <div class="onboarding-container">
        <!-- Step Progress Indicator -->
        <div class="step-indicator">
          <div class="step-dot ${step === 1 ? 'active' : ''}">
            <div class="step-circle">1</div>
            <span>Language</span>
          </div>
          <div class="step-line"></div>
          <div class="step-dot ${step === 2 ? 'active' : ''}">
            <div class="step-circle">2</div>
            <span>Role</span>
          </div>
          <div class="step-line"></div>
          <div class="step-dot ${step === 3 ? 'active' : ''}">
            <div class="step-circle">3</div>
            <span>Access</span>
          </div>
        </div>

        ${step === 1 ? this.renderStep1Language(t) : ''}
        ${step === 2 ? this.renderStep2Role(t) : ''}
        ${step === 3 ? this.renderStep3Auth(t) : ''}
      </div>
    `;
  }

  /**
   * Step 1: Language Selection (PRD Section 11.1)
   * 4 Large Buttons: English, Hindi, Punjabi, Marathi
   */
  static renderStep1Language(t) {
    return `
      <div class="onboarding-header">
        <h1>🌾 ${t('app_title')}</h1>
        <p>${t('step1_subtitle')}</p>
      </div>

      <div class="language-grid">
        <div class="lang-btn" onclick="AppController.selectLanguage('en')">
          <div class="lang-native">English</div>
          <div class="lang-latin">English (UK/Global)</div>
          <span class="badge badge-blue">Standard</span>
        </div>

        <div class="lang-btn" onclick="AppController.selectLanguage('hi')">
          <div class="lang-native">हिंदी</div>
          <div class="lang-latin">Hindi</div>
          <span class="badge badge-green">राष्ट्रभाषा</span>
        </div>

        <div class="lang-btn" onclick="AppController.selectLanguage('pa')">
          <div class="lang-native">ਪੰਜਾਬੀ</div>
          <div class="lang-latin">Punjabi</div>
          <span class="badge badge-gold">ਪੰਜਾਬ ਖੇਤਰ</span>
        </div>

        <div class="lang-btn" onclick="AppController.selectLanguage('mr')">
          <div class="lang-native">मराठी</div>
          <div class="lang-latin">Marathi</div>
          <span class="badge badge-gold">महाराष्ट्र विभाग</span>
        </div>
      </div>
    `;
  }

  /**
   * Step 2: Supply Chain Role Selection (PRD Section 11.2)
   * 6 Distinct Role Cards
   */
  static renderStep2Role(t) {
    const roles = [
      {
        id: 'farmer',
        icon: '👨‍🌾',
        title: t('roles.farmer'),
        tag: 'Sell-Only',
        tagClass: 'tag-sell-only',
        desc: 'Cultivation, harvesting, sorting. Never buys on platform; focuses on crop sales and getting paid on time.',
        margin: 'Margin: Low–Moderate (Needs Direct Upstream Access)'
      },
      {
        id: 'local_aggregator',
        icon: '📦',
        title: t('roles.local_aggregator'),
        tag: 'Buy + Sell',
        tagClass: 'tag-dual',
        desc: 'Procures from nearby farmers, pools stock into batches, and sells onward to wholesalers or processors.',
        margin: 'Margin: Volume-Driven, Transport & Cash Advance'
      },
      {
        id: 'wholesaler',
        icon: '🏢',
        title: t('roles.wholesaler'),
        tag: 'Buy + Sell',
        tagClass: 'tag-dual',
        desc: 'Regional bulk storage, grain warehouse operations, price risk management, and distribution sales.',
        margin: 'Margin: Moderate, Market Speculation'
      },
      {
        id: 'manufacturer',
        icon: '⚙️',
        title: t('roles.manufacturer'),
        tag: 'Buy + Sell',
        tagClass: 'tag-dual',
        desc: 'Sourcing raw crops, processing/milling, packaging, quality control, and branded finished goods creation.',
        margin: 'Margin: High, Value-Added Processing'
      },
      {
        id: 'distributor',
        icon: '🚚',
        title: t('roles.distributor'),
        tag: 'Buy + Sell',
        tagClass: 'tag-dual',
        desc: 'Bulk packaged goods procurement from manufacturers, regional warehousing, and multi-drop delivery to retailers.',
        margin: 'Margin: Low–Moderate, Logistics Scale'
      },
      {
        id: 'final_retailer',
        icon: '🛒',
        title: t('roles.final_retailer'),
        tag: 'Buy-Only',
        tagClass: 'tag-buy-only',
        desc: 'Procures inventory from distributors for final consumer stores. Pure buyer within platform scope.',
        margin: 'Margin: Moderate–High, Consumer Convenience'
      }
    ];

    return `
      <div class="onboarding-header">
        <h1>${t('step2_title')}</h1>
        <p>${t('step2_subtitle')}</p>
      </div>

      <div class="role-grid">
        ${roles.map(r => `
          <div class="role-card" onclick="AppController.selectRole('${r.id}')">
            <span class="role-icon">${r.icon}</span>
            <span class="role-tag ${r.tagClass}">${r.tag}</span>
            <div class="role-title">${r.title}</div>
            <div class="role-desc">${r.desc}</div>
            <div class="role-margin">${r.margin}</div>
          </div>
        `).join('')}
      </div>

      <div style="text-align: center; margin-top: 2rem;">
        <button class="secondary-btn" onclick="AppState.setOnboardingStep(1)">
          ← Back to Language Selection
        </button>
      </div>
    `;
  }

  /**
   * Step 3: Login / Registration (PRD Section 11.3)
   */
  static renderStep3Auth(t) {
    const roleId = AppState.selectedRole || 'farmer';
    const roleTitle = t(`roles.${roleId}`);

    return `
      <div class="onboarding-header">
        <h1>${t('step3_title')}</h1>
        <p>${t('step3_subtitle')}</p>
      </div>

      <div class="auth-box">
        <div class="auth-tabs">
          <div class="auth-tab active" id="tab-login" onclick="AppController.switchAuthTab('login')">
            ${t('login_tab')}
          </div>
          <div class="auth-tab" id="tab-register" onclick="AppController.switchAuthTab('register')">
            ${t('register_tab')}
          </div>
        </div>

        <!-- Login Form -->
        <form id="form-login" onsubmit="AppController.handleLogin(event)">
          <div class="form-group">
            <label>${t('username')}</label>
            <input type="text" id="login-username" class="form-input" placeholder="e.g. farmer_ramesh" required autocomplete="username" />
          </div>

          <div class="form-group">
            <label>${t('password')}</label>
            <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password" />
          </div>

          <button type="submit" class="glow-btn" style="width: 100%; padding: 0.9rem; margin-top: 0.5rem;" id="login-submit-btn">
            ${t('submit_login')} ➔
          </button>
        </form>

        <!-- Register Form -->
        <form id="form-register" style="display: none;" onsubmit="AppController.handleRegister(event)">
          <div class="role-badge-display">
            <span>Role: <strong>${roleTitle}</strong></span>
            <button type="button" class="secondary-btn" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;" onclick="AppState.setOnboardingStep(2)">
              ${t('change_role')}
            </button>
          </div>

          <div class="form-group">
            <label>${t('full_name')}</label>
            <input type="text" id="reg-name" class="form-input" placeholder="e.g. Ramesh Patel" required />
          </div>

          <div class="form-group">
            <label>${t('username')} (Unique Identifier)</label>
            <input type="text" id="reg-username" class="form-input" placeholder="e.g. ramesh_sonipat" required />
          </div>

          <div class="form-group">
            <label>${t('password')} (Securely Hashed)</label>
            <input type="password" id="reg-password" class="form-input" placeholder="At least 6 characters" required />
          </div>

          <div class="form-group">
            <label>${t('mobile_number')}</label>
            <input type="tel" id="reg-mobile" class="form-input" placeholder="+91 98765 43210" required />
          </div>

          <div class="form-group">
            <label>Location (Mandi / District)</label>
            <input type="text" id="reg-location" class="form-input" placeholder="e.g. Sonipat, Haryana" />
          </div>

          <button type="submit" class="glow-btn" style="width: 100%; padding: 0.9rem; margin-top: 0.5rem;" id="register-submit-btn">
            ${t('submit_register')} ➔
          </button>
        </form>
      </div>

      <div style="text-align: center; margin-top: 1.5rem;">
        <button class="secondary-btn" onclick="AppState.setOnboardingStep(2)">
          ← Back to Role Selection
        </button>
      </div>
    `;
  }
}

window.OnboardingView = OnboardingView;
