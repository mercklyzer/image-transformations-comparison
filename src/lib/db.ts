import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type ReviewStatus = "accepted" | "rejected" | "ignore";
export type Reviews = Record<string, ReviewStatus>;

async function ensureTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      filename TEXT PRIMARY KEY,
      status   TEXT NOT NULL
    )
  `;
  await sql`
    ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check
  `;
}

export async function getAll(): Promise<Reviews> {
  await ensureTable();
  const rows = await sql`SELECT filename, status FROM reviews`;
  return Object.fromEntries(rows.map((r) => [r.filename, r.status as ReviewStatus]));
}

export async function setStatus(filename: string, status: ReviewStatus): Promise<void> {
  await ensureTable();
  await sql`
    INSERT INTO reviews (filename, status) VALUES (${filename}, ${status})
    ON CONFLICT (filename) DO UPDATE SET status = EXCLUDED.status
  `;
}

export async function clearStatus(filename: string): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM reviews WHERE filename = ${filename}`;
}
