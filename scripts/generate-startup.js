const fs = require('fs');
const path = require('path');

/**
 * Post-build script: patches the bundled server.mjs to import the Angular SSR
 * engine manifest before any server code runs.
 *
 * WHY: Angular @angular/build@22.0.x and @angular/ssr@22.1.x have a version mismatch
 *      where the engine manifest loader is not automatically injected into server.mjs.
 */
function patchServer() {
    const serverDir = path.resolve(__dirname, '../dist/db-diagram/server');
    const serverMjsPath = path.join(serverDir, 'server.mjs');
    const manifestPath = path.join(serverDir, 'angular-app-engine-manifest.mjs');

    if (!fs.existsSync(serverMjsPath)) {
        console.log('[patch-server] server.mjs not found, skipping patch.');
        return;
    }

    if (!fs.existsSync(manifestPath)) {
        console.log('[patch-server] angular-app-engine-manifest.mjs not found, skipping patch.');
        return;
    }

    let serverContent = fs.readFileSync(serverMjsPath, 'utf8');

    if (serverContent.includes('[PATCHED] Load Angular SSR engine manifest')) {
        console.log('[patch-server] server.mjs is already patched.');
        return;
    }

    const files = fs.readdirSync(serverDir);
    let targetChunkName = null;
    let targetChunkPath = null;
    let varName = null;

    for (const file of files) {
        if (file.startsWith('chunk-') && file.endsWith('.mjs')) {
            const filePath = path.join(serverDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('Angular app engine manifest is not set')) {
                targetChunkName = file;
                targetChunkPath = filePath;
                const idx = content.indexOf('Angular app engine manifest is not set');
                if (idx !== -1) {
                    const snippet = content.slice(Math.max(0, idx - 250), idx);
                    const match = snippet.match(/if\s*\(!\s*([a-zA-Z0-9_$]+)\s*\)/);
                    if (match && match[1]) {
                        varName = match[1];
                    }
                }
                break;
            }
        }
    }

    if (!targetChunkPath || !varName) {
        console.warn('[patch-server] Could not locate chunk file or variable containing Angular app engine manifest check.');
        return;
    }

    console.log(`[patch-server] Found target chunk: ${targetChunkName} with manifest var '${varName}'`);

    let chunkContent = fs.readFileSync(targetChunkPath, 'utf8');
    if (!chunkContent.includes('__sem')) {
        const exportPatch = `\nfunction __setEngineManifest(m){${varName}=m}\nexport{__setEngineManifest as __sem};\n`;
        fs.appendFileSync(targetChunkPath, exportPatch, 'utf8');
        console.log(`[patch-server] Exported __sem in ${targetChunkName}`);
    }

    const headerPatch = `// [PATCHED] Load Angular SSR engine manifest\nimport{__sem as __setManifest}from"./${targetChunkName}";\nimport __engineManifest from"./angular-app-engine-manifest.mjs";\n__setManifest(__engineManifest);\n`;

    fs.writeFileSync(serverMjsPath, headerPatch + serverContent, 'utf8');
    console.log('[patch-server] Successfully patched server.mjs with engine manifest initializer.');
}

patchServer();
