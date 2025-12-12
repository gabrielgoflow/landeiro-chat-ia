// Vercel serverless function wrapper for Express app
// Import directly from server - Vercel will compile both files
// The alias @shared will be resolved by the build process
import serverHandler from '../server/index.js';

// Re-export as default for Vercel
export default serverHandler;

