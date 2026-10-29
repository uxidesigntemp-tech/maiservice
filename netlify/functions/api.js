// netlify/functions/api.js
// Netlify Serverless Function adapter for MAI Service Marketplace Express API
const serverless = require('serverless-http');
const app = require('../../server/server');

const serverlessHandler = serverless(app);

exports.handler = async (event, context) => {
  // Normalize Netlify function path routing:
  // Netlify routes "/api/*" -> "/.netlify/functions/api/*"
  // Express routes are mounted under "/api/*"
  if (event.path) {
    if (event.path.startsWith('/.netlify/functions/api')) {
      const subPath = event.path.replace('/.netlify/functions/api', '') || '';
      event.path = subPath.startsWith('/api') ? subPath : ('/api' + (subPath.startsWith('/') ? subPath : '/' + subPath));
    }
    // Handle raw calls to /.netlify/functions/api
    if (event.path === '/api/' || event.path === '/api') {
      event.path = '/api/health';
    }
  }

  // Set context callbackWaitsForEmptyEventLoop to false for performance
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  return await serverlessHandler(event, context);
};
