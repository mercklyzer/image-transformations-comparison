import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "reviews.json");

export type ReviewStatus = "accepted" | "rejected";
export type Reviews = Record<string, ReviewStatus>;

export function getAll(): Reviews {
  if (!existsSync(DB_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DB_PATH, "utf-8")) as Reviews;
  } catch {
    return {};
  }
}

export function setStatus(filename: string, status: ReviewStatus): void {
  const data = getAll();
  data[filename] = status;
  atomicWrite(data);
}

export function clearStatus(filename: string): void {
  const data = getAll();
  delete data[filename];
  atomicWrite(data);
}

function atomicWrite(data: Reviews): void {
  const tmp = `${DB_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmp, DB_PATH);
}
