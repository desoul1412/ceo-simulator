/**
 * Clipmart routes — template marketplace.
 */

import { Router } from 'express';
import { listTemplates, saveTemplate, exportCompanyAsTemplate, importTemplate } from '../clipmart';

const router = Router();

/**
 * GET /clipmart — list available templates.
 */
router.get('/clipmart', async (req, res) => {
  const category = req.query.category as string | undefined;
  const limit = parseInt(req.query.limit as string) || 20;
  const templates = await listTemplates(category, limit);
  res.json(templates);
});

/**
 * POST /clipmart — publish a new template.
 */
router.post('/clipmart', async (req, res) => {
  try {
    const id = await saveTemplate(req.body);
    res.json({ id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /clipmart/export/:companyId — export company as template.
 */
router.post('/clipmart/export/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const { name, description, category, author } = req.body;

  try {
    const template = await exportCompanyAsTemplate(companyId, {
      name: name ?? 'Untitled Template',
      description: description ?? '',
      category: category ?? 'general',
      author: author ?? 'anonymous',
    });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /clipmart/import — import template to create a new company.
 */
router.post('/clipmart/import', async (req, res) => {
  try {
    const companyId = await importTemplate(req.body.template, req.user?.id);
    res.json({ companyId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
