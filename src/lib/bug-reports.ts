import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type BugReportRecord = {
  id: string;
  reportNumber: string;
  message: string;
  contactEmail: string | null;
  pageUrl: string;
  deviceType: string;
  browser: string;
  screenSize: string;
  appVersion: string;
  userAgent: string;
  userId: string | null;
  username: string | null;
  status: "open";
  createdAt: string;
};

export function createBugReportRecord(
  input: Omit<BugReportRecord, "id" | "reportNumber" | "status" | "createdAt">,
): BugReportRecord {
  return {
    ...input,
    id: randomUUID(),
    reportNumber: `BUG-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

export async function saveBugReport(report: BugReportRecord) {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id TEXT PRIMARY KEY,
      report_number TEXT NOT NULL UNIQUE,
      message TEXT NOT NULL,
      contact_email TEXT,
      page_url TEXT NOT NULL,
      device_type TEXT NOT NULL,
      browser TEXT NOT NULL,
      screen_size TEXT NOT NULL,
      app_version TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      user_id TEXT,
      username TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS bug_reports_status_created_idx
      ON bug_reports (status, created_at)
  `;

  await prisma.$executeRaw`
    INSERT INTO bug_reports (
      id,
      report_number,
      message,
      contact_email,
      page_url,
      device_type,
      browser,
      screen_size,
      app_version,
      user_agent,
      user_id,
      username,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${report.id},
      ${report.reportNumber},
      ${report.message},
      ${report.contactEmail},
      ${report.pageUrl},
      ${report.deviceType},
      ${report.browser},
      ${report.screenSize},
      ${report.appVersion},
      ${report.userAgent},
      ${report.userId},
      ${report.username},
      ${report.status},
      ${report.createdAt},
      ${report.createdAt}
    )
  `;
}
