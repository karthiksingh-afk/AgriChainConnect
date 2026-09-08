// public/js/state.js

class AppState {
  static currentUser = null;
  static currentView = 'onboarding'; // 'onboarding' | 'dashboard'
  static onboardingStep = 1; // 1: Language, 2: Role, 3: Login/Register
  static selectedLanguage = localStorage.getItem('agrichain_lang') || 'en';
  static selectedRole = null; // temporary during onboarding registration only
  static activeTab = 'overview';
  static pollingInterval = null;

  static listeners = [];

  static subscribe(fn) {
    this.listeners.push(fn);
  }

  static notify(event, data) {
    this.listeners.forEach(fn => fn(event, data));
  }

  static setCurrentUser(user) {
    this.currentUser = user;
    if (user && user.preferred_language) {
      this.selectedLanguage = user.preferred_language;
      I18nService.setLang(user.preferred_language);
    }
    this.notify('user_change', user);
  }

  static setView(view) {
    this.currentView = view;
    this.notify('view_change', view);
  }

  static setOnboardingStep(step) {
    this.onboardingStep = step;
    this.notify('step_change', step);
  }

  static setActiveTab(tab) {
    this.activeTab = tab;
    this.notify('tab_change', tab);
  }

  static showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

window.AppState = AppState;
