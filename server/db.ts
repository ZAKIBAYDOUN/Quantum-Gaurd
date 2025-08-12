import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ PRODUCTION ERROR: DATABASE_URL is required in production environment');
    console.error('Please configure DATABASE_URL in your Replit Deployments secrets');
    process.exit(1);
  } else {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
}

// Add connection error handling for production
let pool: Pool;
let db: ReturnType<typeof drizzle>;

try {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
  
  // Test database connection on startup
  if (process.env.NODE_ENV === 'production') {
    pool.query('SELECT 1').catch((error) => {
      console.error('❌ Database connection failed:', error.message);
      console.error('Please check your DATABASE_URL configuration in deployment secrets');
    });
  }
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  if (process.env.NODE_ENV === 'production') {
    console.error('Database connection is required for production deployment');
    process.exit(1);
  }
  throw error;
}

export { pool, db };