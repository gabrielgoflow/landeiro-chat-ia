// Vercel serverless function wrapper for Express app
// Import from the compiled server code
// The build script (build-server.js) compiles server/index.ts to dist/index.js
// and copies it to api/server.js with all aliases (@shared) already resolved
import serverHandler from './server.js';

// Re-export as default for Vercel
export default serverHandler;

