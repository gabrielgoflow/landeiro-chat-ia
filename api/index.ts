// Vercel serverless function wrapper for Express app
// Import the default export from the server
// Note: Use .js extension as TypeScript expects compiled output
import serverHandler from '../server/index.js';

// Re-export as default for Vercel
export default serverHandler;

