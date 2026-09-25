// Playwright finden: lokal installiert, sonst die vorinstallierte Kopie der
// Cloud-Umgebung (/opt/node22). Chromium liegt dort unter PLAYWRIGHT_BROWSERS_PATH.
try { module.exports = require('playwright'); }
catch (e) { module.exports = require('/opt/node22/lib/node_modules/playwright'); }
