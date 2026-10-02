import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { scraperAdminController } from '../controllers/scraperAdmin.controller';

export const scraperAdminRoutes = Router();

// Apply authentication and administrator role checks to all scraper admin routes
scraperAdminRoutes.use(authenticate, requireAdmin);

// Health check endpoint (placed before :id to prevent collision)
scraperAdminRoutes.get('/scrapers/health', (req, res) =>
  scraperAdminController.getHealth(req, res)
);

// Scraper Sources Endpoints
scraperAdminRoutes.get('/scrapers', (req, res) =>
  scraperAdminController.getSources(req, res)
);

scraperAdminRoutes.get('/scrapers/:id', (req, res) =>
  scraperAdminController.getSourceById(req, res)
);

scraperAdminRoutes.patch('/scrapers/:id', (req, res) =>
  scraperAdminController.updateSource(req, res)
);

scraperAdminRoutes.post('/scrapers/:id/run', (req, res) =>
  scraperAdminController.runSource(req, res)
);

// Scraper Runs Endpoints
scraperAdminRoutes.get('/scraper-runs', (req, res) =>
  scraperAdminController.getRuns(req, res)
);

scraperAdminRoutes.get('/scraper-runs/:id', (req, res) =>
  scraperAdminController.getRunById(req, res)
);

// Scraper Changes & Review Endpoints
scraperAdminRoutes.get('/scraper-changes', (req, res) =>
  scraperAdminController.getChanges(req, res)
);

scraperAdminRoutes.get('/scraper-changes/:id', (req, res) =>
  scraperAdminController.getChangeById(req, res)
);

scraperAdminRoutes.post('/scraper-changes/:id/approve', (req, res) =>
  scraperAdminController.approveChange(req, res)
);

scraperAdminRoutes.post('/scraper-changes/:id/ignore', (req, res) =>
  scraperAdminController.ignoreChange(req, res)
);

export default scraperAdminRoutes;
