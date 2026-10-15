/**
 * AD PERFUMES — Core Storefront Architecture & Shopify Integration
 * Complete AJAX Cart Engine, Variant Switcher, Search Modal, and Storefront Filter Handling
 */

(function () {
  'use strict';

  // ============================================================
  // 1. HELPERS & FORMATTING
  // ============================================================
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

  function formatMoney(cents) {
    if (typeof cents !== 'number' || isNaN(cents)) return '';
    const amount = (cents / 100).toFixed(2);
    // Uses standard currency display
    return `$${amount}`;
  }

  function showToast(message, type = 'success') {
    $$('.ad-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `ad-toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : '✦');
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('visible');
      });
    });

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  window.showToast = showToast;

  // ============================================================
  // 2. SHOPIFY AJAX CART ENGINE
  // ============================================================
  const Cart = {
    async getCart() {
      const res = await fetch('/cart.js', {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to retrieve cart state');
      return await res.json();
    },

    async addItem(variantId, quantity = 1) {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          id: variantId,
          quantity: parseInt(quantity, 10) || 1
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.description || data.message || 'Unable to add perfume to bag');
      }
      return data;
    },

    async updateLine(lineKey, quantity) {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          id: lineKey,
          quantity: parseInt(quantity, 10)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.description || data.message || 'Unable to update quantity');
      }
      return data;
    },

    async saveNote(noteText) {
      try {
        await fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ note: noteText })
        });
      } catch (e) {
        console.warn('Note save error:', e);
      }
    }
  };

  // Sync Cart State Across Entire Storefront
  function syncCartUI(cart) {
    if (!cart) return;

    // 1. Update Header & Mobile Badges
    $$('.cart-count, #HeaderCartCount').forEach(badge => {
      badge.textContent = cart.item_count;
      badge.classList.toggle('visible', cart.item_count > 0);
    });

    const headerCartBtn = $('#HeaderCartBtn');
    if (headerCartBtn) {
      headerCartBtn.setAttribute('aria-label', `Shopping Bag (${cart.item_count} items)`);
    }

    // 2. Update Cart Drawer
    const drawer = $('#CartDrawer');
    if (drawer) {
      const drawerCount = $('#CartDrawerCount');
      if (drawerCount) drawerCount.textContent = `(${cart.item_count})`;

      const drawerTotal = $('#CartDrawerTotal');
      if (drawerTotal) drawerTotal.textContent = formatMoney(cart.total_price);

      const drawerFooter = $('#CartDrawerFooter');
      if (drawerFooter) {
        drawerFooter.style.display = cart.item_count === 0 ? 'none' : 'block';
      }

      // Free Shipping Bar
      const shippingBar = $('#CartShippingBar');
      if (shippingBar) {
        const threshold = parseInt(shippingBar.dataset.threshold, 10) || 0;
        if (threshold > 0) {
          const progressEl = shippingBar.querySelector('.shipping-bar-progress');
          const textEl = shippingBar.querySelector('.shipping-bar-text');
          if (progressEl && textEl) {
            if (cart.total_price >= threshold) {
              progressEl.style.width = '100%';
              textEl.innerHTML = '✨ You qualify for complimentary fragrance delivery!';
            } else {
              const remaining = threshold - cart.total_price;
              const percent = Math.min(100, Math.round((cart.total_price / threshold) * 100));
              progressEl.style.width = `${percent}%`;
              textEl.innerHTML = `Add <strong>${formatMoney(remaining)}</strong> more to unlock <strong>Complimentary Delivery</strong>`;
            }
          }
        }
      }

      // Items Container
      const drawerBody = $('#CartDrawerBody');
      if (drawerBody) {
        if (cart.item_count === 0) {
          drawerBody.innerHTML = `
            <div class="cart-drawer-empty" id="CartDrawerEmpty">
              <div class="cart-drawer-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
              </div>
              <p class="cart-empty-title">Your shopping bag is empty</p>
              <p class="cart-empty-sub">Explore our Signature and Discovery collections to discover your distinctive fragrance.</p>
              <a href="/collections/all" class="btn btn-primary btn-sm" data-cart-close>Explore Fragrances</a>
            </div>
          `;
        } else {
          drawerBody.innerHTML = `
            <div class="cart-drawer-items-list" id="CartDrawerItemsList">
              ${cart.items.map((item, idx) => `
                <div class="cart-drawer-item" data-line-key="${item.key}" data-line-index="${idx + 1}">
                  <a href="${item.url || '#'}" class="cart-drawer-item-img-link">
                    ${item.image ? `
                      <img src="${item.image}" alt="${escapeHtml(item.product_title)}" class="cart-drawer-item-image" width="80" height="100" loading="lazy">
                    ` : `<div class="cart-item-placeholder">✦</div>`}
                  </a>
                  <div class="cart-drawer-item-info">
                    <div class="cart-drawer-item-top">
                      <a href="${item.url || '#'}" class="cart-drawer-item-name">${escapeHtml(item.product_title)}</a>
                      <button type="button" class="cart-item-remove-btn" data-line-key="${item.key}" aria-label="Remove item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                    ${item.variant_title && item.variant_title !== 'Default Title' ? `
                      <div class="cart-drawer-item-variant">${escapeHtml(item.variant_title)}</div>
                    ` : ''}
                    <div class="cart-drawer-item-bottom">
                      <div class="quantity-selector cart-qty-selector">
                        <button type="button" class="qty-btn" data-action="decrease" data-line-key="${item.key}" data-qty="${item.quantity}" aria-label="Decrease quantity">−</button>
                        <span class="qty-display">${item.quantity}</span>
                        <button type="button" class="qty-btn" data-action="increase" data-line-key="${item.key}" data-qty="${item.quantity}" aria-label="Increase quantity">+</button>
                      </div>
                      <div class="cart-drawer-item-price">${formatMoney(item.final_line_price)}</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }
      }
    }

    // 3. Update Dedicated Cart Page if user is currently on /cart
    const cartPageForm = $('#CartMainForm');
    if (cartPageForm) {
      if (cart.item_count === 0) {
        window.location.reload();
      } else {
        const pageSubtotal = $('#CartPageSubtotal');
        const pageTotal = $('#CartPageTotal');
        if (pageSubtotal) pageSubtotal.textContent = formatMoney(cart.total_price);
        if (pageTotal) pageTotal.textContent = formatMoney(cart.total_price);

        cart.items.forEach(item => {
          const row = $(`.cart-item-row[data-line-key="${item.key}"]`);
          if (row) {
            const input = row.querySelector('.qty-input');
            if (input) input.value = item.quantity;
            const linePrice = row.querySelector('.cart-item-total-price');
            if (linePrice) linePrice.textContent = formatMoney(item.final_line_price);
          }
        });
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================
  // 3. CART DRAWER CONTROLLER
  // ============================================================
  function initCartDrawer() {
    const overlay = $('#CartDrawerOverlay');
    const drawer = $('#CartDrawer');
    if (!drawer) return;

    function openCart() {
      drawer.classList.add('open');
      overlay?.classList.add('open');
      document.body.style.overflow = 'hidden';
      // Refresh cart on open
      Cart.getCart().then(syncCartUI).catch(console.error);
    }

    function closeCart() {
      drawer.classList.remove('open');
      overlay?.classList.remove('open');
      document.body.style.overflow = '';
    }

    window.openCartDrawer = openCart;
    window.closeCartDrawer = closeCart;

    // Trigger buttons
    document.addEventListener('click', (e) => {
      const openTrigger = e.target.closest('[data-cart-open]');
      if (openTrigger) {
        e.preventDefault();
        openCart();
        return;
      }

      const closeTrigger = e.target.closest('[data-cart-close]');
      if (closeTrigger) {
        e.preventDefault();
        closeCart();
        return;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeCart();
      }
    });

    // Delegated Quantity Controls in Drawer & Page
    document.addEventListener('click', async (e) => {
      const qtyBtn = e.target.closest('.qty-btn');
      if (qtyBtn) {
        const lineKey = qtyBtn.dataset.lineKey;
        if (!lineKey) return; // Managed by form input instead
        e.preventDefault();

        const currentQty = parseInt(qtyBtn.dataset.qty, 10) || 1;
        const action = qtyBtn.dataset.action;
        const newQty = action === 'increase' ? currentQty + 1 : Math.max(0, currentQty - 1);

        qtyBtn.disabled = true;
        try {
          const updatedCart = await Cart.updateLine(lineKey, newQty);
          syncCartUI(updatedCart);
        } catch (err) {
          showToast(err.message || 'Could not update quantity', 'error');
        }
        return;
      }

      const removeBtn = e.target.closest('.cart-item-remove-btn');
      if (removeBtn) {
        const lineKey = removeBtn.dataset.lineKey;
        if (!lineKey) return;
        e.preventDefault();

        removeBtn.disabled = true;
        try {
          const updatedCart = await Cart.updateLine(lineKey, 0);
          syncCartUI(updatedCart);
          showToast('Item removed from shopping bag', 'info');
        } catch (err) {
          showToast(err.message || 'Could not remove item', 'error');
        }
        return;
      }
    });

    // Cart Drawer Note Autosave
    const noteInput = $('#CartDrawerNote');
    if (noteInput) {
      let noteTimeout;
      noteInput.addEventListener('input', () => {
        clearTimeout(noteTimeout);
        noteTimeout = setTimeout(() => {
          Cart.saveNote(noteInput.value);
        }, 800);
      });
    }
  }

  // ============================================================
  // 4. QUICK ADD & PRODUCT FORM SUBMISSION
  // ============================================================
  function initAddToCart() {
    // 1. Quick Add Triggers on Product Cards
    document.addEventListener('click', async (e) => {
      const trigger = e.target.closest('.quick-add-trigger');
      if (!trigger) return;

      e.preventDefault();
      const variantId = trigger.dataset.variantId;
      const title = trigger.dataset.productTitle || 'Fragrance';

      if (!variantId || variantId === 'dummy-var') {
        showToast('Please select this fragrance in the boutique', 'info');
        return;
      }

      const originalHtml = trigger.innerHTML;
      trigger.disabled = true;
      trigger.innerHTML = '<span>Adding...</span>';

      try {
        await Cart.addItem(variantId, 1);
        const updatedCart = await Cart.getCart();
        syncCartUI(updatedCart);
        showToast(`Added ${title} to your bag`, 'success');
        if (window.openCartDrawer) {
          setTimeout(window.openCartDrawer, 250);
        }
      } catch (err) {
        showToast(err.message || 'Error adding perfume to bag', 'error');
      } finally {
        setTimeout(() => {
          trigger.disabled = false;
          trigger.innerHTML = originalHtml;
        }, 1500);
      }
    });

    // 2. Main Product Page Add to Cart Form
    const productForm = $('[data-product-form]');
    if (productForm) {
      productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = $('#ProductAddToCartBtn');
        const variantInput = $('#ProductSelectedVariantId');
        const qtyInput = $('#ProductQuantityInput');

        const variantId = variantInput ? variantInput.value : null;
        const quantity = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;

        if (!variantId) {
          showToast('Please select a perfume size', 'error');
          return;
        }

        const originalText = submitBtn ? submitBtn.querySelector('.btn-text')?.textContent : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          const spinner = submitBtn.querySelector('.btn-spinner');
          if (spinner) spinner.classList.remove('hide');
        }

        try {
          await Cart.addItem(variantId, quantity);
          const updatedCart = await Cart.getCart();
          syncCartUI(updatedCart);
          showToast('Added to shopping bag', 'success');
          if (window.openCartDrawer) {
            setTimeout(window.openCartDrawer, 200);
          }
        } catch (err) {
          showToast(err.message || 'Unable to add perfume to bag', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            const spinner = submitBtn.querySelector('.btn-spinner');
            if (spinner) spinner.classList.add('hide');
          }
        }
      });
    }
  }

  // ============================================================
  // 5. LIVE VARIANT SWITCHER (Product Page)
  // ============================================================
  function initVariantSwitcher() {
    const productDataEl = $('[id^="ProductJson-"]');
    if (!productDataEl) return;

    let product;
    try {
      product = JSON.parse(productDataEl.textContent);
    } catch (e) {
      console.warn('Unable to parse product JSON:', e);
      return;
    }

    const optionPills = $$('.option-pill');
    if (!optionPills.length) return;

    optionPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const optionIndex = parseInt(pill.dataset.optionIndex, 10);
        const group = pill.closest('.product-option-group');

        // Toggle active pill in group
        $$('.option-pill', group).forEach(p => {
          p.classList.remove('active');
          p.setAttribute('aria-checked', 'false');
        });
        pill.classList.add('active');
        pill.setAttribute('aria-checked', 'true');

        // Update selected option label display
        const labelDisplay = $(`#OptionSelectedValue-${optionIndex}`);
        if (labelDisplay) labelDisplay.textContent = pill.dataset.optionValue;

        // Determine current selected combination across all groups
        const selectedValues = [];
        $$('.product-option-group').forEach(grp => {
          const activePill = grp.querySelector('.option-pill.active');
          if (activePill) selectedValues.push(activePill.dataset.optionValue);
        });

        // Find matching variant
        const matchedVariant = product.variants.find(v => {
          return v.options.every((optVal, i) => optVal === selectedValues[i]);
        });

        const variantInput = $('#ProductSelectedVariantId');
        const priceEl = $('#ProductPrice');
        const comparePriceEl = $('#ProductComparePrice');
        const saveBadgeEl = $('#ProductSaveBadge');
        const submitBtn = $('#ProductAddToCartBtn');
        const stockStatus = $('#ProductStockStatus');

        if (matchedVariant) {
          if (variantInput) variantInput.value = matchedVariant.id;

          // Update Price
          if (priceEl) priceEl.textContent = formatMoney(matchedVariant.price);

          // Update Compare-at Price
          if (comparePriceEl && saveBadgeEl) {
            if (matchedVariant.compare_at_price > matchedVariant.price) {
              comparePriceEl.textContent = formatMoney(matchedVariant.compare_at_price);
              comparePriceEl.classList.remove('hide');

              const savings = matchedVariant.compare_at_price - matchedVariant.price;
              saveBadgeEl.textContent = `Save ${formatMoney(savings)}`;
              saveBadgeEl.classList.remove('hide');
            } else {
              comparePriceEl.classList.add('hide');
              saveBadgeEl.classList.add('hide');
            }
          }

          // Update Availability
          if (matchedVariant.available) {
            if (submitBtn) {
              submitBtn.disabled = false;
              const textSpan = submitBtn.querySelector('.btn-text');
              if (textSpan) textSpan.textContent = 'Add to Shopping Bag';
            }
            if (stockStatus) {
              stockStatus.innerHTML = `
                <span class="stock-indicator in-stock"></span>
                <span class="stock-label">In Stock • Ready to Dispatch</span>
              `;
            }
          } else {
            if (submitBtn) {
              submitBtn.disabled = true;
              const textSpan = submitBtn.querySelector('.btn-text');
              if (textSpan) textSpan.textContent = 'Sold Out';
            }
            if (stockStatus) {
              stockStatus.innerHTML = `
                <span class="stock-indicator out-of-stock"></span>
                <span class="stock-label">Currently Out of Stock</span>
              `;
            }
          }

          // Update URL without reload
          if (window.history && window.history.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.set('variant', matchedVariant.id);
            window.history.replaceState({}, '', url.toString());
          }
        } else {
          if (submitBtn) {
            submitBtn.disabled = true;
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Unavailable';
          }
        }
      });
    });
  }

  // ============================================================
  // 6. PRODUCT GALLERY & THUMBNAILS
  // ============================================================
  function initProductGallery() {
    const mainImg = $('#ProductMainImage');
    const thumbBtns = $$('.product-thumbnail-btn');
    if (!mainImg || !thumbBtns.length) return;

    thumbBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetSrc = btn.dataset.targetSrc;
        if (!targetSrc) return;

        mainImg.src = targetSrc;
        thumbBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // ============================================================
  // 7. QUANTITY CONTROLS (Standalone fields)
  // ============================================================
  function initQuantitySelectors() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.product-qty-selector .qty-btn');
      if (!btn) return;

      const container = btn.closest('.product-qty-selector');
      const input = container.querySelector('.qty-input');
      if (!input) return;

      const current = parseInt(input.value, 10) || 1;
      if (btn.dataset.action === 'decrease') {
        input.value = Math.max(1, current - 1);
      } else {
        input.value = current + 1;
      }
    });
  }

  // ============================================================
  // 8. SEARCH MODAL CONTROLLER
  // ============================================================
  function initSearchModal() {
    const overlay = $('#SearchOverlay');
    if (!overlay) return;

    const input = $('#SearchOverlayInput');

    function openSearch() {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => input?.focus(), 150);
    }

    function closeSearch() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-search-toggle]')) {
        e.preventDefault();
        openSearch();
        return;
      }

      if (e.target.closest('[data-search-close]')) {
        e.preventDefault();
        closeSearch();
        return;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        closeSearch();
      }
    });
  }

  // ============================================================
  // 9. COLLECTION FILTERS & SORTING
  // ============================================================
  function initCollectionFilters() {
    // Sorting Dropdown
    const sortSelect = $('#CollectionSortBy');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('sort_by', sortSelect.value);
        window.location.href = url.toString();
      });
    }

    // Faceted Filter Checkboxes Auto-submit
    const filtersForm = $('#CollectionFiltersForm');
    if (filtersForm) {
      filtersForm.querySelectorAll('.filter-checkbox').forEach(box => {
        box.addEventListener('change', () => {
          filtersForm.submit();
        });
      });
    }

    // Mobile Filter Drawer Toggle
    const toggleBtn = $('#FilterDrawerToggleBtn');
    const closeBtn = $('#FilterDrawerCloseBtn');
    const sidebar = $('#CollectionFilterSidebar');

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.add('drawer-open');
        document.body.style.overflow = 'hidden';
      });

      closeBtn?.addEventListener('click', () => {
        sidebar.classList.remove('drawer-open');
        document.body.style.overflow = '';
      });
    }
  }

  // ============================================================
  // 10. MOBILE NAVIGATION CONTROLLER
  // ============================================================
  function initMobileNav() {
    const hamburger = $('#HamburgerBtn');
    const mobileNav = $('#MobileNav');
    if (!hamburger || !mobileNav) return;

    function openNav() {
      hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      mobileNav.classList.add('open');
      mobileNav.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeNav() {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('open');
      mobileNav.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
      if (mobileNav.classList.contains('open')) {
        closeNav();
      } else {
        openNav();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-mobile-nav-close]')) {
        closeNav();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        closeNav();
      }
    });
  }

  // ============================================================
  // 11. SCROLL REVEAL & HEADER ELEVATION
  // ============================================================
  function initScrollEffects() {
    const header = $('#SiteHeader');
    if (header) {
      const onScroll = () => {
        if (window.scrollY > 40) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    // IntersectionObserver for subtle premium reveals
    const reveals = $$('.reveal');
    if (reveals.length && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      reveals.forEach(el => observer.observe(el));
    } else {
      reveals.forEach(el => el.classList.add('visible'));
    }
  }

  // ============================================================
  // 12. INITIALIZATION ON READY
  // ============================================================
  function init() {
    initScrollEffects();
    initMobileNav();
    initCartDrawer();
    initAddToCart();
    initVariantSwitcher();
    initProductGallery();
    initQuantitySelectors();
    initSearchModal();
    initCollectionFilters();

    // Initial cart synchronization with Shopify
    Cart.getCart().then(syncCartUI).catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
