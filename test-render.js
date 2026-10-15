const { Liquid } = require('liquidjs');
const fs = require('fs');
const path = require('path');

const engine = new Liquid({
  root: [
    path.resolve(__dirname, 'layout'),
    path.resolve(__dirname, 'sections'),
    path.resolve(__dirname, 'snippets'),
    path.resolve(__dirname, 'templates')
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
  render: function() {
    return '';
  }
});

// Custom section tag
engine.registerTag('section', {
  parse: function(tagToken) {
    this.sectionName = tagToken.args.trim().replace(/^['"]|['"]$/g, '');
  },
  render: async function(scope) {
    const secPath = path.resolve(__dirname, 'sections', `${this.sectionName}.liquid`);
    if (!fs.existsSync(secPath)) return `<!-- Missing section: ${this.sectionName} -->`;
    
    // Read template index.json settings if available
    let secSettings = {};
    let secBlocks = {};
    let blockOrder = [];
    try {
      const indexJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'templates', 'index.json'), 'utf8'));
      if (indexJson.sections && indexJson.sections[this.sectionName]) {
        secSettings = indexJson.sections[this.sectionName].settings || {};
        secBlocks = indexJson.sections[this.sectionName].blocks || {};
        blockOrder = indexJson.sections[this.sectionName].block_order || Object.keys(secBlocks);
      }
    } catch(e) {}

    const blocksArray = blockOrder.map((id, index) => ({
      id,
      type: secBlocks[id]?.type || '',
      settings: secBlocks[id]?.settings || {},
      shopify_attributes: `data-block-id="${id}"`
    }));

    const sectionContext = {
      id: this.sectionName,
      settings: secSettings,
      blocks: blocksArray
    };

    const sectionContent = fs.readFileSync(secPath, 'utf8');
    const childScope = Object.create(scope.getAll());
    childScope.section = sectionContext;
    return await engine.parseAndRender(sectionContent, childScope);
  }
});

// Custom style and javascript tags
engine.registerTag('style', {
  parse: function(tagToken, remainTokens) {
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endstyle') break;
      this.tokens.push(token.raw);
    }
  },
  render: function() {
    return `<style>${this.tokens.join('')}</style>`;
  }
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
  render: function() {
    return `<script>${this.tokens.join('')}</script>`;
  }
});

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

// Shopify filters
engine.registerFilter('asset_url', v => `/assets/${v}`);
engine.registerFilter('stylesheet_tag', v => `<link rel="stylesheet" href="${v}">`);
engine.registerFilter('script_tag', v => `<script src="${v}"></script>`);
engine.registerFilter('image_url', (v, ...args) => {
  if (typeof v === 'string') {
    if (v.startsWith('/') || v.startsWith('http')) return v;
    return `/assets/${v}`;
  }
  return '/assets/product-addicted.jpg';
});
engine.registerFilter('money', v => typeof v === 'number' ? `$${(v/100).toFixed(2)}` : (v || '$175.00'));
engine.registerFilter('money_without_currency', v => typeof v === 'number' ? (v/100).toFixed(2) : (v || '175.00'));
engine.registerFilter('handleize', v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));

async function test() {
  const indexData = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'templates', 'index.json'), 'utf8'));
  const settingsData = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config', 'settings_data.json'), 'utf8')).current || {};

  console.log('Testing render of index sections:');
  for (const secId of indexData.order) {
    const secDef = indexData.sections[secId];
    console.log(`- Rendering section: ${secId} (type: ${secDef.type})`);
  }
}

test();
