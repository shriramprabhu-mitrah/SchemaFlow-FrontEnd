const fs = require('fs');
const path = require('path');

const distRoot = path.join(__dirname, '../dist/db-diagram');
const iisFolder = path.join(__dirname, '../iis');

if (!fs.existsSync(distRoot)) {
  console.error(`Error: Output directory not found at ${distRoot}. Make sure ng build completed first.`);
  process.exit(1);
}

// 1. Copy web.config to distRoot
const webConfigSrc = path.join(iisFolder, 'web.config');
const webConfigDest = path.join(distRoot, 'web.config');
if (fs.existsSync(webConfigSrc)) {
  fs.copyFileSync(webConfigSrc, webConfigDest);
  console.log('✔ Copied web.config to dist/db-diagram/');
}

// 2. Copy server_entry.js to distRoot
const serverEntrySrc = path.join(iisFolder, 'server_entry.js');
const serverEntryDest = path.join(distRoot, 'server_entry.js');
if (fs.existsSync(serverEntrySrc)) {
  fs.copyFileSync(serverEntrySrc, serverEntryDest);
  console.log('✔ Copied server_entry.js to dist/db-diagram/');
}

// 3. If API_URL is provided, inject it into config.<envName>.json
const targetEnv = process.argv[2] || 'iis';
const apiUrl = process.env.API_URL;
if (apiUrl) {
  const configPath = path.join(distRoot, 'browser', 'assets', 'config', `config.${targetEnv}.json`);
  if (fs.existsSync(configPath)) {
    let content = fs.readFileSync(configPath, 'utf-8');
    content = content.replaceAll('API_URL', apiUrl);
    content = content.replaceAll('http://localhost:3000', apiUrl);
    content = content.replaceAll('http://192.168.1.201:3000', apiUrl);
    content = content.replaceAll('http://192.168.1.201:3001', apiUrl);
    fs.writeFileSync(configPath, content);
    console.log(`✔ Injected API_URL (${apiUrl}) into config.${targetEnv}.json`);
  }
}

console.log(`\n✅ IIS [${targetEnv}] Build ready at dist/db-diagram/ with web.config & server_entry.js`);
