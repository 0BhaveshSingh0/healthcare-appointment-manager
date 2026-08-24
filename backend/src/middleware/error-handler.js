const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Default to 500 internal server error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      code: statusCode,
      message,
    },
  });
};

module.exports = {
  errorHandler,
};
