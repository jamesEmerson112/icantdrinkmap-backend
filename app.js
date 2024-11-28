// Require necessary Node.js modules
const createError = require('http-errors');
const express = require('express');
const path = require('path');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const greenlock = require('@root/greenlock-express');


// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Require router modules for different paths
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

// Create an instance of an Express app
const app = express();

// Switch between "development" vs. "production"
if (process.env.NODE_ENV === 'development') {
  // Enable detailed logging, debugging features, etc.
  app.use(require('morgan')('dev'));
  console.log('Running in development mode');
} else if (process.env.NODE_ENV === 'production') {
  // Enable production optimizations, caching, less verbose logging, etc.
  console.log('Running in production mode');
}

// Setup the view engine to use Pug for rendering HTML from templates
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// ********* MIDDLEWARE SECTION *********
// Apply Helmet middleware for security
app.use(helmet());

// Middleware to validate API keys
function validateAPIKey(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
      console.log("Development mode: Skipping API key validation.");
      next();
  } else {
      const apiKey = req.get('X-API-Key');
      const validKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];

      if (validKeys.includes(apiKey)) {
          next();
      } else {
          res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
      }
  }
}
app.use(validateAPIKey);

// Logger middleware for logging HTTP requests and errors
app.use(logger('dev'));

// Middleware for parsing JSON-formatted incoming request data
app.use(express.json());

// Middleware for parsing URL-encoded data (e.g., form submissions)
app.use(express.urlencoded({ extended: false }));

// Middleware to parse Cookie header and populate req.cookies
app.use(cookieParser());

// Apply rate limiting to all requests
app.use(apiLimiter);

// Middleware to serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ********* ROUTE HANDLERS SECTION *********
// Mount routers for specific paths
app.use('/', indexRouter);
app.use('/users', usersRouter);

// ********* CUSTOM ROUTE HANDLERS HERE *********
// Example route handler for '/home'
app.get('/home', (req, res) => {
  res.send('Hello World!');
});

// ********* ERROR HANDLING SECTION *********
// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handling middleware
app.use(function(err, req, res, next) {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render('error');
});

// ********* GREENLOCK INTEGRATION FOR HTTPS *********
// Greenlock Setup for SSL/TLS
// Environment-based port configuration


if (process.env.NODE_ENV === 'development') {
  // Development-specific configuration
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
  });
} else {
  // Production-specific configuration
  const HTTP_PORT = process.env.HTTP_PORT || 80; // Default HTTP port
  const HTTPS_PORT = process.env.HTTPS_PORT || 443; // Default HTTPS port
  const greenlockApp = greenlock.init({
      packageRoot: __dirname,
      configDir: './greenlock.d',
      maintainerEmail: process.env.MAINTAINER_EMAIL, // Your email for important renewal failures
      cluster: false // set to true if you're using a cluster of servers
  });

  // Serve your app with HTTPS
  greenlockApp.serve(app);

  // Additional production setup can go here
  console.log(`Server running under Greenlock management. Access the site at https://yourdomain.com`);
}

// Export the app for use in other files (e.g., for testing)
module.exports = app;