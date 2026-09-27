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

// 4. Ensure Angular SSR App Engine Manifest is set in server chunks (both minified and unminified)
const serverDir = path.join(distRoot, 'server');
if (fs.existsSync(serverDir)) {
  const defaultManifestCode = ` = { basePath: '/', allowedHosts: [], supportedLocales: { 'en-US': '' }, entryPoints: { '': () => import('./main.server.mjs') } };`;
  const files = fs.readdirSync(serverDir);
  for (const file of files) {
    if (file.endsWith('.mjs')) {
      const filePath = path.join(serverDir, file);
      let content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('Angular app engine manifest is not set')) {
        // Match both minified (e.g., "var yf;function Dx(){if(!yf)throw...") and unminified
        const match = content.match(/if\s*\(!([a-zA-Z0-9_$]+)\)\s*throw\s+new\s+Error\([^)]*Angular app engine manifest is not set/);
        if (match && match[1]) {
          const varName = match[1];
          // Check if already initialized
          const isInitialized = new RegExp(`(?:var|let|const)\\s+${varName}\\s*=`).test(content);
          if (!isInitialized) {
            // Replace "var varName;" or "let varName;" with initialization
            const declRegex = new RegExp(`(?:var|let)\\s+${varName};`);
            if (declRegex.test(content)) {
              content = content.replace(declRegex, `var ${varName}${defaultManifestCode}`);
              fs.writeFileSync(filePath, content);
              console.log(`✔ Initialized manifest variable '${varName}' in server/${file}`);
            }
          }
        }
      }
    }
  }
}

// 5. Run generate-startup.js to ensure server.mjs header patch is applied
const generateStartupPath = path.join(__dirname, 'generate-startup.js');
if (fs.existsSync(generateStartupPath)) {
  require('./generate-startup.js');
}

console.log(`\n✅ IIS [${targetEnv}] Build ready at dist/db-diagram/ with web.config & server_entry.js`);

