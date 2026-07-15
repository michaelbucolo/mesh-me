import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { FeatureRequestItem, FeatureRequestStatus } from "@/lib/feature-request-options";

type FeatureRequestRow = {
  id: string;
  title: string;
  description: string;
  status: FeatureRequestStatus;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  voteCount: number | bigint | string | null;
  hasVoted: number | bigint | boolean | null;
  createdAt: string;
  updatedAt: string;
};

function toNumber(value: number | bigint | string | boolean | null | undefined) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return Number(value ?? 0);
}

function serializeFeatureRequest(row: FeatureRequestRow): FeatureRequestItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    authorId: row.authorId,
    authorUsername: row.authorUsername,
    authorDisplayName: row.authorDisplayName,
    voteCount: toNumber(row.voteCount),
    hasVoted: Boolean(toNumber(row.hasVoted)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ensureFeatureRequestTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'under_review',
      author_id TEXT NOT NULL,
      author_username TEXT NOT NULL,
      author_display_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS feature_requests_status_created_idx
      ON feature_requests (status, created_at)
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS feature_request_votes (
      request_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (request_id, user_id)
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS feature_request_votes_user_idx
      ON feature_request_votes (user_id)
  `;
}

export async function listFeatureRequests(userId: string) {
  await ensureFeatureRequestTables();

  const rows = await prisma.$queryRaw<FeatureRequestRow[]>`
    SELECT
      fr.id,
      fr.title,
      fr.description,
      fr.status,
      fr.author_id AS authorId,
      fr.author_username AS authorUsername,
      fr.author_display_name AS authorDisplayName,
      (
        SELECT COUNT(*)
        FROM feature_request_votes votes
        WHERE votes.request_id = fr.id
      ) AS voteCount,
      (
        SELECT COUNT(*)
        FROM feature_request_votes mine
        WHERE mine.request_id = fr.id AND mine.user_id = ${userId}
      ) AS hasVoted,
      fr.created_at AS createdAt,
      fr.updated_at AS updatedAt
    FROM feature_requests fr
    ORDER BY fr.created_at DESC
  `;

  return rows.map(serializeFeatureRequest);
}

export async function createFeatureRequest(input: {
  title: string;
  description: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
}) {
  await ensureFeatureRequestTables();

  const now = new Date().toISOString();
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO feature_requests (
      id,
      title,
      description,
      status,
      author_id,
      author_username,
      author_display_name,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${input.title},
      ${input.description},
      ${"under_review"},
      ${input.authorId},
      ${input.authorUsername},
      ${input.authorDisplayName},
      ${now},
      ${now}
    )
  `;

  const created = await getFeatureRequestById(id, input.authorId);
  if (!created) throw new Error("Feature request was not created.");
  return created;
}

export async function getFeatureRequestById(requestId: string, userId: string) {
  await ensureFeatureRequestTables();

  const rows = await prisma.$queryRaw<FeatureRequestRow[]>`
    SELECT
      fr.id,
      fr.title,
      fr.description,
      fr.status,
      fr.author_id AS authorId,
      fr.author_username AS authorUsername,
      fr.author_display_name AS authorDisplayName,
      (
        SELECT COUNT(*)
        FROM feature_request_votes votes
        WHERE votes.request_id = fr.id
      ) AS voteCount,
      (
        SELECT COUNT(*)
        FROM feature_request_votes mine
        WHERE mine.request_id = fr.id AND mine.user_id = ${userId}
      ) AS hasVoted,
      fr.created_at AS createdAt,
      fr.updated_at AS updatedAt
    FROM feature_requests fr
    WHERE fr.id = ${requestId}
    LIMIT 1
  `;

  return rows[0] ? serializeFeatureRequest(rows[0]) : null;
}

export async function setFeatureRequestVote(requestId: string, userId: string, shouldVote: boolean) {
  await ensureFeatureRequestTables();

  const now = new Date().toISOString();

  if (shouldVote) {
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO feature_request_votes (request_id, user_id, created_at)
      VALUES (${requestId}, ${userId}, ${now})
    `;
  } else {
    await prisma.$executeRaw`
      DELETE FROM feature_request_votes
      WHERE request_id = ${requestId} AND user_id = ${userId}
    `;
  }

  return getFeatureRequestById(requestId, userId);
}

export async function updateFeatureRequestStatus(requestId: string, status: FeatureRequestStatus, userId: string) {
  await ensureFeatureRequestTables();

  await prisma.$executeRaw`
    UPDATE feature_requests
    SET status = ${status}, updated_at = ${new Date().toISOString()}
    WHERE id = ${requestId}
  `;

  return getFeatureRequestById(requestId, userId);
}
