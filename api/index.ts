import { createApiApp } from '../server/app.ts';

// Vercel Serverless Function entry point for all /api/* routes.
// Uses SUPABASE_URL + SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY fallback) at runtime.
const app = createApiApp();

export default app;
