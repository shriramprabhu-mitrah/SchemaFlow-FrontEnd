import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

// Default hosts + any extra hosts from ALLOWED_HOSTS env var (comma-separated)
const extraHosts = process.env['ALLOWED_HOSTS']?.split(',').map(h => h.trim()).filter(Boolean) ?? [];
const allowedHosts = extraHosts.includes('*')
  ? ['*']
  : ['*.railway.app', 'localhost', '127.0.0.1', ...extraHosts];

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

const angularApp = new AngularNodeAppEngine({
  allowedHosts,
  trustProxyHeaders: ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'],
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

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
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
