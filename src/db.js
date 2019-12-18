// TODO: Fix this once https://github.com/denoland/deno/issues/3521
//       is fixed/ addressed.
// import * as wasm from "../build/sqlite.wasm";
import wasm from "../build/sqlite.js";
import { getStr, setStr, setArr } from "./wasm.js";
import constants from "./constants.js";
import { Rows, Empty } from "./rows.js";

// Seed random number generator
wasm.seed_rng(Date.now());

/**  Database handle. */
export class DB {
  /**
   * Create a new database. If an array buffer
   * is provided as the first argument, the
   * database is pre-loaded with that data.
   */
  constructor(data) {
    this._wasm = wasm;

    // Obtain a database id
    this._id = this._wasm.reserve();
    if (this._id == constants.values.error)
      throw this._error();

    // If data is given, write it to db file
    if (data instanceof Uint8Array) {
      if (this._wasm.grow_db_file(this._id, data.length) !== constants.status.sqliteOk)
        throw new Error("Out of memory.");
      const ptr = this._wasm.get_db_file(this._id);
      const view = new Uint8Array(this._wasm.memory.buffer, ptr, data.length);
      view.set(data);
    }

    // Open database
    if (this._wasm.init(this._id) !== constants.status.sqliteOk)
      throw this._error();
    this._open = true;
  }

  /**
   * Run a query against the database. The SQL
   * query can contain placeholders, which are
   * bound to the following parameters in order.
   *
   *     db.query("SELECT name, email FROM users WHERE subscribed = ? AND list LIKE ?", true, listName);
   *
   * Values may only be of the following
   * types and are converted as follows:
   * +------------+-----------------+------------+
   * | JS into DB | SQL type        | JS returned|
   * +------------+-----------------+------------+
   * | number     | INTEGER or REAL | number     |
   * | boolean    | INTEGER         | number     |
   * | string     | TEXT            | string     |
   * | Uint8Array | BLOB            | Uint8Array |
   * | null       | NULL            | null       |
   * | undefined  | NULL            | null       |
   * +------------+-----------------+------------+
   *
   * This always returns an iterable Rows object.
   * As a special case, if the query has no rows
   * to return, this returns the Empty row (which
   * is also iterable, but has zero entries).
   *
   * Any returned Rows object needs to be fully
   * iterated over or discarded by calling
   * `.done()`.
   */
  query(sql, ...values) {
    if (!this._open)
      throw new Error("Database was closed.");
    if (typeof sql !== "string")
      throw new Error("SQL query must be a string.");

    // Prepare sqlite query statement
    let id;
    setStr(this._wasm, sql, ptr => {
      id = this._wasm.prepare(this._id, ptr);
    });
    if (id === constants.values.error)
      throw this._error();

    // Bind values
    for (let i = 0; i < values.length; i++) {
      let status;
      switch (typeof values[i]) {
        case "boolean":
          values[i] = values[i] ? 1 : 0;
        // fall through
        case "number":
          if (Math.floor(values[i]) === values[i]) {
            status = this._wasm.bind_int(this._id, id, i+1, values[i]);
          } else {
            status = this._wasm.bind_double(this._id, id, i+1, values[i]);
          }
          break;
        case "string":
          setStr(this._wasm, values[i], ptr => {
            status = this._wasm.bind_text(this._id, id, i+1, ptr);
          });
          break;
        default:
          if (values[i] instanceof Uint8Array) {
            // Uint8Arrays are allowed and bound to BLOB
            setArr(this._wasm, values[i], ptr => {
              status = this._wasm.bind_blob(this._id, id, i+1, ptr, values[i].length);
            });
          } else if (values[i] === null || values[i] === undefined) {
            // Both null and undefined result in a NULL entry
            status = this._wasm.bind_null(this._id, id, i + 1);
          } else {
            throw new Error("Can not bind ".concat(values[i]));
          }
          break;
      }
      if (status !== constants.status.sqliteOk) {
        this._wasm.finalize(this._id, id);
        throw this._error(status);
      }
    }

    // Step once to handle case where result is empty
    switch (this._wasm.step(this._id, id)) {
      case constants.status.sqliteDone:
        this._wasm.finalize(this._id, id);
        return Empty;
        break;
      case constants.status.sqliteRow:
        return new Rows(this, id);
        break;
      default:
        this._wasm.finalize(this._id, id);
        throw this._error();
        break;
    }
  }

  /**
   * Return SQLite file as a Uint8Array. This
   * makes a copy of the data. To save the data
   * to a file prefer to use `save()` exported by
   * `mod.ts`.
   */
  data() {
    if (!this._open)
      throw new Error("Database was closed.");
    const ptr = this._wasm.get_db_file(this._id);
    const len = this._wasm.get_db_file_size(this._id);
    return new Uint8Array(this._wasm.memory.buffer, ptr, len).slice();
  }

  /**
   * Close database handle. This must be called if
   * DB is no longer used, otherwise the limit for
   * open databases may be reached.
   */
  close() {
    if (!this._open)
      return;
    if (this._wasm.close(this._id) !== constants.status.sqliteOk)
      throw this._error();
    this._open = false;
  }

  _error(code) {
    if (code === undefined)
      code = this._wasm.get_status();
    switch (code) {
      case constants.status.stmtLimit:
        return new Error("Statement limit reached.");
        break;
      case constants.status.noStmt:
        return new Error("Statement not found.");
        break;
      case constants.status.databaseLimit:
        return new Error("Database limit reached.");
        break;
      case constants.status.noDatabase:
        return new Error("Database not found.");
        break;
      default:
        // SQLite error
        const msg = `sqlite error: ${getStr(this._wasm, this._wasm.get_sqlite_error_str(this._id))}`;
        return new Error(msg);
        break;
    }
  }
}
