import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SupportCategory, SupportPriority } from "@/lib/support-ticket-options";

export type SupportTicketRecord = {
  id: string;
  ticketNumber: string;
  accountEmail: string;
  category: SupportCategory;
  priority: SupportPriority;
  message: string;
  browserInfo: string;
  screenshotName: string | null;
  screenshotType: string | null;
  screenshotSize: number | null;
  screenshotDataUrl: string | null;
  userId: string | null;
  username: string | null;
  status: "open";
  createdAt: string;
};

export function createSupportTicketRecord(
  input: Omit<SupportTicketRecord, "id" | "ticketNumber" | "status" | "createdAt">,
): SupportTicketRecord {
  return {
    ...input,
    id: randomUUID(),
    ticketNumber: `MESH-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

export async function saveSupportTicket(ticket: SupportTicketRecord) {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      ticket_number TEXT NOT NULL UNIQUE,
      account_email TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      message TEXT NOT NULL,
      browser_info TEXT NOT NULL,
      screenshot_name TEXT,
      screenshot_type TEXT,
      screenshot_size INTEGER,
      screenshot_data_url TEXT,
      user_id TEXT,
      username TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
      ON support_tickets (status, created_at)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS support_tickets_account_email_idx
      ON support_tickets (account_email)
  `;

  await prisma.$executeRaw`
    INSERT INTO support_tickets (
      id,
      ticket_number,
      account_email,
      category,
      priority,
      message,
      browser_info,
      screenshot_name,
      screenshot_type,
      screenshot_size,
      screenshot_data_url,
      user_id,
      username,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${ticket.id},
      ${ticket.ticketNumber},
      ${ticket.accountEmail},
      ${ticket.category},
      ${ticket.priority},
      ${ticket.message},
      ${ticket.browserInfo},
      ${ticket.screenshotName},
      ${ticket.screenshotType},
      ${ticket.screenshotSize},
      ${ticket.screenshotDataUrl},
      ${ticket.userId},
      ${ticket.username},
      ${ticket.status},
      ${ticket.createdAt},
      ${ticket.createdAt}
    )
  `;
}
