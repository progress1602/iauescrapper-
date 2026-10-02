import express, { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { apiReference } from '@scalar/express-api-reference';
import openapiSpec from './swagger/openapi.json';

import { authRoutes } from './routes/auth.routes';
import { scraperAdminRoutes } from './scrapers/routes/scraperAdmin.routes';
import { publicRoutes } from './routes/public.routes';
import { errorHandler } from './middleware/errorHandler';
import { sendError } from './utils/response';
import { setupApolloServer } from './graphql/apollo';

export const app = express();

// Bulletproof CORS Middleware: completely eliminates CORS errors across browsers, sandboxes, and tools
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, apollo-require-preflight, x-apollo-operation-name, *'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Origin, Content-Type, Accept, Authorization, apollo-require-preflight, x-apollo-operation-name, *'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  // Immediately respond to preflight OPTIONS requests without routing
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve OpenAPI JSON
app.get(['/openapi.json', '/api/v1/openapi.json'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(openapiSpec);
});

// Swagger UI Playground (at /playground and /docs)
app.use(
  '/playground',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'IAUE Student Hub API Playground',
  })
);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Scalar API Reference (at /scalar)
app.use(
  '/scalar',
  apiReference({
    spec: {
      content: openapiSpec,
    },
    theme: 'purple',
  })
);

// Landing / Status page
app.get('/', (_req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>IAUE Student Hub Backend API</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
        .container { max-width: 820px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
        h1 { color: #38bdf8; margin-top: 0; font-size: 26px; }
        p { color: #94a3b8; line-height: 1.6; }
        .badge { display: inline-block; padding: 4px 10px; background: #10b981; color: #fff; border-radius: 9999px; font-size: 12px; font-weight: bold; margin-bottom: 16px; }
        .btn-group { display: flex; gap: 12px; margin: 24px 0; flex-wrap: wrap; }
        .btn { display: inline-block; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; transition: all 0.2s; }
        .btn-apollo { background: #3f20ba; color: #fff; border: 1px solid #6366f1; }
        .btn-apollo:hover { background: #4f46e5; }
        .btn-primary { background: #0284c7; color: #fff; }
        .btn-primary:hover { background: #0369a1; }
        .btn-secondary { background: #334155; color: #e2e8f0; }
        .btn-secondary:hover { background: #475569; }
        .disclaimer { margin-top: 24px; padding: 14px; background: #0f172a; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #cbd5e1; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">● API OPERATIONAL</div>
        <h1>IAUE Student Hub Backend & APIs</h1>
        <p>Production-ready REST & GraphQL backend featuring automated web scraping, academic synchronization, course credit-unit protection, and administrative review for Ignatius Ajuru University of Education students.</p>
        
        <div class="btn-group">
          <a href="/apollo" class="btn btn-apollo">🚀 Open Apollo Sandbox Playground</a>
          <a href="/playground" class="btn btn-primary">🎮 Swagger Playground</a>
          <a href="/scalar" class="btn btn-secondary">📚 Scalar Documentation</a>
          <a href="/openapi.json" class="btn btn-secondary" target="_blank">⚙️ OpenAPI Spec (JSON)</a>
          <a href="/api/v1/announcements" class="btn btn-secondary">📢 Public Announcements</a>
          <a href="/api/v1/courses" class="btn btn-secondary">📖 Courses</a>
        </div>

        <div class="disclaimer">
          <strong>Notice & Attribution:</strong> IAUE Student Hub is an independent academic resource hub and is not officially operated or endorsed by Ignatius Ajuru University of Education. All crawled academic data retains attribution and links directly to official IAUE sources.
        </div>
      </div>
    </body>
    </html>
  `);
});

// Mount API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', scraperAdminRoutes);
app.use('/api/v1', publicRoutes);

// Initialize Apollo Server asynchronously
let apolloInitialized = false;
export async function initializeApollo() {
  if (!apolloInitialized) {
    await setupApolloServer(app);
    apolloInitialized = true;
  }
}

// 404 Handler (only for non-GraphQL routes)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/graphql' || req.path === '/apollo') {
    next();
    return;
  }
  sendError(res, 'Requested route not found', 404, 'NOT_FOUND');
});

// Global Error Handler
app.use(errorHandler);

export default app;
