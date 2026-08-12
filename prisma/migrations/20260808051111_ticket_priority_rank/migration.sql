-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketNumber" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "assigneeId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "priorityRank" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedOrderId" TEXT,
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "SupportTicket_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SupportTicket" ("assigneeId", "category", "closedAt", "createdAt", "description", "id", "priority", "raisedById", "relatedOrderId", "resolutionNote", "resolvedAt", "status", "subject", "ticketNumber") SELECT "assigneeId", "category", "closedAt", "createdAt", "description", "id", "priority", "raisedById", "relatedOrderId", "resolutionNote", "resolvedAt", "status", "subject", "ticketNumber" FROM "SupportTicket";
DROP TABLE "SupportTicket";
ALTER TABLE "new_SupportTicket" RENAME TO "SupportTicket";
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_assigneeId_idx" ON "SupportTicket"("assigneeId");
CREATE INDEX "SupportTicket_priorityRank_idx" ON "SupportTicket"("priorityRank");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
