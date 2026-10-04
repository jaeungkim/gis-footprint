import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env itself. Real env vars still win over the file.
if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // process.env, not env(): env() throws when unset, and `prisma generate`
  // (postinstall, CI) must work without a database URL.
  datasource: { url: process.env.DATABASE_URL },
});
