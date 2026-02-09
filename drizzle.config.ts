import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://workreport_user:Kinn%402022@localhost:5432/workreport_db',
  },
  verbose: true,
  strict: true,
});

