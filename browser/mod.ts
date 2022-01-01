import { DB } from "../src/db.ts";
import { loadFile, writeFile } from "./vfs.js";

export { SqliteError } from "../src/error.ts";
export { Status } from "../src/constants.ts";

export async function open(file: string): Promise<DB> {
  await loadFile(file);
  return new DB(file);
}

export async function write(file: string, data: Uint8Array): Promise<void> {
  await writeFile(file, data);
}

export async function read(file: string): Promise<Uint8Array> {
  const buffer = await loadFile(file);
  return buffer.toUint8Array().slice();
}
