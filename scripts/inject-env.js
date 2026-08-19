const fs = require('fs');
const path = require('path');

const distRoot = path.join(__dirname, '../dist/db-diagram/browser');
// TEMP DEBUG — remove once fixed
console.log('=== Contents of dist/db-diagram ===');
console.log(JSON.stringify(fs.readdirSync(distRoot, { recursive: true }), null, 2));
console.log('====================================');

const envName = process.env.ENV_NAME || 'production';
const apiUrl = process.env.API_URL;

if (!apiUrl) {
    console.error('API_URL environment variable is not set — skipping injection.');
    process.exit(1);
}

const configPath = path.join(distRoot, `assets/config/config.${envName}.json`);

if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
}

let content = fs.readFileSync(configPath, 'utf-8');
content = content.replaceAll('API_URL', apiUrl);
fs.writeFileSync(configPath, content);

console.log(`Injected API_URL (${apiUrl}) into config.${envName}.json`);