const fs = require('fs');
const path = require('path');

const root = __dirname;

console.log('--- CHECKING JSON FILES ---');
function checkJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    console.log(`[OK] JSON: ${path.relative(root, filePath)}`);
  } catch (err) {
    console.error(`[ERROR] JSON parse error in ${path.relative(root, filePath)}:`, err.message);
  }
}

function walkDir(dir, cb) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      walkDir(full, cb);
    } else {
      cb(full);
    }
  }
}

walkDir(path.join(root, 'config'), f => f.endsWith('.json') && checkJson(f));
walkDir(path.join(root, 'locales'), f => f.endsWith('.json') && checkJson(f));
walkDir(path.join(root, 'templates'), f => f.endsWith('.json') && checkJson(f));

console.log('\n--- CHECKING LIQUID SCHEMAS & TAGS ---');
const pairedTags = [
  ['{% if', '{% endif %}'],
  ['{% unless', '{% endunless %}'],
  ['{% for', '{% endfor %}'],
  ['{% case', '{% endcase %}'],
  ['{% form', '{% endform %}'],
  ['{% paginate', '{% endpaginate %}'],
  ['{% comment', '{% endcomment %}'],
  ['{% capture', '{% endcapture %}'],
  ['{% raw', '{% endraw %}'],
  ['{% style', '{% endstyle %}'],
  ['{% javascript', '{% endjavascript %}'],
  ['{% schema', '{% endschema %}'],
];

walkDir(root, f => {
  if (!f.endsWith('.liquid')) return;
  const rel = path.relative(root, f);
  const content = fs.readFileSync(f, 'utf8');

  // Check Schema JSON
  const schemaMatch = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (schemaMatch) {
    try {
      JSON.parse(schemaMatch[1]);
      console.log(`[OK] Schema in: ${rel}`);
    } catch (err) {
      console.error(`[ERROR] Invalid schema in ${rel}:`, err.message);
    }
  }

  // Check paired tags
  for (const [openPrefix, closeTag] of pairedTags) {
    const openCount = (content.match(new RegExp(openPrefix.replace(/\{/g, '\\{').replace(/%/g, '\\%'), 'g')) || []).length;
    const closeCount = (content.match(new RegExp(closeTag.replace(/\{/g, '\\{').replace(/%/g, '\\%').replace(/\}/g, '\\}'), 'g')) || []).length;
    if (openCount !== closeCount) {
      console.error(`[TAG MISMATCH] ${rel}: ${openPrefix} (${openCount}) vs ${closeTag} (${closeCount})`);
    }
  }

  // Check for broken braces: {{ without }} or {% without %}
  // basic check
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Check if line has unclosed {{ or {% that doesn't span lines or has typos
    // (Liquid tags can span lines occasionally, but let's see)
  });
});

console.log('\n--- CHECKING TEMPLATE SECTION REFERENCES ---');
const templatesDir = path.join(root, 'templates');
const sectionsDir = path.join(root, 'sections');
const availableSections = new Set(fs.readdirSync(sectionsDir).map(s => s.replace(/\.liquid$/, '')));

fs.readdirSync(templatesDir).forEach(t => {
  if (!t.endsWith('.json')) return;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(templatesDir, t), 'utf8'));
    if (data.sections) {
      for (const [key, val] of Object.entries(data.sections)) {
        if (val.type && !availableSections.has(val.type)) {
          console.error(`[MISSING SECTION] Template ${t} references section type "${val.type}" (id: ${key}), which does not exist in /sections/`);
        }
      }
    }
  } catch (e) {}
});

console.log('\n--- CHECKING SNIPPET REFERENCES ---');
const snippetsDir = path.join(root, 'snippets');
const availableSnippets = new Set(fs.existsSync(snippetsDir) ? fs.readdirSync(snippetsDir).map(s => s.replace(/\.liquid$/, '')) : []);

walkDir(root, f => {
  if (!f.endsWith('.liquid')) return;
  const rel = path.relative(root, f);
  const content = fs.readFileSync(f, 'utf8');
  const renderMatches = [...content.matchAll(/\{%\s*(?:render|include)\s+['"]([^'"]+)['"]/g)];
  for (const m of renderMatches) {
    const snip = m[1];
    if (!availableSnippets.has(snip)) {
      console.error(`[MISSING SNIPPET] In ${rel}: referenced '${snip}' which does not exist in /snippets/`);
    }
  }
});
