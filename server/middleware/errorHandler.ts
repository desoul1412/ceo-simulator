/**
 * Centralized Express error handler.
 */

import type { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction): void {
  const status = err.statusCode ?? 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  if (status === 500) {
    console.error('[error-handler]', err.message, err.stack?.split('\n').slice(0, 3).join('\n'));
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { details: err.details ?? err.message }),
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
