import * as dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import path from 'path';

dotenv.config();

const QUEUE_DIR = path.resolve(__dirname, 'notification_queue');

// Ensure queue directory exists
if (!fs.existsSync(QUEUE_DIR)) {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

export interface QueuedMessage {
  id: string;
  message: string;
  createdAt: string;
  attempts: number;
  lastAttempt?: string;
  error?: string;
}

let isFlushing = false;
let workerTimer: NodeJS.Timeout | null = null;

/**
 * Persists a message to the file-based queue directory on disk.
 */
export function enqueueNotification(message: string): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const id = `${timestamp}_${rand}`;
  const filePath = path.join(QUEUE_DIR, `msg_${id}.json`);

  const record: QueuedMessage = {
    id,
    message,
    createdAt: new Date().toISOString(),
    attempts: 0
  };

  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  console.log(`[Notification Queue] Enqueued message ${id} to disk.`);
  return id;
}

/**
 * Returns the count of pending messages in the queue directory.
 */
export function getPendingCount(): number {
  try {
    return fs.readdirSync(QUEUE_DIR).filter(f => f.startsWith('msg_') && f.endsWith('.json')).length;
  } catch (_) {
    return 0;
  }
}

/**
 * Direct HTTPS POST request to Telegram Bot API with IPv4 priority.
 */
function sendDirectTelegram(
  message: string,
  token: string,
  chatId: string
): Promise<{ success: boolean; status?: number; error?: string; isNetworkError?: boolean }> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      family: 4, // Force IPv4 to prevent Linux IPv6 network dropouts
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode });
        } else {
          resolve({ success: false, status: res.statusCode, error: `HTTP ${res.statusCode}: ${body.slice(0, 100)}` });
        }
      });
    });

    req.on('error', (err: any) => {
      const errMsg = err?.message || String(err);
      const isNet = /EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|fetch failed/i.test(errMsg);
      resolve({ success: false, error: errMsg, isNetworkError: isNet });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Connection timed out', isNetworkError: true });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Flushes the queue in chronological (FIFO) order.
 * If a network error occurs, messages remain on disk and flush pauses until connection recovers.
 */
export async function flushNotificationQueue(): Promise<{ sent: number; remaining: number }> {
  if (isFlushing) {
    return { sent: 0, remaining: getPendingCount() };
  }
  isFlushing = true;

  let token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  let chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    console.warn('[Notification Queue] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing. Skipping flush.');
    isFlushing = false;
    return { sent: 0, remaining: getPendingCount() };
  }

  // Auto-detect and swap if token and chat ID were reversed
  if (chatId.includes(':') && !token.includes(':')) {
    const temp = token;
    token = chatId;
    chatId = temp;
  }

  let sentCount = 0;

  try {
    const files = fs.readdirSync(QUEUE_DIR)
      .filter(f => f.startsWith('msg_') && f.endsWith('.json'))
      .sort(); // FIFO order based on timestamp

    if (files.length === 0) {
      isFlushing = false;
      return { sent: 0, remaining: 0 };
    }

    console.log(`[Notification Queue] Processing ${files.length} queued message(s)...`);

    for (const file of files) {
      const filePath = path.join(QUEUE_DIR, file);
      if (!fs.existsSync(filePath)) continue;

      let record: QueuedMessage;
      try {
        record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (parseErr) {
        console.warn(`[Notification Queue] Corrupt message file ${file}, discarding.`);
        fs.unlinkSync(filePath);
        continue;
      }

      const res = await sendDirectTelegram(record.message, token, chatId);

      if (res.success) {
        console.log(`[Notification Queue] Message ${record.id} delivered successfully.`);
        try { fs.unlinkSync(filePath); } catch (_) {}
        sentCount++;
      } else {
        record.attempts = (record.attempts || 0) + 1;
        record.lastAttempt = new Date().toISOString();
        record.error = res.error;
        try {
          fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
        } catch (_) {}

        if (res.isNetworkError) {
          console.warn(`[Notification Queue] Network is offline/unreachable (${res.error}). Halting queue flush. Message ${record.id} will be retried when connection recovers.`);
          break; // Stop loop and keep remaining messages on disk
        } else {
          console.error(`[Notification Queue] Message ${record.id} rejected by Telegram: ${res.error}.`);
          if (record.attempts >= 5) {
            console.warn(`[Notification Queue] Discarding message ${record.id} after 5 failed attempts.`);
            try { fs.unlinkSync(filePath); } catch (_) {}
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Notification Queue] Error while flushing queue:', err?.message || err);
  } finally {
    isFlushing = false;
  }

  const remaining = getPendingCount();
  return { sent: sentCount, remaining };
}

/**
 * Starts a background interval worker that periodically checks for queued messages
 * and delivers them as soon as internet connectivity is available.
 */
export function startQueueWorker(intervalMs: number = 30000): void {
  if (workerTimer) return;
  workerTimer = setInterval(async () => {
    const pending = getPendingCount();
    if (pending > 0) {
      console.log(`[Notification Queue] Background worker detected ${pending} pending message(s). Attempting delivery...`);
      await flushNotificationQueue();
    }
  }, intervalMs);
  if (workerTimer.unref) workerTimer.unref();
}

/**
 * Main notification API: Enqueues message to disk first, then attempts delivery.
 * If offline, message safely stays in notification_queue/ until network is restored.
 */
export async function sendTelegramNotification(message: string): Promise<void> {
  enqueueNotification(message);
  await flushNotificationQueue();
}

// Automatically start background worker
startQueueWorker(30000);

// CLI Support
if (require.main === module) {
  const args = process.argv.slice(2);
  const isFlushOnly = args.includes('--flush');
  const isStatusOnly = args.includes('--status');

  if (isStatusOnly) {
    console.log(`Pending queued notifications: ${getPendingCount()}`);
    process.exit(0);
  }

  if (isFlushOnly) {
    console.log('Manually flushing notification queue...');
    flushNotificationQueue().then(({ sent, remaining }) => {
      console.log(`Flush complete: ${sent} sent, ${remaining} remaining.`);
      process.exit(0);
    });
  } else {
    const customMessage = args.filter(a => !a.startsWith('--')).join(' ') || 
      '🔔 <b>Test Notification</b>\n\nThis is a test notification from the file-based persistent messaging system!\nStatus: 🟢 <i>Online & Working</i>';
    
    console.log('Sending notification via file-based persistent queue...');
    sendTelegramNotification(customMessage)
      .then(() => {
        console.log(`Notification task finished. Remaining in queue: ${getPendingCount()}`);
      })
      .catch(console.error);
  }
}
