import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type ReviewStatus = "accepted" | "rejected" | "ignore";
export type Reviews = Record<string, ReviewStatus>;

// --- Palette cache ---

async function ensurePalettesTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS palettes (
      filename TEXT NOT NULL,
      tool     TEXT NOT NULL,
      data     JSONB NOT NULL,
      PRIMARY KEY (filename, tool)
    )
  `;
}

export async function getCachedPalette(
  filename: string,
  tool: string,
): Promise<unknown | null> {
  await ensurePalettesTable();
  const rows =
    await sql`SELECT data FROM palettes WHERE filename = ${filename} AND tool = ${tool}`;
  return rows[0]?.data ?? null;
}

export async function setCachedPalette(
  filename: string,
  tool: string,
  data: unknown,
): Promise<void> {
  await ensurePalettesTable();
  await sql`
    INSERT INTO palettes (filename, tool, data)
    VALUES (${filename}, ${tool}, ${JSON.stringify(data)})
    ON CONFLICT (filename, tool) DO UPDATE SET data = EXCLUDED.data
  `;
}

// --- Reviews ---

async function ensureTable(): Promise<void> {
  // Drop the old single-column schema if it exists (no `tool` column)
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reviews' AND column_name = 'tool'
      ) THEN
        DROP TABLE reviews;
      END IF;
    END $$
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      filename TEXT NOT NULL,
      tool     TEXT NOT NULL,
      status   TEXT NOT NULL,
      PRIMARY KEY (filename, tool)
    )
  `;
}

export async function getAll(): Promise<Reviews> {
  await ensureTable();
  const rows = await sql`SELECT filename, tool, status FROM reviews`;
  return Object.fromEntries(
    rows.map((r) => [`${r.tool}:${r.filename}`, r.status as ReviewStatus]),
  );
}

export async function setStatus(
  key: string,
  status: ReviewStatus,
): Promise<void> {
  await ensureTable();
  const colonIdx = key.indexOf(":");
  const tool = key.slice(0, colonIdx);
  const filename = key.slice(colonIdx + 1);
  await sql`
    INSERT INTO reviews (filename, tool, status) VALUES (${filename}, ${tool}, ${status})
    ON CONFLICT (filename, tool) DO UPDATE SET status = EXCLUDED.status
  `;
}

export async function clearStatus(key: string): Promise<void> {
  await ensureTable();
  const colonIdx = key.indexOf(":");
  const tool = key.slice(0, colonIdx);
  const filename = key.slice(colonIdx + 1);
  await sql`DELETE FROM reviews WHERE filename = ${filename} AND tool = ${tool}`;
}
