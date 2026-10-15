const fs = require('fs');
const path = require('path');

const envName = process.env.ENV_NAME || 'production';
const apiUrl = process.env.API_URL;
const gaMeasurementId =
    process.env.googleAnalyticsMeasurementId ||
    process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID;
const gaProtocolSecret =
    process.env.googleAnalyticsMeasurementProtocolSecret ||
    process.env.GOOGLE_ANALYTICS_MEASUREMENT_PROTOCOL_SECRET;

// Check both possible Angular output paths (browser subfolder vs root)
const possibleRoots = [
    path.join(__dirname, '../dist/db-diagram/browser'),
    path.join(__dirname, '../dist/db-diagram')
];

let injected = false;
const sanitizedApiUrl = apiUrl ? apiUrl.replace(/\/+$/, '') : null;

for (const distRoot of possibleRoots) {
    const configPath = path.join(distRoot, 'assets', 'config', `config.${envName}.json`);
    if (fs.existsSync(configPath)) {
        let content = fs.readFileSync(configPath, 'utf-8');
        if (sanitizedApiUrl) {
            content = content.replaceAll('API_URL', sanitizedApiUrl);
        }
        try {
            const configObj = JSON.parse(content);
            if (gaMeasurementId) {
                configObj.googleAnalyticsMeasurementId = gaMeasurementId;
            }
            if (gaProtocolSecret) {
                configObj.googleAnalyticsMeasurementProtocolSecret = gaProtocolSecret;
            }
            content = JSON.stringify(configObj, null, 2);
        } catch (err) {
            console.error('[inject-env] Error updating config JSON:', err);
        }
        fs.writeFileSync(configPath, content);
        injected = true;
    }
}

if (!injected) {
    console.warn(`Warning: Could not find config.${envName}.json in expected dist paths, skipping.`);
}