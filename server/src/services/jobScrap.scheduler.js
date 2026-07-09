import cron from 'node-cron';
import JobSearchProfile from '../models/JobSearchProfile.js';
import { syncSearchProfile } from './jobScrap.service.js';

const scheduledTasks = new Map();

function dayBitmaskToCronDays(days) {
  if (!days?.length) return '*';
  return [...new Set(days)].sort((a, b) => a - b).join(',');
}

function profileCronKey(profile) {
  const [hour, minute] = (profile.scheduleTime || '09:00').split(':').map(Number);
  const cronDays = dayBitmaskToCronDays(profile.scheduleDays);
  return `${minute} ${hour} * * ${cronDays}`;
}

function scheduleProfile(profile) {
  const key = profile._id.toString();
  if (scheduledTasks.has(key)) {
    scheduledTasks.get(key).stop();
    scheduledTasks.delete(key);
  }

  if (!profile.isActive) return;

  const expression = profileCronKey(profile);
  if (!cron.validate(expression)) {
    console.warn(`Invalid cron for profile ${profile.name}: ${expression}`);
    return;
  }

  const task = cron.schedule(
    expression,
    async () => {
      try {
        const fresh = await JobSearchProfile.findById(profile._id);
        if (!fresh?.isActive) return;
        console.log(`[JobScrap] Running scheduled sync: ${fresh.name}`);
        await syncSearchProfile(fresh, 'cron');
      } catch (err) {
        console.error(`[JobScrap] Scheduled sync failed for ${profile.name}:`, err.message);
      }
    },
    { timezone: profile.timezone || 'Asia/Kolkata' }
  );

  scheduledTasks.set(key, task);
}

export async function initJobScrapScheduler() {
  if (!process.env.THEIRSTACK_API_KEY) {
    console.warn('[JobScrap] THEIRSTACK_API_KEY not set — scheduler disabled');
    return;
  }

  const profiles = await JobSearchProfile.find({ isActive: true });
  profiles.forEach(scheduleProfile);
  console.log(`[JobScrap] Scheduled ${profiles.length} active search profile(s)`);
}

export function rescheduleProfile(profile) {
  scheduleProfile(profile);
}

export function unscheduleProfile(profileId) {
  const key = profileId.toString();
  if (scheduledTasks.has(key)) {
    scheduledTasks.get(key).stop();
    scheduledTasks.delete(key);
  }
}
