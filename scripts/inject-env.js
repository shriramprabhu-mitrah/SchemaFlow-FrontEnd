const fs = require('fs');
const path = require('path');

const envName = process.env.ENV_NAME || 'production';
const apiUrl = process.env.API_URL;

if (!apiUrl) {
    process.exit(0);
}

// Check both possible Angular output paths (browser subfolder vs root)
const possibleRoots = [
    path.join(__dirname, '../dist/db-diagram/browser'),
    path.join(__dirname, '../dist/db-diagram')
];

let injected = false;
for (const distRoot of possibleRoots) {
    const configPath = path.join(distRoot, 'assets', 'config', `config.${envName}.json`);
    if (fs.existsSync(configPath)) {
        let content = fs.readFileSync(configPath, 'utf-8');
        content = content.replaceAll('API_URL', apiUrl);
        fs.writeFileSync(configPath, content);
        injected = true;
    }
}

if (!injected) {
    console.warn(`Warning: Could not find config.${envName}.json in expected dist paths, skipping.`);
}