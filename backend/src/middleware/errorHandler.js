import multer from 'multer';

export function notFoundHandler(request, response) {
  response.status(404).json({ error: `Route not found: ${request.method} ${request.originalUrl}` });
}

export function errorHandler(error, _request, response, _next) {
  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Request body contains invalid JSON.' });
  }
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return response.status(status).json({ error: error.message });
  }
  if (error?.code === 11000) {
    return response.status(409).json({ error: 'A record with that unique value already exists.' });
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return response.status(400).json({ error: error.message });
  }

  console.error(error);
  response.status(error.status ?? 500).json({
    error: error.status ? error.message : 'Internal server error.',
  });
}
