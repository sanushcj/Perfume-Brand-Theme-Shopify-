const http = require('http');
const fs = require('fs');
const path = require('path');
const { Liquid } = require('liquidjs');

const PORT = process.env.PORT || 3000;
const root = __dirname;

const engine = new Liquid({
  root: [
    path.resolve(root, 'layout'),
    path.resolve(root, 'sections'),
    path.resolve(root, 'snippets'),
    path.resolve(root, 'templates')
  ],
  extname: '.liquid',
  strictFilters: false,
  strictVariables: false
});

// Ignore schema tag
engine.registerTag('schema', {
  parse: function(tagToken, remainTokens) {
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endschema') break;
    }
  },
  render: function() { return ''; }
});

// style and javascript tags
engine.registerTag('style', {
  parse: function(tagToken, remainTokens) {
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endstyle') break;
      this.tokens.push(token.raw);
    }
  },
  render: function() { return `<style>${this.tokens.join('')}</style>`; }
});

engine.registerTag('javascript', {
  parse: function(tagToken, remainTokens) {
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endjavascript') break;
      this.tokens.push(token.raw);
    }
  },
  render: function() { return `<script>${this.tokens.join('')}</script>`; }
});

// form tag
engine.registerTag('form', {
  parse: function(tagToken, remainTokens) {
    this.args = tagToken.args;
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endform') break;
      this.tokens.push(token.raw);
    }
  },
  render: async function(scope) {
    const inner = await engine.parseAndRender(this.tokens.join(''), scope);
    return `<form method="post" action="/cart/add" ${this.args}>${inner}</form>`;
  }
});

// paginate tag
engine.registerTag('paginate', {
  parse: function(tagToken, remainTokens) {
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endpaginate') break;
      this.tokens.push(token.raw);
    }
  },
  render: async function(scope) {
    return await engine.parseAndRender(this.tokens.join(''), scope);
  }
});

// section tag
engine.registerTag('section', {
  parse: function(tagToken) {
    this.sectionName = tagToken.args.trim().replace(/^['"]|['"]$/g, '');
  },
  render: async function(scope) {
    const secPath = path.resolve(root, 'sections', `${this.sectionName}.liquid`);
    if (!fs.existsSync(secPath)) return `<!-- Missing section: ${this.sectionName} -->`;

    let secSettings = {};
    let secBlocks = {};
    let blockOrder = [];

    try {
      const indexJson = JSON.parse(fs.readFileSync(path.resolve(root, 'templates', 'index.json'), 'utf8'));
      if (indexJson.sections && indexJson.sections[this.sectionName]) {
        secSettings = indexJson.sections[this.sectionName].settings || {};
        secBlocks = indexJson.sections[this.sectionName].blocks || {};
        blockOrder = indexJson.sections[this.sectionName].block_order || Object.keys(secBlocks);
      }
    } catch(e) {}

    const blocksArray = blockOrder.map((id) => ({
      id,
      type: secBlocks[id]?.type || '',
      settings: secBlocks[id]?.settings || {},
      shopify_attributes: `data-block-id="${id}"`
    }));

    const childScope = Object.create(scope.getAll());
    childScope.section = {
      id: this.sectionName,
      settings: secSettings,
      blocks: blocksArray
    };

    const sectionContent = fs.readFileSync(secPath, 'utf8');
    return await engine.parseAndRender(sectionContent, childScope);
  }
});

// Shopify filters
engine.registerFilter('asset_url', v => `/assets/${v}`);
engine.registerFilter('stylesheet_tag', v => `<link rel="stylesheet" href="${v}">`);
engine.registerFilter('script_tag', v => `<script src="${v}"></script>`);
engine.registerFilter('image_url', (v, ...args) => {
  if (typeof v === 'string') {
    if (v.startsWith('/') || v.startsWith('http')) return v;
    return `/assets/${v}`;
  }
  if (v && v.src) return v.src.startsWith('/') ? v.src : `/assets/${v.src}`;
  return '/assets/product-addicted.jpg';
});
engine.registerFilter('money', v => typeof v === 'number' ? `$${(v/100).toFixed(2)}` : (v || '$175.00'));
engine.registerFilter('money_without_currency', v => typeof v === 'number' ? (v/100).toFixed(2) : (v || '175.00'));
engine.registerFilter('handleize', v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
engine.registerFilter('strip_html', v => String(v || '').replace(/<[^>]*>/g, ''));
engine.registerFilter('truncatewords', (v, n) => {
  const words = String(v || '').split(/\s+/);
  return words.length > n ? words.slice(0, n).join(' ') + '...' : v;
});

// In-Memory Database for AD Perfumes
const PRODUCTS = [
  {
    id: 1,
    handle: 'addicted',
    title: 'ADDICTED',
    type: 'Extrait de Parfum • 50ml',
    price: 17500,
    compare_at_price: 22000,
    available: true,
    url: '/products/addicted',
    tags: ['flagship', 'new', 'bestseller', 'woody'],
    featured_image: { src: '/assets/product-addicted.jpg', alt: 'ADDICTED Extrait de Parfum 50ml' },
    images: [
      { src: '/assets/product-addicted.jpg', alt: 'ADDICTED 50ml Front View' },
      { src: '/assets/discovery-travel-set.jpg', alt: 'ADDICTED Travel Editions' }
    ],
    description: `
      <p class="lead"><strong>Experience dark, opulent allure.</strong> This warm, sensual fragrance carries a distinctly Middle Eastern character.</p>
      <p>Deep, smoky, and resinous woods blend seamlessly with the warm, spicy, and leathery touch of saffron. A true statement piece by <strong>AD Perfumes</strong> for those who want to leave a lasting impression long <strong>After Dreams</strong> fade.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Dark Opulent Woods & Saffron',
        top_notes: 'Crimson Saffron, Pink Peppercorn, Wild Thyme, Warm Spices',
        heart_notes: 'Smoky Cedarwood, Aged Resins, Handcrafted Leather, Frankincense',
        base_notes: 'Rare Cambodian Oud, Golden Ambergris, Patchouli, Dark Musk'
      },
      reviews: { rating_count: '2.8k' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '50ml Extrait', values: ['50ml Extrait', '20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [
      { id: 'var-addicted-50', title: '50ml Extrait', price: 17500, compare_at_price: 22000, available: true },
      { id: 'var-addicted-20', title: '20ml Travel Spray', price: 6800, compare_at_price: 8500, available: true },
      { id: 'var-addicted-10', title: '10ml Pocket Flacon', price: 4200, compare_at_price: 5000, available: true }
    ],
    selected_or_first_available_variant: { id: 'var-addicted-50', title: '50ml Extrait', price: 17500, compare_at_price: 22000, available: true }
  },
  {
    id: 2,
    handle: 'ice-of-heaven',
    title: 'Ice of Heaven',
    type: 'Extrait de Parfum • 50ml',
    price: 16000,
    compare_at_price: 20000,
    available: true,
    url: '/products/ice-of-heaven',
    tags: ['flagship', 'new', 'aquatic', 'fresh'],
    featured_image: { src: '/assets/product-ice-of-heaven.jpg', alt: 'Ice of Heaven Extrait de Parfum 50ml' },
    images: [
      { src: '/assets/product-ice-of-heaven.jpg', alt: 'Ice of Heaven 50ml Glacial Flacon' }
    ],
    description: `
      <p class="lead"><strong>Dive into a fresh, aquatic embrace.</strong> It opens with an invigorating blast of frozen apple, lemon, bergamot, and star anise, melting into an icy marine heart with orange blossom and plum.</p>
      <p>Grounded by driftwood, moss, amber, and musk, this <strong>AD Perfumes</strong> creation is the ultimate cool refresh — like waking to arctic clarity <strong>After Dreams</strong>.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Glacial Fresh Marine & Crisp Apple',
        top_notes: 'Frozen Green Apple, Amalfi Lemon, Italian Bergamot, Star Anise',
        heart_notes: 'Icy Marine Accords, Grasse Orange Blossom, Mirabelle Plum',
        base_notes: 'Coastal Driftwood, French Oakmoss, White Amber, Cashmere Musk'
      },
      reviews: { rating_count: '1.9k' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '50ml Extrait', values: ['50ml Extrait', '20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [
      { id: 'var-ice-50', title: '50ml Extrait', price: 16000, compare_at_price: 20000, available: true }
    ],
    selected_or_first_available_variant: { id: 'var-ice-50', title: '50ml Extrait', price: 16000, compare_at_price: 20000, available: true }
  },
  {
    id: 3,
    handle: 'rouge-elite',
    title: 'Rouge Elite',
    type: 'Extrait de Parfum • 50ml',
    price: 16500,
    compare_at_price: 21000,
    available: true,
    url: '/products/rouge-elite',
    tags: ['flagship', 'new', 'amber', 'gourmand'],
    featured_image: { src: '/assets/product-rouge-elite.jpg', alt: 'Rouge Elite Extrait de Parfum 50ml' },
    images: [
      { src: '/assets/product-rouge-elite.jpg', alt: 'Rouge Elite Ruby Crystal Flacon' }
    ],
    description: `
      <p class="lead"><strong>Discover sophisticated warmth.</strong> Bright top notes of saffron and bergamot give way to a decadent heart of amber, caramelized sugar, and soft florals.</p>
      <p>Resting on a base of cedarwood, woody amber, and musk, it’s an elegant signature scent crafted by <strong>AD Perfumes</strong> for the golden daylight <strong>After Dreams</strong>.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Luminous Saffron & Caramelized Amber',
        top_notes: 'Persian Saffron Threads, Sparkling Bergamot, Blood Orange Sparkle',
        heart_notes: 'Golden Resin Amber, Caramelized Sugar Crust, Jasmine Blossom',
        base_notes: 'Virginian Cedarwood, Woody Ambergris, White Fir Balsam, Silken Musk'
      },
      reviews: { rating_count: '3.1k' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '50ml Extrait', values: ['50ml Extrait', '20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [
      { id: 'var-rouge-50', title: '50ml Extrait', price: 16500, compare_at_price: 21000, available: true }
    ],
    selected_or_first_available_variant: { id: 'var-rouge-50', title: '50ml Extrait', price: 16500, compare_at_price: 21000, available: true }
  },
  {
    id: 4,
    handle: 'purple-mist',
    title: 'Purple Mist',
    type: 'Pocket Extrait • 20ml / 10ml',
    price: 6800,
    compare_at_price: 8500,
    available: true,
    url: '/products/purple-mist',
    tags: ['discovery', 'travel', 'spicy', 'oud'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Purple Mist Travel Edition' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Purple Mist Atomizer' }],
    description: `
      <p class="lead"><strong>A spicy, sweet, and elegant blend.</strong> Saffron and sweet citrus open into smooth oud and warm spices, settling on a soft amber and woody base.</p>
      <p>A mysterious mist by <strong>AD Perfumes</strong>, capturing the mystical haze that hovers just <strong>After Dreams</strong>.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Mystic Saffron & Smooth Agarwood',
        top_notes: 'Sweet Mandarin, Saffron Threads, Bergamot Zest',
        heart_notes: 'Smooth Agarwood (Oud), Warm Nutmeg, Crushed Cinnamon',
        base_notes: 'Golden Amber, Soft Cedarwood, Cashmere Woods'
      },
      reviews: { rating_count: '1.4k' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '20ml Travel Spray', values: ['20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [{ id: 'var-purple-20', title: '20ml Travel Spray', price: 6800, compare_at_price: 8500, available: true }],
    selected_or_first_available_variant: { id: 'var-purple-20', title: '20ml Travel Spray', price: 6800, compare_at_price: 8500, available: true }
  },
  {
    id: 5,
    handle: 'old-money',
    title: 'Old Money',
    type: 'Pocket Extrait • 20ml / 10ml',
    price: 7200,
    compare_at_price: 9000,
    available: true,
    url: '/products/old-money',
    tags: ['discovery', 'classic', 'chypre', 'woody'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Old Money Travel Edition' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Old Money Atomizer' }],
    description: `
      <p class="lead"><strong>Sophisticated and earthy.</strong> Fresh green notes of fir and cypress blend into warm amber and soft incense, finishing with a rich oakmoss and vetiver base.</p>
      <p>The classic scent of enduring success by <strong>AD Perfumes</strong>, commanding timeless stature morning <strong>After Dreams</strong>.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Earthy Cypress, Amber & Forest Oakmoss',
        top_notes: 'Crisp Siberian Fir, Italian Cypress, Artemisia',
        heart_notes: 'Warm Amber, Frankincense Resins, Birchwood',
        base_notes: 'Forest Oakmoss, Haitian Vetiver, Rich Patchouli'
      },
      reviews: { rating_count: '2.1k' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '20ml Travel Spray', values: ['20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [{ id: 'var-old-20', title: '20ml Travel Spray', price: 7200, compare_at_price: 9000, available: true }],
    selected_or_first_available_variant: { id: 'var-old-20', title: '20ml Travel Spray', price: 7200, compare_at_price: 9000, available: true }
  },
  {
    id: 6,
    handle: 'fallen-star',
    title: 'Fallen Star',
    type: 'Pocket Extrait • 20ml / 10ml',
    price: 6500,
    compare_at_price: 8000,
    available: true,
    url: '/products/fallen-star',
    tags: ['discovery', 'tea', 'fresh', 'citrus'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Fallen Star Travel Edition' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Fallen Star Flacon' }],
    description: `
      <p class="lead"><strong>Clean and tea-like.</strong> Fresh bergamot and citrus sparkle above a heart of black tea, ginger, and Ceylon cinnamon, grounded by soft amber.</p>
      <p>A bright, celestial spark in the <strong>AD Perfumes</strong> collection — a star caught slipping into dawn <strong>After Dreams</strong>.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Luminous Black Tea & Ceylon Cinnamon',
        top_notes: 'Calabrian Bergamot, Meyer Lemon, Japanese Yuzu',
        heart_notes: 'Smoked Black Tea, Fresh Ginger Root, Ceylon Cinnamon',
        base_notes: 'Radiant Amber, Sandalwood, Clean Skin Musk'
      },
      reviews: { rating_count: '980' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '20ml Travel Spray', values: ['20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [{ id: 'var-fallen-20', title: '20ml Travel Spray', price: 6500, compare_at_price: 8000, available: true }],
    selected_or_first_available_variant: { id: 'var-fallen-20', title: '20ml Travel Spray', price: 6500, compare_at_price: 8000, available: true }
  },
  {
    id: 7,
    handle: 'coffee',
    title: 'Coffee',
    type: 'Pocket Extrait • 20ml / 10ml',
    price: 6800,
    compare_at_price: 8500,
    available: true,
    url: '/products/coffee',
    tags: ['discovery', 'gourmand', 'sweet', 'warm'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Coffee Travel Edition' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Coffee Atomizer' }],
    description: `
      <p class="lead"><strong>A gourmand's dream.</strong> Rich, roasted, creamy, and wonderfully sweet.</p>
      <p>This warm, comforting scent by <strong>AD Perfumes</strong> is as addictive as your favorite morning brew, gently waking the senses into the daylight <strong>After Dreams</strong>.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Roasted Espresso, Steamed Cream & Vanilla',
        top_notes: 'Dark Roasted Arabica Espresso, Crushed Cardamom',
        heart_notes: 'Steamed Heavy Cream, Frosted Vanilla Bean, Brown Sugar',
        base_notes: 'Golden Caramel, Tonka Bean, Mysore Sandalwood'
      },
      reviews: { rating_count: '3.4k' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '20ml Travel Spray', values: ['20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [{ id: 'var-coffee-20', title: '20ml Travel Spray', price: 6800, compare_at_price: 8500, available: true }],
    selected_or_first_available_variant: { id: 'var-coffee-20', title: '20ml Travel Spray', price: 6800, compare_at_price: 8500, available: true }
  },
  {
    id: 8,
    handle: 'toxic',
    title: 'Toxic',
    type: 'Pocket Extrait • 20ml / 10ml',
    price: 7000,
    compare_at_price: 8800,
    available: true,
    url: '/products/toxic',
    tags: ['discovery', 'sensual', 'tobacco', 'masculine'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Toxic Travel Edition' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Toxic Atomizer' }],
    description: `
      <p class="lead"><strong>Bold, spicy, and unapologetically masculine.</strong> Fresh lavender and cardamom meet a rich heart of tobacco and cinnamon, resting on a warm base of vanilla and sandalwood.</p>
      <p>An intoxicating, dangerously attractive blend from <strong>AD Perfumes</strong>, seductive long <strong>After Dreams</strong>.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Lavender, Cardamom & Blonde Tobacco',
        top_notes: 'French Lavender, Green Cardamom, Cracked Black Pepper',
        heart_notes: 'Rich Blonde Tobacco Leaf, Cinnamon Bark, Clove Bud',
        base_notes: 'Bourbon Vanilla, Mysore Sandalwood, Dark Ambergris'
      },
      reviews: { rating_count: '1.7k' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '20ml Travel Spray', values: ['20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [{ id: 'var-toxic-20', title: '20ml Travel Spray', price: 7000, compare_at_price: 8800, available: true }],
    selected_or_first_available_variant: { id: 'var-toxic-20', title: '20ml Travel Spray', price: 7000, compare_at_price: 8800, available: true }
  },
  {
    id: 9,
    handle: 'dark-chocolates',
    title: 'Dark Chocolates',
    type: 'Pocket Extrait • 20ml / 10ml',
    price: 6800,
    compare_at_price: 8500,
    available: true,
    url: '/products/dark-chocolates',
    tags: ['discovery', 'gourmand', 'cocoa', 'decadent'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Dark Chocolates Travel Edition' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Dark Chocolates Atomizer' }],
    description: `
      <p class="lead"><strong>Rich, dark, and perfectly creamy.</strong> Bitter orange and roasted coffee melt into luxurious cocoa, hazelnut, and praline, wrapped in vanilla and tonka bean.</p>
      <p>A decadent, melt-in-your-mouth treat by <strong>AD Perfumes</strong>, an opulent indulgence to savor <strong>After Dreams</strong>.</p>
    `,
    metafields: {
      custom: {
        subtitle: 'Bitter Orange, Cocoa & Hazelnut Praline',
        top_notes: 'Candied Bitter Orange Peel, Roasted Arabica, Hazelnut Liqueur',
        heart_notes: '85% Dark Cocoa Ganache, Roasted Hazelnut, Caramelized Praline',
        base_notes: 'Madagascar Vanilla Pod, Roasted Tonka Bean, Soft Woods'
      },
      reviews: { rating_count: '2.5k' }
    },
    options_with_values: [
      { name: 'Size', selected_value: '20ml Travel Spray', values: ['20ml Travel Spray', '10ml Pocket Flacon'] }
    ],
    variants: [{ id: 'var-choco-20', title: '20ml Travel Spray', price: 6800, compare_at_price: 8500, available: true }],
    selected_or_first_available_variant: { id: 'var-choco-20', title: '20ml Travel Spray', price: 6800, compare_at_price: 8500, available: true }
  }
];

// In-Memory Live Cart for preview
let cartState = {
  item_count: 2,
  total_price: 33500,
  currency: { iso_code: 'USD', symbol: '$' },
  items: [
    {
      id: 'item-1',
      variant_id: 'var-addicted-50',
      quantity: 1,
      price: 17500,
      original_price: 17500,
      final_price: 17500,
      line_price: 17500,
      url: '/products/addicted',
      title: 'ADDICTED - 50ml Extrait',
      image: { src: '/assets/product-addicted.jpg' },
      product: PRODUCTS[0],
      variant: PRODUCTS[0].variants[0]
    },
    {
      id: 'item-2',
      variant_id: 'var-ice-50',
      quantity: 1,
      price: 16000,
      original_price: 16000,
      final_price: 16000,
      line_price: 16000,
      url: '/products/ice-of-heaven',
      title: 'Ice of Heaven - 50ml Extrait',
      image: { src: '/assets/product-ice-of-heaven.jpg' },
      product: PRODUCTS[1],
      variant: PRODUCTS[1].variants[0]
    }
  ]
};

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

async function renderFullTheme(contentHtml, reqScope, templateName = 'index') {
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(path.resolve(root, 'config', 'settings_data.json'), 'utf8')).current || {};
  } catch(e) {}

  const globalScope = {
    shop: {
      name: settings.brand_name || 'AD Perfumes',
      description: 'Purveyors of rare and exceptional fragrances for those who understand that true luxury is found After Dreams.',
      customer_accounts_enabled: false
    },
    settings: settings,
    routes: {
      root_url: '/',
      collections_url: '/collections',
      search_url: '/search',
      cart_url: '/cart',
      cart_add_url: '/cart/add',
      checkout_url: '/checkout'
    },
    request: {
      locale: { iso_code: 'en' },
      page_type: templateName
    },
    canonical_url: 'http://localhost:3000' + reqScope.canonicalPath,
    page_title: reqScope.page_title || 'AD Perfumes — After Dreams • Haute Parfumerie',
    page_description: reqScope.page_description || 'Born in the quiet hours After Dreams.',
    template: {
      name: templateName,
      suffix: ''
    },
    cart: cartState,
    linklists: {
      'main-menu': {
        links: [
          { url: '/', title: 'Home', active: templateName === 'index' },
          { url: '/collections', title: 'Shop All', active: templateName === 'collection' },
          { url: '/collections/flagship', title: 'Flagships', active: false },
          { url: '/pages/about', title: 'About Atelier', active: templateName === 'page' },
          { url: '/pages/contact', title: 'Contact', active: false }
        ]
      }
    },
    pages: {
      about: { url: '/pages/about' },
      contact: { url: '/pages/contact' }
    },
    collections: {
      all: {
        title: 'All Fragrances',
        description: 'Discover the full AD Perfumes portfolio — from the newly launched 50ml Flagship Extraits to versatile 10ml & 20ml Discovery Travel editions.',
        products_count: PRODUCTS.length,
        products: PRODUCTS
      },
      flagship: {
        title: 'The Flagship Trinity (50ml)',
        description: 'Haute Parfumerie statement pieces formulated at 30%+ Extrait de Parfum concentration for unyielding sillage.',
        products_count: 3,
        products: PRODUCTS.slice(0, 3)
      },
      'travel-pocket': {
        title: 'The Discovery & Travel Series (10ml & 20ml)',
        description: 'Signature scents reimagined for travel, pocket portability, and bespoke scent layering.',
        products_count: 6,
        products: PRODUCTS.slice(3)
      }
    },
    ...reqScope
  };

  globalScope.content_for_header = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Montserrat:wght@200;300;400;500;600&display=swap" rel="stylesheet">
  `;
  globalScope.content_for_layout = contentHtml;

  const themeLiquid = fs.readFileSync(path.resolve(root, 'layout', 'theme.liquid'), 'utf8');
  return await engine.parseAndRender(themeLiquid, globalScope);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname.replace(/\/$/, '') || '/';

  // 1. Static Assets
  if (pathname.startsWith('/assets/')) {
    const filename = pathname.replace('/assets/', '');
    const assetPath = path.resolve(root, 'assets', filename);
    if (fs.existsSync(assetPath)) {
      const ext = path.extname(assetPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(assetPath).pipe(res);
      return;
    } else {
      res.writeHead(404);
      res.end('Asset not found: ' + filename);
      return;
    }
  }

  // 2. Cart API Handling
  if (pathname === '/cart/add' || pathname === '/cart/add.js') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', message: 'Item added to luxury bag', cart: cartState }));
    });
    return;
  }
  if (pathname === '/cart.js') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cartState));
    return;
  }

  try {
    // 3. PRODUCT VIEW PAGE: /products/:handle
    if (pathname.startsWith('/products/')) {
      const handle = pathname.replace('/products/', '');
      const product = PRODUCTS.find(p => p.handle === handle) || PRODUCTS[0];
      const secPath = path.resolve(root, 'sections', 'product-main.liquid');
      const secRaw = fs.readFileSync(secPath, 'utf8');

      const reqScope = {
        canonicalPath: pathname,
        product: product,
        page_title: `${product.title} — AD Perfumes (After Dreams)`,
        page_description: product.metafields.custom.subtitle,
        section: {
          id: 'product-main',
          settings: { show_related: true }
        }
      };

      const productContent = await engine.parseAndRender(secRaw, { product, ...reqScope });
      const html = await renderFullTheme(
        `<div id="shopify-section-product-main" class="shopify-section">${productContent}</div>`,
        reqScope,
        'product'
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(html);
      return;
    }

    // 4. CART PAGE: /cart
    if (pathname === '/cart') {
      const secPath = path.resolve(root, 'sections', 'cart-main.liquid');
      const secRaw = fs.readFileSync(secPath, 'utf8');
      const reqScope = {
        canonicalPath: '/cart',
        cart: cartState,
        page_title: 'Your Shopping Bag — AD Perfumes',
        section: { id: 'cart-main', settings: {} }
      };
      const cartContent = await engine.parseAndRender(secRaw, { cart: cartState, ...reqScope });
      const html = await renderFullTheme(
        `<div id="shopify-section-cart-main" class="shopify-section">${cartContent}</div>`,
        reqScope,
        'cart'
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(html);
      return;
    }

    // 5. COLLECTIONS PAGE: /collections or /collections/:handle
    if (pathname.startsWith('/collections')) {
      let handle = pathname.replace('/collections', '').replace('/', '');
      if (!handle || handle === 'all') handle = 'all';
      const colData = (handle === 'flagship') 
        ? { title: 'The Flagship Trinity (50ml)', description: 'Haute Parfumerie statement pieces formulated at 30%+ Extrait de Parfum concentration.', products_count: 3, products: PRODUCTS.slice(0, 3) }
        : (handle === 'travel-pocket' || handle === 'travel')
        ? { title: 'The Discovery & Travel Series (10ml & 20ml)', description: 'Signature scents reimagined for travel and pocket portability.', products_count: 6, products: PRODUCTS.slice(3) }
        : { title: 'All Fragrances — AD Perfumes', description: 'Explore the full portfolio of artisanal Extraits de Parfum by AD Perfumes.', products_count: PRODUCTS.length, products: PRODUCTS };

      const secPath = path.resolve(root, 'sections', 'collection-main.liquid');
      const secRaw = fs.readFileSync(secPath, 'utf8');
      const reqScope = {
        canonicalPath: pathname,
        collection: colData,
        page_title: `${colData.title} — AD Perfumes`,
        section: { id: 'collection-main', settings: { products_per_page: 12 } }
      };
      const colContent = await engine.parseAndRender(secRaw, { collection: colData, ...reqScope });
      const html = await renderFullTheme(
        `<div id="shopify-section-collection-main" class="shopify-section">${colContent}</div>`,
        reqScope,
        'collection'
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(html);
      return;
    }

    // 6. ABOUT PAGE: /pages/about
    if (pathname === '/pages/about') {
      const secPath = path.resolve(root, 'sections', 'page-about.liquid');
      if (fs.existsSync(secPath)) {
        const secRaw = fs.readFileSync(secPath, 'utf8');
        const reqScope = {
          canonicalPath: '/pages/about',
          page_title: 'Our Atelier & Story — AD Perfumes (After Dreams)',
          section: { id: 'page-about', settings: {} }
        };
        const aboutContent = await engine.parseAndRender(secRaw, reqScope);
        const html = await renderFullTheme(
          `<div id="shopify-section-page-about" class="shopify-section">${aboutContent}</div>`,
          reqScope,
          'page'
        );
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(html);
        return;
      }
    }

    // 7. CONTACT PAGE: /pages/contact
    if (pathname === '/pages/contact') {
      const secPath = path.resolve(root, 'sections', 'page-contact.liquid');
      if (fs.existsSync(secPath)) {
        const secRaw = fs.readFileSync(secPath, 'utf8');
        const reqScope = {
          canonicalPath: '/pages/contact',
          page_title: 'Contact Concierge — AD Perfumes',
          section: { id: 'page-contact', settings: {} }
        };
        const contactContent = await engine.parseAndRender(secRaw, reqScope);
        const html = await renderFullTheme(
          `<div id="shopify-section-page-contact" class="shopify-section">${contactContent}</div>`,
          reqScope,
          'page'
        );
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(html);
        return;
      }
    }

    // 8. HOMEPAGE: /
    const indexData = JSON.parse(fs.readFileSync(path.resolve(root, 'templates', 'index.json'), 'utf8'));
    let layoutHtml = '';

    for (const sectionId of indexData.order) {
      const sectionConfig = indexData.sections[sectionId];
      if (!sectionConfig) continue;
      const secPath = path.resolve(root, 'sections', `${sectionConfig.type}.liquid`);
      if (!fs.existsSync(secPath)) continue;

      const blockOrder = sectionConfig.block_order || Object.keys(sectionConfig.blocks || {});
      const blocksArray = blockOrder.map(bId => ({
        id: bId,
        type: sectionConfig.blocks[bId]?.type || '',
        settings: sectionConfig.blocks[bId]?.settings || {},
        shopify_attributes: `data-block-id="${bId}"`
      }));

      const secScope = {
        section: {
          id: sectionId,
          settings: sectionConfig.settings || {},
          blocks: blocksArray
        }
      };

      const secRaw = fs.readFileSync(secPath, 'utf8');
      const renderedSec = await engine.parseAndRender(secRaw, secScope);
      layoutHtml += `<div id="shopify-section-${sectionId}" class="shopify-section">\n${renderedSec}\n</div>\n`;
    }

    const html = await renderFullTheme(layoutHtml, { canonicalPath: '/' }, 'index');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end(html);

  } catch (err) {
    console.error('Server error rendering:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server render error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  AD PERFUMES (AFTER DREAMS) - FULL MULTI-PAGE PREVIEW`);
  console.log(`  Homepage:        http://localhost:${PORT}/`);
  console.log(`  Product Pages:   http://localhost:${PORT}/products/addicted`);
  console.log(`                   http://localhost:${PORT}/products/ice-of-heaven`);
  console.log(`                   http://localhost:${PORT}/products/rouge-elite`);
  console.log(`  Cart Page:       http://localhost:${PORT}/cart`);
  console.log(`  Collections:     http://localhost:${PORT}/collections`);
  console.log(`  About Atelier:   http://localhost:${PORT}/pages/about`);
  console.log(`  Contact Page:    http://localhost:${PORT}/pages/contact`);
  console.log(`======================================================\n`);
});
