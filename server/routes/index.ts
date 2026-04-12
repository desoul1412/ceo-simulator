import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import auth from './auth';
import companies from './companies';
import agents from './agents';
import tickets from './tickets';
import sprints from './sprints';
import plans from './plans';
import planning from './planning';
import mergeRequests from './mergeRequests';
import configs from './configs';
import notifications from './notifications';
import audit from './audit';
import ceoChat from './ceoChat';
import clipmart from './clipmart';
import daemon from './daemon';
import providers from './providers';
import marketplace from './marketplace';
import presets from './presets';
import misc from './misc';

const router = Router();

// Auth routes (public — no auth middleware)
router.use(auth);

// Optional auth for all other routes (attaches user if JWT present)
router.use(optionalAuth);

router.use(companies);
router.use(agents);
router.use(tickets);
router.use(sprints);
router.use(plans);
router.use(planning);
router.use(mergeRequests);
router.use(configs);
router.use(notifications);
router.use(audit);
router.use(ceoChat);
router.use(clipmart);
router.use(daemon);
router.use(providers);
router.use(marketplace);
router.use(presets);
router.use(misc);

export default router;
