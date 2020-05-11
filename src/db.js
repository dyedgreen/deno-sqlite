import wasm from "../build/sqlite.js";
import { getStr, setStr, setArr } from "./wasm.ts";
import * as constants from "./constants.ts";
import { Rows, Empty } from "./rows.js";
import SqliteError from "./error.ts";

// Seed random number generator
wasm.seed_rng(Date.now());

export class DB {
  /**
   * DB
   *
   * Create a new database. If a `Uint8Array`
   * is provided as the first argument the
   * database is pre-loaded with the array as the
   * database file. If no arguments are provided
   * a new in-memory database is opened.
   *
   * The Uint8Array could be obtained from
   * `db.data()`, or by reading a database
   * file written by SQLite.
   */
  constructor(data) {
    this._wasm = wasm;

    // Obtain a database id
    this._id = this._wasm.reserve();
    if (this._id == constants.Values.Error) {
      throw this._error();
    }

    // If data is given, write it to db file
    if (data instanceof Uint8Array) {
      if (
        this._wasm.grow_db_file(this._id, data.length) !==
          constants.Status.SqliteOk
      ) {
        throw new SqliteError("Out of memory.");
      }
      const ptr = this._wasm.get_db_file(this._id);
      const view = new Uint8Array(this._wasm.memory.buffer, ptr, data.length);
      view.set(data);
    }

    // Open database
    if (this._wasm.init(this._id) !== constants.Status.SqliteOk) {
      throw this._error();
    }
    this._open = true;
  }

  /**
   * DB.query
   *
   * Run a query against the database. The query
   * can contain placeholder parameters, which
   * are bound to the values passed in 'values'.
   *
   *     db.query("SELECT name, email FROM users WHERE subscribed = ? AND list LIKE ?", [true, listName]);
   *
   * This supports positional and named parameters.
   * Positional parameters can be set by passing an
   * array for values. Named parameters can be set
   * by passing an object for values.
   *
   * While they can be mixed in principle, this is
   * not recommended.
   *
   * | Parameter     | Values                  |
   * |---------------|-------------------------|
   * | `?NNN` or `?` | NNN-th value in array   |
   * | `:AAAA`       | value `AAAA` or `:AAAA` |
   * | `@AAAA`       | value `@AAAA`           |
   * | `$AAAA`       | value `$AAAA`           |
   *
   * (see https://www.sqlite.org/lang_expr.html)
   *
   * Values may only be of the following
   * types and are converted as follows:
   *
   * | JS in      | SQL type        | JS out     |
   * |------------|-----------------|------------|
   * | number     | INTEGER or REAL | number     |
   * | boolean    | INTEGER         | number     |
   * | string     | TEXT            | string     |
   * | Date       | TEXT            | string     |
   * | Uint8Array | BLOB            | Uint8Array |
   * | null       | NULL            | null       |
   * | undefined  | NULL            | null       |
   *
   * If no value is provided to a given parameter,
   * SQLite will default to NULL.
   *
   * If a `Date` is bound, it will be converted to
   * an ISO 8601 string: `YYYY-MM-DDTHH:MM:SS.SSSZ`.
   * This format is understood by built-in SQLite
   * date-time functions. Also see
   * https://sqlite.org/lang_datefunc.html.
   *
   * This always returns an iterable Rows object.
   * As a special case, if the query has no rows
   * to return this returns the Empty row (which
   * is also iterable, but has zero entries).
   *
   * !> Any returned Rows object needs to be fully
   * iterated over or discarded by calling
   * `.done()`.
   */
  query(sql, values) {
    if (!this._open) {
      throw new SqliteError("Database was closed.");
    }
    if (typeof sql !== "string") {
      throw new SqliteError("SQL query must be a string.");
    }

    // Update time in WASI for next query
    // TODO(dyedgreen): should this be called in other places as well?
    this._wasm.update_time(Date.now() / 1000 / 86400.0 + 2440587.5);

    // Prepare sqlite query statement
    let id;
    setStr(this._wasm, sql, (ptr) => {
      id = this._wasm.prepare(this._id, ptr);
    });
    if (id === constants.Values.Error) {
      throw this._error();
    }

    // Prepare parameter array
    let parameters = [];
    if (Array.isArray(values)) {
      // Positional values correspond to parameters
      parameters = values;
    } else if (typeof values === "object") {
      // Named values need to have their index resolved
      for (const key of Object.keys(values)) {
        let idx;
        // Prepend ':' to name, if it does not have a special starting character
        let name = key;
        if (name[0] !== ":" && name[0] !== "@" && name[0] !== "$") {
          name = `:${name}`;
        }
        setStr(this._wasm, name, (ptr) => {
          idx = this._wasm.bind_parameter_index(this._id, id, ptr);
        });
        if (idx === constants.Values.Error) {
          this._wasm.finalize(this._id, id);
          throw new SqliteError(`No parameter named '${name}'.`);
        }
        parameters[idx - 1] = values[key];
      }
    }

    // Bind parameters
    for (let i = 0; i < parameters.length; i++) {
      let value = parameters[i], status;
      switch (typeof value) {
        case "boolean":
          value = value ? 1 : 0;
        // fall through
        case "number":
          if (Math.floor(value) === value) {
            status = this._wasm.bind_int(this._id, id, i + 1, value);
          } else {
            status = this._wasm.bind_double(this._id, id, i + 1, value);
          }
          break;
        case "string":
          setStr(this._wasm, value, (ptr) => {
            status = this._wasm.bind_text(this._id, id, i + 1, ptr);
          });
          break;
        default:
          if (value instanceof Date) {
            // Dates are allowed and bound to TEXT, formatted `YYYY-MM-DDTHH:MM:SS.SSSZ`
            setStr(this._wasm, value.toISOString(), (ptr) => {
              status = this._wasm.bind_text(this._id, id, i + 1, ptr);
            });
          } else if (value instanceof Uint8Array) {
            // Uint8Arrays are allowed and bound to BLOB
            setArr(this._wasm, value, (ptr) => {
              status = this._wasm.bind_blob(
                this._id,
                id,
                i + 1,
                ptr,
                value.length,
              );
            });
          } else if (value === null || value === undefined) {
            // Both null and undefined result in a NULL entry
            status = this._wasm.bind_null(this._id, id, i + 1);
          } else {
            this._wasm.finalize(this._id, id);
            throw new SqliteError(`Can not bind ${typeof value}.`);
          }
          break;
      }
      if (status !== constants.Status.SqliteOk) {
        this._wasm.finalize(this._id, id);
        throw this._error(status);
      }
    }

    // Step once to handle case where result is empty
    const status = this._wasm.step(this._id, id);
    switch (status) {
      case constants.Status.SqliteDone:
        this._wasm.finalize(this._id, id);
        return Empty;
        break;
      case constants.Status.SqliteRow:
        return new Rows(this, id);
        break;
      default:
        this._wasm.finalize(this._id, id);
        throw this._error(status);
        break;
    }
  }

  /**
   * DB.data
   *
   * Return SQLite file as a `Uint8Array`. This
   * makes a copy of the data. To save the data
   * to a file prefer to use `save()` exported by
   * `mod.ts`, which avoids making a copy.
   *
   * ?> Making a copy of a database could be done like
   * this: `const copy = new DB(original.data());`
   */
  data() {
    if (!this._open) {
      throw new SqliteError("Database was closed.");
    }
    const ptr = this._wasm.get_db_file(this._id);
    const len = this._wasm.get_db_file_size(this._id);
    return new Uint8Array(this._wasm.memory.buffer, ptr, len).slice();
  }

  /**
   * DB.close
   *
   * Close database handle. This must be called if
   * DB is no longer used.
   *
   * !> Not closing the database may cause you to
   * encounter the limit for open database
   * connections.
   */
  close() {
    if (!this._open) {
      return;
    }
    if (this._wasm.close(this._id) !== constants.Status.SqliteOk) {
      throw this._error();
    }
    this._open = false;
  }

  _error(code) {
    if (code === undefined) {
      code = this._wasm.get_status();
    }
    switch (code) {
      case constants.Status.StmtLimit:
        return new SqliteError("Statement limit reached.", code);
        break;
      case constants.Status.NoStmt:
        return new SqliteError("Statement not found.", code);
        break;
      case constants.Status.DatabaseLimit:
        return new SqliteError("Database limit reached.", code);
        break;
      case constants.Status.NoDatabase:
        return new SqliteError("Database not found.", code);
        break;
      default:
        // SQLite error
        const msg = getStr(
          this._wasm,
          this._wasm.get_sqlite_error_str(this._id),
        );
        return new SqliteError(msg, code);
        break;
    }
  }
}
