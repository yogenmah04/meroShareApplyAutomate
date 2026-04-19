import schedule from 'node-schedule';
import fs from 'fs';
import path from 'path';
import { runAutomation } from './automate';
import { fileURLToPath } from 'url';

// Utility to read JSON configuration safely
function loadUsers() {
  const usersPath = path.resolve(__dirname, 'users.json');
  if (!fs.existsSync(usersPath)) {
    console.error('users.json file not found! Please create it with your application configurations.');
    process.exit(1);
  }
  const rawData = fs.readFileSync(usersPath, 'utf8');
  return JSON.parse(rawData);
}

// Main Scheduler
export function initializeScheduler(users: any[]) {
  console.log(`Loaded ${users.length} user configuration(s) for scheduling.`);

  users.forEach((user: any) => {
    // Check if we should apply for this user
    if (user.isApply === false) {
      console.log(`[SKIPPED] User ${user.name || user.username} is marked with isApply: false.`);
      return;
    }

    if (!user.applyAt) {
      console.error(`User ${user.name || user.username} is missing applyAt schedule. Skipping.`);
      return;
    }

    const scheduledDate = new Date(user.applyAt);

    if (scheduledDate.getTime() < Date.now()) {
      console.warn(`[WARNING] The scheduled time for ${user.name || user.username} (${scheduledDate.toLocaleString()}) has already passed.`);
      return;
    }

    console.log(`[SCHEDULED] IPO Application for ${user.name || user.username} set to run at: ${scheduledDate.toLocaleString()}`);

    schedule.scheduleJob(scheduledDate, async () => {
      console.log(`\n================================`);
      console.log(`[STARTING TASK] Executing scheduled application for ${user.name || user.username} at ${new Date().toLocaleString()}`);
      console.log(`================================\n`);

      try {
        await runAutomation(user);
      } catch (e) {
        console.error(`Execution failed for ${user.name || user.username}:`, e);
      }
    });
  });

  console.log('\nScheduler is running and waiting for events...');
}

if (require.main === module) {
  const usersPath = path.resolve(__dirname, 'users.json');
  if (fs.existsSync(usersPath)) {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      initializeScheduler(users);
  }
}
