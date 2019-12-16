import constants from "./constants.js";
import { Rows, Empty } from "./row.js";

/**  Database handle. */
export class DB {
  constructor(inst, file) {
    this._inst = inst;
    // If we have a file given, we try to load it
    if (file)
      this._inst.FS.writeFile("/db", file);
    if (this._inst._init() !== constants.status.sqliteOk)
      throw this._error();
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
    if (typeof sql !== "string")
      throw new Error("SQL query is not a string.");

    // Prepare sqlite query statement
    const id = this._inst.ccall("prepare", "number", ["string"], [sql]);
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
            status = this._inst._bind_int(id, i + 1, values[i]);
          } else {
            status = this._inst._bind_double(id, i + 1, values[i]);
          }
          break;
        case "string":
          status = this._inst.ccall(
            "bind_text",
            "number",
            ["number", "number", "string"],
            [id, i + 1, values[i]]
          );
          break;
        default:
          if (values[i] instanceof Uint8Array) {
            // Uint8Arrays are allowed and bound to BLOB
            status = this._inst.ccall(
              "bind_blob",
              "number",
              ["number", "number", "array", "number"],
              [id, i + 1, values[i], values[i].length]
            );
          } else if (values[i] === null || values[i] === undefined) {
            // Both null and undefined result in a NULL entry
            status = this._inst._bind_null(id, i + 1);
          } else {
            throw new Error("Can not bind ".concat(values[i]));
          }
          break;
      }
      if (status !== constants.status.sqliteOk) {
        this._inst._finalize(id);
        throw this._error(status);
      }
    }

    // Step once to handle case where result is empty
    switch (this._inst._step(id)) {
      case constants.status.sqliteDone:
        this._inst._finalize(id);
        return Empty;
        break;
      case constants.status.sqliteRow:
        return new Rows(this, id);
        break;
      default:
        throw this._error();
        break;
    }
  }

  /** Saves the database contents to the file at path. */
  save(path) {
    // TODO: Do we want to offer auto-saving?
    return Deno.writeFile(path, this._inst.FS.readFile("/db"));
  }

  /**
   * Warning: Unstable
   *
   * Finalize all running query statements. This
   * can be used to free up space for statements,
   * if they have not been properly deallocated.
   * You should never have to use this.
   */
  _abortAll() {
    // Finalize all statements, leaving open rows in limbo
    this._inst._finalize_all();
  }

  _error(code) {
    if (code === undefined)
      code = this._inst._get_status();
    switch (code) {
      case constants.status.transactionLimit:
        return new Error("No transaction slot available.");
        break;
      case constants.status.noTransaction:
        return new Error("Transaction not found.");
        break;
      default:
        // SQLite error
        return new Error(
          this._inst.ccall("get_sqlite_error_str", "string", [], [])
        );
    }
  }
}
