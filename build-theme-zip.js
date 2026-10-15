const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const themeDir = __dirname;
const outputFiles = [
  path.resolve(themeDir, '..', 'ad-perfumes-shopify-theme.zip'),
  path.resolve('C:\\Users\\sanus\\Desktop', 'ad-perfumes-shopify-theme.zip')
];

const targetDirs = [
  'assets',
  'config',
  'layout',
  'locales',
  'sections',
  'snippets',
  'templates'
];

async function createZip(outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      console.log(`[SUCCESS] Created ${outputPath} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Recursively walk and append files with POSIX forward slashes
    for (const dir of targetDirs) {
      const fullDirPath = path.join(themeDir, dir);
      if (!fs.existsSync(fullDirPath)) continue;

      function walk(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            // Compute relative path from themeDir and convert all backslashes to forward slashes!
            const relPath = path.relative(themeDir, fullPath).replace(/\\/g, '/');
            archive.file(fullPath, { name: relPath });
          }
        }
      }

      walk(fullDirPath);
    }

    archive.finalize();
  });
}

async function run() {
  console.log('Building Shopify Theme ZIP...');
  for (const outPath of outputFiles) {
    try {
      await createZip(outPath);
    } catch (e) {
      console.error(`Failed to create ${outPath}:`, e.message);
    }
  }
}

run();
