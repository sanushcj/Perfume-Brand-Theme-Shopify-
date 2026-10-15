// ============================================================
// LUMIÈRE NOIR – Theme JavaScript
// Premium Perfume Shopify Theme
// ============================================================

(function () {
  'use strict';

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function formatMoney(cents) {
    const amount = (cents / 100).toFixed(2);
    return `$${amount}`;
  }

  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ============================================================
  // NAVIGATION – Scroll-aware header
  // ============================================================
  function initNav() {
    const header = $('.site-header');
    if (!header) return;

    let lastScroll = 0;

    function onScroll() {
      const scroll = window.scrollY;
      if (scroll > 60) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScroll = scroll;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ============================================================
  // MOBILE NAV
  // ============================================================
  function initMobileNav() {
    const hamburger = $('.hamburger');
    const mobileNav = $('.mobile-nav');
    const mobileNavClose = $('.mobile-nav-close');
    const mobileNavBackdrop = $('.mobile-nav-backdrop');

    if (!hamburger || !mobileNav) return;

    function openNav() {
      hamburger.classList.add('open');
      mobileNav.classList.add('open');
      document.body.style.overflow = 'hidden';
      hamburger.setAttribute('aria-expanded', 'true');
    }

    function closeNav() {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
      hamburger.setAttribute('aria-expanded', 'false');
    }

    hamburger.addEventListener('click', () => {
      if (mobileNav.classList.contains('open')) {
        closeNav();
      } else {
        openNav();
      }
    });

    if (mobileNavClose) mobileNavClose.addEventListener('click', closeNav);
    if (mobileNavBackdrop) mobileNavBackdrop.addEventListener('click', closeNav);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeNav();
    });
  }

  // ============================================================
  // CART DRAWER
  // ============================================================
  function initCartDrawer() {
    const overlay = $('.cart-drawer-overlay');
    const drawer = $('.cart-drawer');
    const openBtns = $$('[data-cart-open]');
    const closeBtns = $$('[data-cart-close]');

    if (!drawer) return;

    function openCart() {
      overlay?.classList.add('open');
      drawer.classList.add('open');
      document.body.style.overflow = 'hidden';
      updateCartDrawer();
    }

    function closeCart() {
      overlay?.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    }

    openBtns.forEach(btn => btn.addEventListener('click', openCart));
    closeBtns.forEach(btn => btn.addEventListener('click', closeCart));
    overlay?.addEventListener('click', closeCart);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCart();
    });

    // Make openCart available globally
    window.openCartDrawer = openCart;
    window.closeCartDrawer = closeCart;
  }

  // ============================================================
  // UPDATE CART DRAWER
  // ============================================================
  async function updateCartDrawer() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      renderCartDrawer(cart);
      updateCartCount(cart.item_count);
    } catch (e) {
      console.error('Cart update failed:', e);
    }
  }

  function renderCartDrawer(cart) {
    const body = $('.cart-drawer-body');
    const totalEl = $('.cart-drawer-total-value');
    if (!body) return;

    if (totalEl) {
      totalEl.textContent = formatMoney(cart.total_price);
    }

    if (cart.item_count === 0) {
      body.innerHTML = `
        <div class="cart-drawer-empty">
          <div class="cart-drawer-empty-icon">🛒</div>
          <p style="font-size: var(--text-base); font-weight: var(--fw-medium); color: var(--color-text-secondary);">Your cart is empty</p>
          <p style="font-size: var(--text-sm); color: var(--color-text-muted);">Add some fragrances to get started</p>
          <a href="/collections/all" class="btn btn-outline btn-sm" onclick="window.closeCartDrawer()">Explore Collection</a>
        </div>
      `;
      return;
    }

    body.innerHTML = cart.items.map(item => `
      <div class="cart-drawer-item" data-variant-id="${item.variant_id}">
        <img
          src="${item.image || '//'}"
          alt="${item.product_title}"
          class="cart-drawer-item-image"
          loading="lazy"
        >
        <div class="cart-drawer-item-info">
          <div class="cart-drawer-item-name">${item.product_title}</div>
          ${item.variant_title !== 'Default Title' ? `<div class="cart-drawer-item-variant">${item.variant_title}</div>` : ''}
          <div class="cart-drawer-item-bottom">
            <div class="quantity-selector" style="width:fit-content; transform: scale(0.85); transform-origin: left;">
              <button class="qty-btn" data-action="decrease" data-variant="${item.variant_id}" data-qty="${item.quantity}">−</button>
              <span style="padding: 0 var(--space-2); font-size: var(--text-sm); color: var(--color-text-primary);">${item.quantity}</span>
              <button class="qty-btn" data-action="increase" data-variant="${item.variant_id}" data-qty="${item.quantity}">+</button>
            </div>
            <div class="cart-drawer-item-price">${formatMoney(item.final_line_price)}</div>
          </div>
          <button class="cart-item-remove" data-variant="${item.variant_id}" style="font-size:11px; margin-top: 6px;">Remove</button>
        </div>
      </div>
    `).join('');

    // Bind qty events
    $$('.qty-btn', body).forEach(btn => {
      btn.addEventListener('click', async () => {
        const variantId = btn.dataset.variant;
        const currentQty = parseInt(btn.dataset.qty);
        const action = btn.dataset.action;
        const newQty = action === 'increase' ? currentQty + 1 : currentQty - 1;
        await updateLineItem(variantId, newQty);
      });
    });

    $$('.cart-item-remove', body).forEach(btn => {
      btn.addEventListener('click', async () => {
        await updateLineItem(btn.dataset.variant, 0);
      });
    });
  }

  function updateCartCount(count) {
    $$('.cart-count').forEach(el => {
      el.textContent = count;
      el.classList.toggle('visible', count > 0);
    });
  }

  async function updateLineItem(variantId, quantity) {
    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity })
      });
      const cart = await response.json();
      renderCartDrawer(cart);
      updateCartCount(cart.item_count);
    } catch (e) {
      console.error('Update failed:', e);
    }
  }

  // ============================================================
  // ADD TO CART
  // ============================================================
  function initAddToCart() {
    $$('[data-add-to-cart]').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        const formData = new FormData(form);

        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            body: formData
          });

          if (!response.ok) throw new Error('Add to cart failed');

          const item = await response.json();

          btn.innerHTML = '✓ Added!';
          btn.style.background = 'var(--color-success)';

          showToast(`${item.product_title} added to cart`, 'success');

          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.style.background = '';
          }, 2000);

          await updateCartDrawer();

          // Open cart drawer
          if (window.openCartDrawer) {
            setTimeout(window.openCartDrawer, 400);
          }

        } catch (err) {
          btn.innerHTML = 'Error – Try Again';
          btn.disabled = false;
          showToast('Failed to add to cart. Please try again.', 'error');
          setTimeout(() => { btn.innerHTML = originalText; }, 2500);
        }
      });
    });
  }

  // ============================================================
  // QUICK ADD (product cards)
  // ============================================================
  function initQuickAdd() {
    $$('[data-quick-add]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const variantId = btn.dataset.quickAdd;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        try {
          await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id: variantId, quantity: 1 })
          });

          btn.innerHTML = '✓';
          await updateCartDrawer();
          showToast('Added to cart!', 'success');

          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
          }, 2000);

          if (window.openCartDrawer) {
            setTimeout(window.openCartDrawer, 400);
          }
        } catch (e) {
          btn.disabled = false;
          btn.innerHTML = originalText;
          showToast('Failed to add. Try again.', 'error');
        }
      });
    });
  }

  // ============================================================
  // PRODUCT IMAGE GALLERY
  // ============================================================
  function initProductGallery() {
    const mainImage = $('.product-main-image');
    const thumbnails = $$('.product-thumbnail');
    if (!mainImage || !thumbnails.length) return;

    thumbnails.forEach(thumb => {
      thumb.addEventListener('click', () => {
        mainImage.src = thumb.dataset.full || thumb.src;
        thumbnails.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  }

  // ============================================================
  // PRODUCT TABS
  // ============================================================
  function initProductTabs() {
    const tabBtns = $$('.tab-btn');
    const tabContents = $$('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.tab;

        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = $(`#${targetId}`);
        if (target) target.classList.add('active');
      });
    });
  }

  // ============================================================
  // QUANTITY SELECTOR (Product Page)
  // ============================================================
  function initQuantitySelector() {
    $$('.quantity-selector').forEach(wrapper => {
      const qtyInput = wrapper.querySelector('.qty-input');
      if (!qtyInput) return;

      wrapper.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const current = parseInt(qtyInput.value) || 1;
          if (btn.dataset.action === 'decrease') {
            qtyInput.value = Math.max(1, current - 1);
          } else {
            qtyInput.value = current + 1;
          }
        });
      });
    });
  }

  // ============================================================
  // SIZE SELECTOR
  // ============================================================
  function initSizeSelector() {
    $$('.size-option').forEach(option => {
      option.addEventListener('click', () => {
        const parent = option.closest('.size-options');
        $$('.size-option', parent).forEach(o => o.classList.remove('active'));
        option.classList.add('active');

        // Update hidden variant input if present
        const form = option.closest('form');
        const variantInput = form?.querySelector('[name="id"]');
        if (variantInput && option.dataset.variantId) {
          variantInput.value = option.dataset.variantId;
        }
      });
    });
  }

  // ============================================================
  // COLLECTION FILTERS
  // ============================================================
  function initCollectionFilters() {
    const filterChips = $$('.filter-chip');

    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const filter = chip.dataset.filter;
        const cards = $$('.product-card[data-type]');

        cards.forEach(card => {
          if (filter === 'all' || card.dataset.type === filter) {
            card.style.display = '';
            card.style.animation = 'fade-in 0.4s ease';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // ============================================================
  // SCROLL REVEAL
  // ============================================================
  function initScrollReveal() {
    const reveals = $$('.reveal');
    if (!reveals.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    reveals.forEach(el => observer.observe(el));
  }

  // ============================================================
  // HERO PARTICLES
  // ============================================================
  function initHeroParticles() {
    const container = $('.hero-particles');
    if (!container) return;

    function createParticle() {
      const p = document.createElement('span');
      p.className = 'particle';
      const size = Math.random() * 3 + 1;
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        bottom: -10px;
        width: ${size}px;
        height: ${size}px;
        animation-duration: ${Math.random() * 8 + 6}s;
        animation-delay: ${Math.random() * 4}s;
        opacity: ${Math.random() * 0.7 + 0.3};
      `;
      container.appendChild(p);
      setTimeout(() => p.remove(), 14000);
    }

    // Create initial burst
    for (let i = 0; i < 15; i++) {
      setTimeout(createParticle, i * 200);
    }

    // Continue creating
    const interval = setInterval(() => {
      if ($$('.particle', container).length < 30) createParticle();
    }, 600);

    // Cleanup on page change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(interval);
    });
  }

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  function showToast(message, type = 'success') {
    // Remove existing toasts
    $$('.toast').forEach(t => t.remove());

    const icon = type === 'success' ? '✓' : '✕';
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${message}</div>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  window.showToast = showToast;

  // ============================================================
  // NEWSLETTER FORM
  // ============================================================
  function initNewsletterForms() {
    $$('.newsletter-form, .footer-newsletter-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        const btn = form.querySelector('button[type="submit"]');
        if (!input || !input.value) return;

        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        // Shopify newsletter uses customer subscribe endpoint
        try {
          const formData = new FormData();
          formData.append('contact[email]', input.value);
          formData.append('form_type', 'customer');
          formData.append('utf8', '✓');

          await fetch('/contact', {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
          });

          btn.innerHTML = '✓';
          input.value = '';
          showToast('Thank you for subscribing!', 'success');

          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalContent;
          }, 3000);

        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = originalContent;
          showToast('Please try again.', 'error');
        }
      });
    });
  }

  // ============================================================
  // CONTACT FORM
  // ============================================================
  function initContactForm() {
    const form = $('.contact-form[data-contact-form]');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Sending...';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          btn.innerHTML = '✓ Message Sent!';
          form.reset();
          showToast('Your message has been sent successfully!', 'success');
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
          }, 3000);
        } else {
          throw new Error('Failed');
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        showToast('Failed to send. Please try again.', 'error');
      }
    });
  }

  // ============================================================
  // SMOOTH ANCHOR SCROLL
  // ============================================================
  function initSmoothScroll() {
    $$('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const target = $(anchor.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ============================================================
  // WISHLIST (UI only – persist in localStorage)
  // ============================================================
  function initWishlist() {
    const KEY = 'ln_wishlist';
    const wishlist = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));

    function save() {
      localStorage.setItem(KEY, JSON.stringify([...wishlist]));
    }

    $$('.product-card-wishlist').forEach(btn => {
      const productId = btn.dataset.productId;
      if (!productId) return;

      if (wishlist.has(productId)) {
        btn.innerHTML = '♥';
        btn.style.color = 'var(--color-gold)';
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (wishlist.has(productId)) {
          wishlist.delete(productId);
          btn.innerHTML = '♡';
          btn.style.color = '';
          showToast('Removed from wishlist', 'success');
        } else {
          wishlist.add(productId);
          btn.innerHTML = '♥';
          btn.style.color = 'var(--color-gold)';
          showToast('Added to wishlist!', 'success');
        }

        save();
      });
    });
  }

  // ============================================================
  // ACTIVE NAV LINK
  // ============================================================
  function initActiveNavLink() {
    const path = window.location.pathname;
    $$('.nav-link, .mobile-nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && path === href) {
        link.classList.add('active');
      }
    });
  }

  // ============================================================
  // PROMO CODE
  // ============================================================
  function initPromoCode() {
    const promoForm = $('.cart-promo');
    if (!promoForm) return;

    const input = promoForm.querySelector('input');
    const btn = promoForm.querySelector('button');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const code = input?.value?.trim();
      if (!code) return;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      // Shopify discount codes are applied via checkout URL
      const checkoutBtn = $('.cart-checkout-btn');
      if (checkoutBtn) {
        const url = new URL(checkoutBtn.href || '/checkout');
        url.searchParams.set('discount', code);
        checkoutBtn.href = url.toString();
        btn.innerHTML = 'Applied!';
        showToast(`Promo code "${code}" will be applied at checkout`, 'success');
      } else {
        btn.innerHTML = 'Apply';
        btn.disabled = false;
      }
    });
  }

  // ============================================================
  // SEARCH TOGGLE
  // ============================================================
  function initSearchToggle() {
    const searchBtn = $('[data-search-toggle]');
    const searchOverlay = $('.search-overlay');
    const searchClose = $('.search-close');
    const searchInput = $('.search-overlay input');

    if (!searchBtn || !searchOverlay) return;

    searchBtn.addEventListener('click', () => {
      searchOverlay.classList.toggle('open');
      if (searchOverlay.classList.contains('open')) {
        searchInput?.focus();
      }
    });

    searchClose?.addEventListener('click', () => {
      searchOverlay.classList.remove('open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') searchOverlay.classList.remove('open');
    });
  }

  // ============================================================
  // INIT ALL
  // ============================================================
  function init() {
    initNav();
    initMobileNav();
    initCartDrawer();
    initAddToCart();
    initQuickAdd();
    initProductGallery();
    initProductTabs();
    initQuantitySelector();
    initSizeSelector();
    initCollectionFilters();
    initScrollReveal();
    initHeroParticles();
    initNewsletterForms();
    initContactForm();
    initSmoothScroll();
    initWishlist();
    initActiveNavLink();
    initPromoCode();
    initSearchToggle();
    updateCartDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
