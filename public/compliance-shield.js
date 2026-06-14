(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    badgeUrl: 'https://accessibility-ai-pro.lovable.app/badge',
    position: 'bottom-right',
    color: '#6E56CF',
    size: 'medium'
  };

  // Get configuration from data attributes
  function getConfig(element) {
    const config = { ...CONFIG };
    if (element.dataset.position) config.position = element.dataset.position;
    if (element.dataset.color) config.color = element.dataset.color;
    if (element.dataset.size) config.size = element.dataset.size;
    if (element.dataset.auditId) config.auditId = element.dataset.auditId;
    return config;
  }

  // Create badge element
  function createBadge(config) {
    const badge = document.createElement('div');
    badge.id = 'accessaudit-shield';
    badge.style.cssText = `
      position: fixed;
      ${config.position === 'bottom-right' ? 'bottom: 20px; right: 20px;' : ''}
      ${config.position === 'bottom-left' ? 'bottom: 20px; left: 20px;' : ''}
      ${config.position === 'top-right' ? 'top: 20px; right: 20px;' : ''}
      ${config.position === 'top-left' ? 'top: 20px; left: 20px;' : ''}
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: white;
      border: 2px solid ${config.color};
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    badge.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${config.color}" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <div>
        <div style="font-size: 12px; color: #666; font-weight: 500;">WCAG 2.1 AA</div>
        <div style="font-size: 14px; color: #333; font-weight: 600;">Compliant</div>
      </div>
    `;

    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'scale(1.05)';
      badge.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
    });

    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'scale(1)';
      badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });

    badge.addEventListener('click', () => {
      if (config.auditId) {
        window.open(`${CONFIG.badgeUrl}/${config.auditId}`, '_blank');
      }
    });

    return badge;
  }

  // Initialize badge
  function init() {
    const existingBadge = document.getElementById('accessaudit-shield');
    if (existingBadge) {
      existingBadge.remove();
    }

    const script = document.querySelector('script[data-audit-id]');
    if (script) {
      const config = getConfig(script);
      const badge = createBadge(config);
      document.body.appendChild(badge);
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
