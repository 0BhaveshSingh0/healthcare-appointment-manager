const morgan = require('morgan');

// Standard dev logger
const requestLogger = morgan('dev');

module.exports = {
  requestLogger,
};
