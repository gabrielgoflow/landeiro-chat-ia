// Vercel serverless function wrapper for Express app
// Import from the compiled server code in dist/
// The build script (build-server.js) compiles server/index.ts to dist/index.js
// with all aliases (@shared) already resolved
import serverHandler from '../dist/index.js';

// Re-export as default for Vercel
export default serverHandler;

