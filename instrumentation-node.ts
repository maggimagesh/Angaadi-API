import { pruneExpiredBlockedAttempts } from './src/utils/webhookAuth'
import { pruneByDiskUsage } from './src/utils/diskGuard'
import {
  cleanupOrphanedWebhookBodies,
  getWebhookRetentionHours,
  pruneExpiredWebhookRecords,
} from './src/utils/webhookInbox'

const RETENTION_SWEEP_INTERVAL_MS = 15 * 60 * 1000

async function sweepExpiredWebhookData(): Promise<void> {
  try {
    await pruneExpiredWebhookRecords()
    pruneExpiredBlockedAttempts()
    await pruneByDiskUsage()
  } catch (err) {
    console.error('Webhook retention sweep failed:', err)
  }
}

export async function registerNode() {
  try {
    await cleanupOrphanedWebhookBodies()
  } catch (err) {
    console.error('Startup cleanup of orphaned webhook bodies failed:', err)
  }

  console.log(
    `Webhook retention: ${getWebhookRetentionHours()}h, sweeping every ${RETENTION_SWEEP_INTERVAL_MS / 60000}min`
  )

  await sweepExpiredWebhookData()
  setInterval(() => {
    void sweepExpiredWebhookData()
  }, RETENTION_SWEEP_INTERVAL_MS)
}
