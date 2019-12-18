import { DB } from "./src/db.js";
import { Empty } from "./src/rows.js";

/**
 * Open a new SQLite3 database. The file at
 * the path is read and preloaded into the database.
 */
async function open(path: string, ignoreNotFound=true): Promise<DB> {
  let bytes = undefined;
  try {
    bytes = await Deno.readFile(path);
  } catch (err) {
    if (!ignoreNotFound || err.kind != Deno.ErrorKind.NotFound)
      throw err;
  }
  const db: any = new DB(bytes);
  db._save_path = path;
  return db;
}

/**
 * Save database to file. If the database was opened
 * from a file using `open()`, the second parameter
 * is optional.
 */
async function save(db: DB, path?: string): Promise<void> {
  path = path || (db as any)._save_path;
  if (!db._open)
    throw new Error("Database was closed.");
  // We obtain the data array ourselves to avoid
  // .data() making a copy
  const ptr = db._wasm.get_db_file(db._id);
  const len = db._wasm.get_db_file_size(db._id);
  const data = new Uint8Array(db._wasm.memory.buffer, ptr, len);
  return Deno.writeFile(path, data);
}

export { open, save, DB, Empty };
