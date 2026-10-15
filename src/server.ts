import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const browserDistFolder = join(import.meta.dirname, '../browser');

// Default hosts + any extra hosts from ALLOWED_HOSTS env var (comma-separated)
const extraHosts = process.env['ALLOWED_HOSTS']?.split(',').map(h => h.trim()).filter(Boolean) ?? [];
const allowedHosts = extraHosts.includes('*')
  ? ['*']
  : ['*.railway.app', 'localhost', '127.0.0.1', 'dbnexus.io', '*.dbnexus.io', ...extraHosts];

const app = express();

/**
 * Guard against invalid HTTP header values (e.g. Angular HttpHeaders internal 'lazyInit: undefined')
 */
app.use((req, res, next) => {
  const originalSetHeader = res.setHeader;
  res.setHeader = function (name: string, value: any) {
    if (value === undefined || name === 'lazyInit' || name === 'lazyUpdate') {
      return this;
    }
    return originalSetHeader.call(this, name, value);
  };
  next();
});

/**
 * Reverse proxy for backend API and WebSocket endpoints (/api, /socket.io)
 */
const backendTarget =
  process.env['BACKEND_API_URL'] ||
  process.env['API_PROXY_TARGET'] ||
  'https://db-nexus-backend-production.up.railway.app';

const apiProxy = createProxyMiddleware({
  target: backendTarget,
  changeOrigin: true,
  pathFilter: ['/api', '/socket.io'],
  ws: true,
  on: {
    error: (err, req, res) => {
      console.error(`[Proxy Error] failed to proxy ${req.url} to ${backendTarget}:`, err.message);
      if ('writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ statusCode: 502, message: 'Backend service unavailable' }));
      }
    },
  },
});

app.use(apiProxy);

const angularApp = new AngularNodeAppEngine({
  allowedHosts,
  trustProxyHeaders: ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'],
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, running via PM2,
 * or deployed on Railway.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id'] || process.env['RAILWAY_ENVIRONMENT']) {
  const port = process.env['PORT'] || 4000;
  const server = app.listen(port, () => {
    // console.log(`Node Express server listening on http://localhost:${port}`);
  });
  if (typeof apiProxy.upgrade === 'function') {
    server.on('upgrade', apiProxy.upgrade);
  }
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
