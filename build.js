// build.js - Production Build Script for MAI Services Marketplace
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const CLIENT_PUBLIC_DIR = path.join(ROOT_DIR, 'client', 'public');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('==================================================');
console.log('BUILDING PRODUCTION DIST: MAI Services Marketplace');
console.log('==================================================\n');

// 1. Ensure source files exist
if (!fs.existsSync(CLIENT_PUBLIC_DIR)) {
  console.error(`[ERROR] Source directory not found: ${CLIENT_PUBLIC_DIR}`);
  process.exit(1);
}

// 2. Clean or Create dist/ directory
if (fs.existsSync(DIST_DIR)) {
  console.log('[CLEAN] Removing previous dist/ directory...');
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });
console.log(`[INIT] Created fresh dist/ directory at: ${DIST_DIR}`);

// 2b. Generate client/public/initial-data.js from server/data/db.json for instant rendering
const dbFilePath = path.join(ROOT_DIR, 'server', 'data', 'db.json');
if (fs.existsSync(dbFilePath)) {
  try {
    const dbData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
    const initialPayload = {
      categories: dbData.categories || [],
      subcategories: dbData.subcategories || [],
      services: dbData.services || [],
      professionals: dbData.professionals || []
    };
    const initialDataContent = `// Pre-hydrated marketplace data from authoritative database\nwindow.__MAI_INITIAL_DATA__ = ${JSON.stringify(initialPayload, null, 2)};\n`;
    fs.writeFileSync(path.join(CLIENT_PUBLIC_DIR, 'initial-data.js'), initialDataContent, 'utf8');
    console.log('[HYDRATE] Generated client/public/initial-data.js from db.json');
  } catch (err) {
    console.warn('[WARN] Could not generate initial-data.js:', err.message);
  }
}

// Helper: Copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      const stats = fs.statSync(destPath);
      console.log(`[EMIT] dist/${path.relative(DIST_DIR, destPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
    }
  }
}

// 3. Copy all client public files to dist/
console.log('\n[COPY] Copying frontend assets from client/public to dist/ ...');
copyDirSync(CLIENT_PUBLIC_DIR, DIST_DIR);

// Ensure assets directory exists in dist/
const distAssetsDir = path.join(DIST_DIR, 'assets');
if (!fs.existsSync(distAssetsDir)) {
  fs.mkdirSync(distAssetsDir, { recursive: true });
  console.log('[EMIT] dist/assets/ (directory created)');
}

// Ensure API proxy and SPA fallback _redirects exists in dist/
const redirectsFile = path.join(DIST_DIR, '_redirects');
fs.writeFileSync(redirectsFile, '/api/*    /.netlify/functions/api/:splat    200!\n/*        /index.html                       200\n', 'utf8');
console.log('[EMIT] dist/_redirects (configured Netlify function proxy & SPA fallback)');

// 4. Inject Dynamic Cache-Buster Build ID into dist/index.html
const buildHash = 'v' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
const indexPath = path.join(DIST_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
  let htmlContent = fs.readFileSync(indexPath, 'utf8');
  htmlContent = htmlContent.replace(/initial-data\.js(\?v=[^"']*)?/g, `initial-data.js?v=${buildHash}`);
  htmlContent = htmlContent.replace(/dashboard-components\.js(\?v=[^"']*)?/g, `dashboard-components.js?v=${buildHash}`);
  htmlContent = htmlContent.replace(/app\.js(\?v=[^"']*)?/g, `app.js?v=${buildHash}`);
  htmlContent = htmlContent.replace(/content="[^"]*"\s+name="mai-build-version"/g, `name="mai-build-version" content="${buildHash}"`);
  fs.writeFileSync(indexPath, htmlContent, 'utf8');
  console.log(`\n[CACHE-BUST] Injected unique cache buster into dist/index.html: ?v=${buildHash}`);
}

// 5. Verify Critical Production Files in dist/
console.log('\n[VERIFY] Validating production build output...');
const criticalFiles = ['index.html', 'initial-data.js', 'app.js', 'dashboard-components.js', '_redirects'];
let buildOk = true;

criticalFiles.forEach(file => {
  const target = path.join(DIST_DIR, file);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    const stats = fs.statSync(target);
    console.log(`  ✓ dist/${file} verified (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.error(`  ✗ Missing or empty critical file: dist/${file}`);
    buildOk = false;
  }
});

// 6. Verify All 31 Required React Components in dist/
const code1 = fs.readFileSync(path.join(DIST_DIR, 'dashboard-components.js'), 'utf8');
const code2 = fs.readFileSync(path.join(DIST_DIR, 'app.js'), 'utf8');
const bundleCode = code1 + '\n' + code2;

const reqs = [
  'Header', 'HomePage', 'CategoriesPage', 'ServiceListingPage', 'ProfessionalsPage',
  'ServiceDetailPage', 'ProfessionalProfilePage', 'ExplorePage', 'ExploreDetailPage',
  'Footer', 'DashboardLayout', 'Sidebar', 'DashboardHeader', 'ClientDashboardHome',
  'MyBookingsPage', 'PaymentsPage', 'MessagesPage', 'SavedProfilesPage', 'SettingsPage',
  'UserProfilePage', 'ProfessionalDashboard', 'BookingModal', 'BookingDetailModal',
  'InvoiceModal', 'ChatModal', 'ReviewModal', 'PostRequirementModal', 'BecomeProModal',
  'CreateServiceModal', 'RescheduleModal', 'AuthModal'
];

let componentsOk = true;
reqs.forEach(c => {
  const found = bundleCode.includes('function ' + c) || bundleCode.includes('const ' + c + ' =') || bundleCode.includes('function ' + c + '(');
  if (!found) {
    console.error(`  ✗ [MISSING COMPONENT] ${c}`);
    componentsOk = false;
  }
});

if (componentsOk) {
  console.log(`  ✓ All ${reqs.length} required React components verified in dist bundle.`);
} else {
  buildOk = false;
}

// 7. Final Result
if (buildOk) {
  console.log('\n==================================================');
  console.log('✓ BUILD SUCCESSFUL!');
  console.log(`✓ Production output ready at: ${DIST_DIR}`);
  console.log(`✓ Entry point: ${path.join(DIST_DIR, 'index.html')}`);
  console.log(`✓ SPA Redirects: ${path.join(DIST_DIR, '_redirects')}`);
  console.log('==================================================');
  process.exit(0);
} else {
  console.error('\n✗ BUILD FAILED: Check errors above.');
  process.exit(1);
}
