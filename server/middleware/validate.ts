/**
 * Request validation middleware.
 * Uses simple schema validation (no Zod dependency).
 */

import type { Request, Response, NextFunction } from 'express';

type Validator = (value: unknown) => { valid: boolean; error?: string };

interface ValidationSchema {
  body?: Record<string, Validator>;
  params?: Record<string, Validator>;
  query?: Record<string, Validator>;
}

/**
 * Validate request against schema. Returns 400 on failure.
 */
export function validate(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    if (schema.body) {
      for (const [key, validator] of Object.entries(schema.body)) {
        const result = validator(req.body?.[key]);
        if (!result.valid) errors.push(`body.${key}: ${result.error ?? 'invalid'}`);
      }
    }

    if (schema.params) {
      for (const [key, validator] of Object.entries(schema.params)) {
        const result = validator(req.params?.[key]);
        if (!result.valid) errors.push(`params.${key}: ${result.error ?? 'invalid'}`);
      }
    }

    if (schema.query) {
      for (const [key, validator] of Object.entries(schema.query)) {
        const result = validator(req.query?.[key]);
        if (!result.valid) errors.push(`query.${key}: ${result.error ?? 'invalid'}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    next();
  };
}

// ── Common validators ────────────────────────────────────────────────────────

export const isRequired: Validator = (v) =>
  v !== undefined && v !== null && v !== '' ? { valid: true } : { valid: false, error: 'required' };

export const isUUID: Validator = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    ? { valid: true }
    : { valid: false, error: 'must be a valid UUID' };

export const isString: Validator = (v) =>
  typeof v === 'string' ? { valid: true } : { valid: false, error: 'must be a string' };

export const isNumber: Validator = (v) =>
  typeof v === 'number' && !isNaN(v) ? { valid: true } : { valid: false, error: 'must be a number' };
