---
type: "query"
date: "2026-10-05T08:48:28.067878+00:00"
question: "when tmsAuomation.ts is failed to complete the process, push the failed notificaiton in telegram to user use the queue mechanisum"
contributor: "graphify"
outcome: "useful"
source_nodes: ["tmsAutomation.ts", "notificationService.ts", "syncService.ts", "sendTelegramNotification()", "enqueueNotification()"]
---

# Q: when tmsAuomation.ts is failed to complete the process, push the failed notificaiton in telegram to user use the queue mechanisum

## Answer

Expanded from original query via vocab: ['tms', 'automation', 'error', 'notification', 'telegram', 'queue', 'enqueue', 'queued', 'process']. Currently tmsAutomation.ts has no link to notificationService.ts. When runAutomation() or executeSingleTrade() fails, or when syncService.ts executes npm run start-tms and hits an error, sendTelegramNotification() from notificationService.ts should be called to enqueue a failed alert into notification_queue/.

## Outcome

- Signal: useful

## Source Nodes

- tmsAutomation.ts
- notificationService.ts
- syncService.ts
- sendTelegramNotification()
- enqueueNotification()