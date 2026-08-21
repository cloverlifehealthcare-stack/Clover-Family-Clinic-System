const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(err); // eslint-disable-line no-console
  return res.status(500).json({ error: 'Internal server error.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

module.exports = { errorHandler, notFoundHandler };
