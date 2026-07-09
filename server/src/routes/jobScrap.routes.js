import { Router } from 'express';
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  syncProfileNow,
  syncAllNow,
  listJobs,
  getJob,
  createManualJob,
  updateJob,
  deleteJob,
  listRuns,
  getStats,
  listMasterItems,
} from '../controllers/jobScrap.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModule('job_scrap'));

router.get('/stats', getStats);
router.get('/runs', listRuns);

router.get('/profiles', listProfiles);
router.post('/profiles', createProfile);
router.patch('/profiles/:id', updateProfile);
router.delete('/profiles/:id', deleteProfile);
router.post('/profiles/:id/sync', syncProfileNow);
router.post('/sync-all', syncAllNow);

router.get('/jobs', listJobs);
router.post('/jobs', createManualJob);
router.get('/jobs/:id', getJob);
router.patch('/jobs/:id', updateJob);
router.delete('/jobs/:id', deleteJob);

router.get('/master', listMasterItems);

export default router;
