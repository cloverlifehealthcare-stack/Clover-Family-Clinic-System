// Wraps an async route/middleware handler so a rejected promise reaches errorHandler
// instead of crashing the process.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
