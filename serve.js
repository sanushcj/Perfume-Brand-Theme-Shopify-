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

// Ignore Liquid schema tag
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

// Shopify standard filters
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
engine.registerFilter('default_errors', v => '<div class="errors">Please review required fields</div>');

// ============================================================
// AD PERFUMES — Complete 9-Perfume Genuine Storefront Catalog
// ============================================================
const PRODUCTS = [
  // A. THE SIGNATURE COLLECTION (3 Flagship 50ml Perfumes)
  {
    id: 101,
    handle: 'addicted',
    title: 'ADDICTED',
    type: 'Extrait de Parfum • 50ml',
    price: 17500,
    compare_at_price: 21000,
    available: true,
    url: '/products/addicted',
    tags: ['signature', 'flagship', '50ml', 'woody', 'saffron'],
    featured_image: { src: '/assets/product-addicted.jpg', alt: 'ADDICTED Extrait de Parfum 50ml — AD PERFUMES' },
    images: [
      { src: '/assets/product-addicted.jpg', alt: 'ADDICTED 50ml Front View' },
      { src: '/assets/hero-perfume.jpg', alt: 'AD PERFUMES Atelier Bottle' }
    ],
    description: `Experience dark, opulent allure. This warm, sensual fragrance carries a distinctly Middle Eastern character. Deep, smoky, and resinous woods blend seamlessly with the warm, spicy, and leathery touch of saffron. A true statement piece by AD Perfumes for those who want to leave a lasting impression.`,
    options_with_values: [
      { name: 'Size', selected_value: '50ml', values: ['50ml'] }
    ],
    variants: [
      { id: 1011, title: '50ml', price: 17500, compare_at_price: 21000, available: true, options: ['50ml'] }
    ],
    selected_or_first_available_variant: { id: 1011, title: '50ml', price: 17500, compare_at_price: 21000, available: true, options: ['50ml'] }
  },
  {
    id: 102,
    handle: 'ice-of-heaven',
    title: 'Ice of Heaven',
    type: 'Extrait de Parfum • 50ml',
    price: 16000,
    compare_at_price: 0, // Tests product without compare_at_price
    available: true,
    url: '/products/ice-of-heaven',
    tags: ['signature', 'flagship', '50ml', 'aquatic', 'fresh'],
    featured_image: { src: '/assets/product-ice-of-heaven.jpg', alt: 'Ice of Heaven Extrait de Parfum 50ml — AD PERFUMES' },
    images: [
      { src: '/assets/product-ice-of-heaven.jpg', alt: 'Ice of Heaven 50ml Flacon' }
    ],
    description: `Dive into a fresh, aquatic embrace. It opens with an invigorating blast of frozen apple, lemon, bergamot, and star anise, melting into an icy marine heart with orange blossom and plum. Grounded by driftwood, moss, amber, and musk, this AD Perfumes creation is the ultimate cool refresh.`,
    options_with_values: [
      { name: 'Size', selected_value: '50ml', values: ['50ml'] }
    ],
    variants: [
      { id: 1021, title: '50ml', price: 16000, compare_at_price: 0, available: true, options: ['50ml'] }
    ],
    selected_or_first_available_variant: { id: 1021, title: '50ml', price: 16000, compare_at_price: 0, available: true, options: ['50ml'] }
  },
  {
    id: 103,
    handle: 'rouge-elite',
    title: 'Rouge Elite',
    type: 'Extrait de Parfum • 50ml',
    price: 16500,
    compare_at_price: 19500,
    available: true,
    url: '/products/rouge-elite',
    tags: ['signature', 'flagship', '50ml', 'amber', 'saffron'],
    featured_image: { src: '/assets/product-rouge-elite.jpg', alt: 'Rouge Elite Extrait de Parfum 50ml — AD PERFUMES' },
    images: [
      { src: '/assets/product-rouge-elite.jpg', alt: 'Rouge Elite 50ml Crystal Flacon' }
    ],
    description: `Discover sophisticated warmth. Bright top notes of saffron and bergamot give way to a decadent heart of amber, caramelized sugar, and soft florals. Resting on a base of cedarwood, woody amber, and musk, it’s an elegant signature scent crafted by AD Perfumes.`,
    options_with_values: [
      { name: 'Size', selected_value: '50ml', values: ['50ml'] }
    ],
    variants: [
      { id: 1031, title: '50ml', price: 16500, compare_at_price: 19500, available: true, options: ['50ml'] }
    ],
    selected_or_first_available_variant: { id: 1031, title: '50ml', price: 16500, compare_at_price: 19500, available: true, options: ['50ml'] }
  },

  // B. THE DISCOVERY COLLECTION (6 Smaller-Format Fragrances: 10ml & 20ml Variants)
  {
    id: 104,
    handle: 'purple-mist',
    title: 'Purple Mist',
    type: 'Pocket Extrait • 10ml / 20ml',
    price: 4200,
    compare_at_price: 5000,
    available: true,
    url: '/products/purple-mist',
    tags: ['discovery', 'travel', '10ml', '20ml', 'oud', 'spicy'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Purple Mist — AD PERFUMES' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Purple Mist Edition' }],
    description: `A spicy, sweet, and elegant blend. Saffron and sweet citrus open into smooth oud and warm spices, settling on a soft amber and woody base. A mysterious mist from AD Perfumes.`,
    options_with_values: [
      { name: 'Size', selected_value: '20ml', values: ['10ml', '20ml'] }
    ],
    variants: [
      { id: 1041, title: '10ml', price: 4200, compare_at_price: 5000, available: true, options: ['10ml'] },
      { id: 1042, title: '20ml', price: 6800, compare_at_price: 8200, available: true, options: ['20ml'] }
    ],
    selected_or_first_available_variant: { id: 1042, title: '20ml', price: 6800, compare_at_price: 8200, available: true, options: ['20ml'] }
  },
  {
    id: 105,
    handle: 'old-money',
    title: 'Old Money',
    type: 'Pocket Extrait • 10ml / 20ml',
    price: 4500,
    compare_at_price: 0,
    available: true,
    url: '/products/old-money',
    tags: ['discovery', 'travel', '10ml', '20ml', 'earthy', 'classic'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Old Money — AD PERFUMES' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Old Money Edition' }],
    description: `Sophisticated and earthy. Fresh green notes of fir and cypress blend into warm amber and soft incense, finishing with a rich oakmoss and vetiver base. The classic scent of success by AD Perfumes.`,
    options_with_values: [
      { name: 'Size', selected_value: '20ml', values: ['10ml', '20ml'] }
    ],
    variants: [
      { id: 1051, title: '10ml', price: 4500, compare_at_price: 0, available: true, options: ['10ml'] },
      { id: 1052, title: '20ml', price: 7200, compare_at_price: 8800, available: true, options: ['20ml'] }
    ],
    selected_or_first_available_variant: { id: 1052, title: '20ml', price: 7200, compare_at_price: 8800, available: true, options: ['20ml'] }
  },
  {
    id: 106,
    handle: 'fallen-star',
    title: 'Fallen Star',
    type: 'Pocket Extrait • 10ml / 20ml',
    price: 3900,
    compare_at_price: 4600,
    available: true,
    url: '/products/fallen-star',
    tags: ['discovery', 'travel', '10ml', '20ml', 'tea', 'citrus'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Fallen Star — AD PERFUMES' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Fallen Star Edition' }],
    description: `Clean and tea-like. Fresh bergamot and citrus sparkle above a heart of black tea, ginger, and Ceylon cinnamon, grounded by soft amber. A bright spark in the AD Perfumes collection.`,
    options_with_values: [
      { name: 'Size', selected_value: '20ml', values: ['10ml', '20ml'] }
    ],
    variants: [
      { id: 1061, title: '10ml', price: 3900, compare_at_price: 4600, available: true, options: ['10ml'] },
      { id: 1062, title: '20ml', price: 6500, compare_at_price: 7800, available: true, options: ['20ml'] }
    ],
    selected_or_first_available_variant: { id: 1062, title: '20ml', price: 6500, compare_at_price: 7800, available: true, options: ['20ml'] }
  },
  {
    id: 107,
    handle: 'coffee',
    title: 'Coffee',
    type: 'Pocket Extrait • 10ml / 20ml',
    price: 4200,
    compare_at_price: 0,
    available: true,
    url: '/products/coffee',
    tags: ['discovery', 'travel', '10ml', '20ml', 'gourmand', 'roasted'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Coffee — AD PERFUMES' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Coffee Edition' }],
    description: `A gourmand's dream. Rich, roasted, creamy, and wonderfully sweet. This warm, comforting scent by AD Perfumes is as addictive as your favorite morning brew.`,
    options_with_values: [
      { name: 'Size', selected_value: '20ml', values: ['10ml', '20ml'] }
    ],
    variants: [
      { id: 1071, title: '10ml', price: 4200, compare_at_price: 0, available: true, options: ['10ml'] },
      { id: 1072, title: '20ml', price: 6800, compare_at_price: 8200, available: true, options: ['20ml'] }
    ],
    selected_or_first_available_variant: { id: 1072, title: '20ml', price: 6800, compare_at_price: 8200, available: true, options: ['20ml'] }
  },
  {
    id: 108,
    handle: 'toxic',
    title: 'Toxic',
    type: 'Pocket Extrait • 10ml / 20ml',
    price: 4400,
    compare_at_price: 5200,
    available: true,
    url: '/products/toxic',
    tags: ['discovery', 'travel', '10ml', '20ml', 'spicy', 'tobacco'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Toxic — AD PERFUMES' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Toxic Edition' }],
    description: `Bold, spicy, and masculine. Fresh lavender and cardamom meet a rich heart of tobacco and cinnamon, resting on a warm base of vanilla and sandalwood. An intoxicating blend from AD Perfumes.`,
    options_with_values: [
      { name: 'Size', selected_value: '20ml', values: ['10ml', '20ml'] }
    ],
    variants: [
      { id: 1081, title: '10ml', price: 4400, compare_at_price: 5200, available: true, options: ['10ml'] },
      { id: 1082, title: '20ml', price: 7000, compare_at_price: 8500, available: true, options: ['20ml'] }
    ],
    selected_or_first_available_variant: { id: 1082, title: '20ml', price: 7000, compare_at_price: 8500, available: true, options: ['20ml'] }
  },
  {
    id: 109,
    handle: 'dark-chocolates',
    title: 'Dark Chocolates',
    type: 'Pocket Extrait • 10ml / 20ml',
    price: 4200,
    compare_at_price: 0,
    available: true,
    url: '/products/dark-chocolates',
    tags: ['discovery', 'travel', '10ml', '20ml', 'cocoa', 'gourmand'],
    featured_image: { src: '/assets/discovery-travel-set.jpg', alt: 'Dark Chocolates — AD PERFUMES' },
    images: [{ src: '/assets/discovery-travel-set.jpg', alt: 'Dark Chocolates Edition' }],
    description: `Rich, dark, and perfectly creamy. Bitter orange and roasted coffee melt into luxurious cocoa, hazelnut, and praline, wrapped in vanilla and tonka bean. A decadent treat by AD Perfumes.`,
    options_with_values: [
      { name: 'Size', selected_value: '20ml', values: ['10ml', '20ml'] }
    ],
    variants: [
      { id: 1091, title: '10ml', price: 4200, compare_at_price: 0, available: true, options: ['10ml'] },
      { id: 1092, title: '20ml', price: 6800, compare_at_price: 8200, available: true, options: ['20ml'] }
    ],
    selected_or_first_available_variant: { id: 1092, title: '20ml', price: 6800, compare_at_price: 8200, available: true, options: ['20ml'] }
  }
];

// In-Memory Live Cart Model
let cartState = {
  item_count: 1,
  total_price: 17500,
  currency: { iso_code: 'USD', symbol: '$' },
  note: '',
  items: [
    {
      id: 1011,
      key: '1011:key',
      variant_id: 1011,
      quantity: 1,
      price: 17500,
      original_price: 21000,
      final_price: 17500,
      final_line_price: 17500,
      url: '/products/addicted',
      title: 'ADDICTED - 50ml',
      product_title: 'ADDICTED',
      variant_title: '50ml',
      image: '/assets/product-addicted.jpg',
      product: PRODUCTS[0],
      variant: PRODUCTS[0].variants[0]
    }
  ]
};

function recalculateCart() {
  let count = 0;
  let total = 0;
  cartState.items.forEach(item => {
    count += item.quantity;
    item.final_line_price = item.price * item.quantity;
    total += item.final_line_price;
  });
  cartState.item_count = count;
  cartState.total_price = total;
}

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
      name: settings.brand_name || 'AD PERFUMES',
      description: 'Your Fragrance. Your Vision. Your Brand.',
      customer_accounts_enabled: true,
      policies: [
        { title: 'Privacy Policy', url: '#' },
        { title: 'Terms of Service', url: '#' },
        { title: 'Refund Policy', url: '#' },
        { title: 'Shipping Policy', url: '#' }
      ]
    },
    settings: settings,
    routes: {
      root_url: '/',
      collections_url: '/collections',
      all_products_collection_url: '/collections/all',
      search_url: '/search',
      cart_url: '/cart',
      cart_add_url: '/cart/add',
      cart_change_url: '/cart/change',
      cart_clear_url: '/cart/clear',
      checkout_url: '/checkout',
      account_url: '/account'
    },
    request: {
      locale: { iso_code: 'en' },
      page_type: templateName
    },
    canonical_url: 'http://localhost:3000' + reqScope.canonicalPath,
    page_title: reqScope.page_title || 'AD PERFUMES — Your Fragrance. Your Vision. Your Brand.',
    page_description: reqScope.page_description || 'AD PERFUMES — Premium Haute Parfumerie.',
    template: {
      name: templateName,
      suffix: ''
    },
    cart: cartState,
    linklists: {
      'main-menu': {
        links: [
          { url: '/', title: 'Home', active: templateName === 'index' },
          { url: '/collections/all', title: 'All Fragrances', active: templateName === 'collection' },
          { url: '/collections/the-signature-collection', title: 'Signature 50ml', active: false },
          { url: '/collections/the-discovery-collection', title: 'Discovery Editions', active: false },
          { url: '/pages/about', title: 'About Atelier', active: false },
          { url: '/pages/contact', title: 'Contact Concierge', active: false }
        ]
      },
      footer: {
        links: [
          { url: '/collections/all', title: 'All Fragrances' },
          { url: '/collections/the-signature-collection', title: 'The Signature Collection (50ml)' },
          { url: '/collections/the-discovery-collection', title: 'The Discovery Collection (10ml & 20ml)' },
          { url: '/search', title: 'Search Fragrances' }
        ]
      }
    },
    pages: {
      about: { url: '/pages/about' },
      contact: { url: '/pages/contact' },
      'business-services': { url: '/pages/business-services' }
    },
    collections: {
      all: {
        title: 'All Fragrances — AD PERFUMES',
        description: 'Discover the full portfolio of AD PERFUMES — from our 50ml Signature Flagship extraits to versatile 10ml & 20ml Discovery editions.',
        products_count: PRODUCTS.length,
        products: PRODUCTS,
        url: '/collections/all',
        default_sort_by: 'manual',
        sort_by: 'manual',
        sort_options: [
          { value: 'manual', name: 'Featured' },
          { value: 'price-ascending', name: 'Price: Low to High' },
          { value: 'price-descending', name: 'Price: High to Low' },
          { value: 'title-ascending', name: 'Alphabetical: A-Z' }
        ],
        filters: []
      },
      'the-signature-collection': {
        title: 'The Signature Collection',
        description: 'Our three flagship creations: ADDICTED, Ice of Heaven, and Rouge Elite. Deep, warm woods, icy marine accords, and decadent caramelized ambers in 50ml flacons.',
        products_count: 3,
        products: PRODUCTS.slice(0, 3),
        url: '/collections/the-signature-collection',
        default_sort_by: 'manual',
        sort_by: 'manual',
        sort_options: [
          { value: 'manual', name: 'Featured' },
          { value: 'price-ascending', name: 'Price: Low to High' },
          { value: 'price-descending', name: 'Price: High to Low' }
        ],
        filters: []
      },
      'the-discovery-collection': {
        title: 'The Discovery Collection',
        description: 'Six versatile smaller-format scents: Purple Mist, Old Money, Fallen Star, Coffee, Toxic, and Dark Chocolates. Designed for effortless travel, pocket portability, and everyday discovery.',
        products_count: 6,
        products: PRODUCTS.slice(3),
        url: '/collections/the-discovery-collection',
        default_sort_by: 'manual',
        sort_by: 'manual',
        sort_options: [
          { value: 'manual', name: 'Featured' },
          { value: 'price-ascending', name: 'Price: Low to High' },
          { value: 'price-descending', name: 'Price: High to Low' }
        ],
        filters: []
      }
    },
    ...reqScope
  };

  globalScope.content_for_header = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
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

  // 2. Real Shopify AJAX Cart API Endpoints
  if (pathname === '/cart/add' || pathname === '/cart/add.js') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const variantId = parseInt(payload.id, 10);
        const qty = parseInt(payload.quantity, 10) || 1;

        // Find variant in product catalogue
        let foundProduct = null;
        let foundVariant = null;
        for (const p of PRODUCTS) {
          const v = p.variants.find(vr => vr.id === variantId);
          if (v) {
            foundProduct = p;
            foundVariant = v;
            break;
          }
        }

        if (!foundProduct) {
          // Fallback to first variant if needed
          foundProduct = PRODUCTS[0];
          foundVariant = PRODUCTS[0].variants[0];
        }

        const existingItem = cartState.items.find(it => it.variant_id === foundVariant.id);
        if (existingItem) {
          existingItem.quantity += qty;
        } else {
          cartState.items.push({
            id: foundVariant.id,
            key: `${foundVariant.id}:key`,
            variant_id: foundVariant.id,
            quantity: qty,
            price: foundVariant.price,
            original_price: foundVariant.compare_at_price || foundVariant.price,
            final_price: foundVariant.price,
            final_line_price: foundVariant.price * qty,
            url: foundProduct.url,
            title: `${foundProduct.title} - ${foundVariant.title}`,
            product_title: foundProduct.title,
            variant_title: foundVariant.title,
            image: foundProduct.featured_image.src,
            product: foundProduct,
            variant: foundVariant
          });
        }

        recalculateCart();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cartState.items[cartState.items.length - 1]));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 400, message: 'Invalid cart payload' }));
      }
    });
    return;
  }

  if (pathname === '/cart/change' || pathname === '/cart/change.js') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const id = String(payload.id);
        const newQty = parseInt(payload.quantity, 10);

        const itemIndex = cartState.items.findIndex(it => String(it.key) === id || String(it.id) === id || String(it.variant_id) === id);
        if (itemIndex > -1) {
          if (newQty <= 0) {
            cartState.items.splice(itemIndex, 1);
          } else {
            cartState.items[itemIndex].quantity = newQty;
          }
        }
        recalculateCart();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cartState));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 400, message: 'Invalid change payload' }));
      }
    });
    return;
  }

  if (pathname === '/cart.js') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cartState));
    return;
  }

  if (pathname === '/cart/update.js') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (payload.note !== undefined) cartState.note = payload.note;
        recalculateCart();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cartState));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cartState));
      }
    });
    return;
  }

  // 3. Checkout Route: Confirms Shopify Checkout Hand-off
  if (pathname === '/checkout') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shopify Checkout — AD PERFUMES</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #0e0e10; color: #fff; padding: 4rem 2rem; text-align: center; }
          .card { max-width: 600px; margin: 0 auto; background: #16191f; border: 1px solid #c5a059; border-radius: 16px; padding: 3rem 2rem; }
          h1 { color: #c5a059; margin-bottom: 1rem; }
          p { color: #838b96; line-height: 1.6; }
          .btn { display: inline-block; margin-top: 2rem; background: #c5a059; color: #000; padding: 0.8rem 1.8rem; border-radius: 8px; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Shopify Checkout Connected</h1>
          <p>This is the verified entry point to Shopify's native checkout route (<strong>/checkout</strong>).</p>
          <p>In your live Shopify store, customer orders, payment gateways (Cards, UPI, etc.), regional taxes, and delivery methods are securely processed directly by Shopify.</p>
          <a href="/cart" class="btn">Return to Shopping Bag</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    // 4. PRODUCT VIEW PAGE: /products/:handle
    if (pathname.startsWith('/products/')) {
      const handle = pathname.replace('/products/', '');
      const product = PRODUCTS.find(p => p.handle === handle) || PRODUCTS[0];
      const secPath = path.resolve(root, 'sections', 'product-main.liquid');
      const secRaw = fs.readFileSync(secPath, 'utf8');

      const reqScope = {
        canonicalPath: pathname,
        product: product,
        page_title: `${product.title} — AD PERFUMES`,
        page_description: product.description.slice(0, 150),
        section: {
          id: 'product-main',
          settings: { show_care_tab: true, show_delivery_tab: true }
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

    // 5. CART PAGE: /cart
    if (pathname === '/cart') {
      const secPath = path.resolve(root, 'sections', 'cart-main.liquid');
      const secRaw = fs.readFileSync(secPath, 'utf8');
      const reqScope = {
        canonicalPath: '/cart',
        cart: cartState,
        page_title: 'Your Shopping Bag — AD PERFUMES',
        section: { id: 'cart-main', settings: { show_notes: true } }
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

    // 6. COLLECTIONS: /collections or /collections/:handle
    if (pathname.startsWith('/collections')) {
      let handle = pathname.replace('/collections', '').replace('/', '');
      if (!handle || handle === 'all') handle = 'all';

      let colData;
      if (handle === 'the-signature-collection' || handle === 'signature' || handle === 'flagship') {
        colData = {
          title: 'The Signature Collection',
          description: 'Our three flagship creations: ADDICTED, Ice of Heaven, and Rouge Elite in 50ml statement flacons.',
          products_count: 3,
          products: PRODUCTS.slice(0, 3),
          url: '/collections/the-signature-collection',
          filters: []
        };
      } else if (handle === 'the-discovery-collection' || handle === 'discovery' || handle === 'travel') {
        colData = {
          title: 'The Discovery Collection',
          description: 'Six versatile smaller-format scents: Purple Mist, Old Money, Fallen Star, Coffee, Toxic, and Dark Chocolates in 10ml and 20ml editions.',
          products_count: 6,
          products: PRODUCTS.slice(3),
          url: '/collections/the-discovery-collection',
          filters: []
        };
      } else {
        colData = {
          title: 'All Fragrances — AD PERFUMES',
          description: 'Explore the full portfolio of artisanal fragrances by AD PERFUMES.',
          products_count: PRODUCTS.length,
          products: PRODUCTS,
          url: '/collections/all',
          filters: []
        };
      }

      const secPath = path.resolve(root, 'sections', 'collection-main.liquid');
      const secRaw = fs.readFileSync(secPath, 'utf8').replace(/\{%-?\s*paginate[\s\S]*?%\}|\{%-?\s*endpaginate\s*-?%\}/g, '');
      const reqScope = {
        canonicalPath: pathname,
        collection: colData,
        page_title: `${colData.title} — AD PERFUMES`,
        section: { id: 'collection-main', settings: { products_per_page: 18, enable_filtering: true, enable_sorting: true } }
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

    // 7. SEARCH PAGE: /search
    if (pathname.startsWith('/search')) {
      const q = parsedUrl.searchParams.get('q') || '';
      const matched = q ? PRODUCTS.filter(p => p.title.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase())) : [];

      const searchObj = {
        performed: Boolean(q),
        terms: q,
        results_count: matched.length,
        results: matched.map(p => ({ ...p, object_type: 'product' }))
      };

      const secPath = path.resolve(root, 'sections', 'search-main.liquid');
      const secRaw = fs.readFileSync(secPath, 'utf8').replace(/\{%-?\s*paginate[\s\S]*?%\}|\{%-?\s*endpaginate\s*-?%\}/g, '');
      const reqScope = {
        canonicalPath: '/search',
        search: searchObj,
        page_title: `Search: ${q || 'Fragrances'} — AD PERFUMES`,
        section: { id: 'search-main', settings: {} }
      };
      const searchContent = await engine.parseAndRender(secRaw, { search: searchObj, ...reqScope });
      const html = await renderFullTheme(
        `<div id="shopify-section-search-main" class="shopify-section">${searchContent}</div>`,
        reqScope,
        'search'
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(html);
      return;
    }

    // 8. ABOUT PAGE: /pages/about
    if (pathname === '/pages/about') {
      const secPath = path.resolve(root, 'sections', 'page-about.liquid');
      if (fs.existsSync(secPath)) {
        const secRaw = fs.readFileSync(secPath, 'utf8');
        const reqScope = {
          canonicalPath: '/pages/about',
          page_title: 'The World of AD PERFUMES — About Atelier',
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

    // 9. CONTACT PAGE: /pages/contact
    if (pathname === '/pages/contact') {
      const secPath = path.resolve(root, 'sections', 'page-contact.liquid');
      if (fs.existsSync(secPath)) {
        const secRaw = fs.readFileSync(secPath, 'utf8');
        const reqScope = {
          canonicalPath: '/pages/contact',
          page_title: 'Connect with AD PERFUMES — Concierge',
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

    // 10. BUSINESS & BRANDING SOLUTIONS: /pages/business-services
    if (pathname === '/pages/business-services') {
      const secPath = path.resolve(root, 'sections', 'page-business.liquid');
      if (fs.existsSync(secPath)) {
        const secRaw = fs.readFileSync(secPath, 'utf8');
        const reqScope = {
          canonicalPath: '/pages/business-services',
          page_title: 'AD PERFUMES — Premium Fragrance & Branding Solutions',
          section: { id: 'page-business', settings: {} }
        };
        const bizContent = await engine.parseAndRender(secRaw, reqScope);
        const html = await renderFullTheme(
          `<div id="shopify-section-page-business" class="shopify-section">${bizContent}</div>`,
          reqScope,
          'page'
        );
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(html);
        return;
      }
    }

    // 11. HOMEPAGE: /
    if (pathname === '/') {
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
      return;
    }

    // 12. 404 FALLBACK
    const sec404Path = path.resolve(root, 'sections', 'page-404.liquid');
    const sec404Raw = fs.existsSync(sec404Path) ? fs.readFileSync(sec404Path, 'utf8') : '<h1>404 Not Found</h1>';
    const reqScope = {
      canonicalPath: pathname,
      page_title: '404 Page Not Found — AD PERFUMES',
      section: { id: 'page-404', settings: {} }
    };
    const content404 = await engine.parseAndRender(sec404Raw, reqScope);
    const html = await renderFullTheme(
      `<div id="shopify-section-page-404" class="shopify-section">${content404}</div>`,
      reqScope,
      '404'
    );
    res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end(html);

  } catch (err) {
    console.error('Server error rendering:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server render error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  AD PERFUMES (V3.0) — SHOPIFY REBUILD PREVIEW ACTIVE`);
  console.log(`  Homepage:            http://localhost:${PORT}/`);
  console.log(`  Signature (50ml):    http://localhost:${PORT}/collections/the-signature-collection`);
  console.log(`  Discovery (10/20ml): http://localhost:${PORT}/collections/the-discovery-collection`);
  console.log(`  Product (ADDICTED):  http://localhost:${PORT}/products/addicted`);
  console.log(`  Product (Purple):    http://localhost:${PORT}/products/purple-mist`);
  console.log(`  Cart Page:           http://localhost:${PORT}/cart`);
  console.log(`  Search Page:         http://localhost:${PORT}/search?q=saffron`);
  console.log(`  Contact Page:        http://localhost:${PORT}/pages/contact`);
  console.log(`  Business Services:   http://localhost:${PORT}/pages/business-services`);
  console.log(`======================================================\n`);
});
