import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';
// Build to dist for local use
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
}).then(() => {
  // For Vercel, also copy the compiled file to api/ so it's available
  // This ensures the api/index.ts can import it
  if (isVercel || process.env.NODE_ENV === 'production') {
    const distFile = path.join(__dirname, 'dist', 'index.js');
    const apiDir = path.join(__dirname, 'api');
    
    if (existsSync(distFile)) {
      if (!existsSync(apiDir)) {
        mkdirSync(apiDir, { recursive: true });
      }
      // Copy to api/ so it's available for import
      copyFileSync(distFile, path.join(apiDir, 'server.js'));
      console.log('Copied compiled server to api/server.js');
    }
  }
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});

