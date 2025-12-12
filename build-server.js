import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';
// For Vercel, we need to build to a location that the api function can import from
// Vercel's serverless functions are in .vercel/output/functions/api
// But we can build the server code to dist and api/index.ts will import from there
const outdir = 'dist';

// Resolve the shared directory path
const sharedPath = path.resolve(__dirname, 'shared');

build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir,
  // Keep node_modules external, but bundle local code including @shared
  packages: 'external',
  alias: {
    '@shared': sharedPath,
  },
  resolveExtensions: ['.ts', '.js', '.json'],
  logLevel: 'info',
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});

