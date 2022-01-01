import { DB } from "../src/db.ts";
import { loadFile } from "./vfs.js";

export { SqliteError } from "../src/error.ts";
export { Status } from "../src/constants.ts";

export async function open(file: string): Promise<DB> {
  await loadFile(file);
  return new DB(file);
}

export async function read(file: string): Promise<Uint8Array> {
  await 0;
  throw new Error("TODO: " + file);
}
