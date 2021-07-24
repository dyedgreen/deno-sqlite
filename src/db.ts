// @deno-types="../build/sqlite.d.ts"
import instantiate, { StatementPtr, Wasm } from "../build/sqlite.js";
import { setStr } from "./wasm.ts";
import { OpenFlags, Status, Values } from "./constants.ts";
import { SqliteError } from "./error.ts";
import { PreparedQuery, QueryParameterSet, Row } from "./query.ts";

/**
 * Options for opening a database.
 */
export interface SqliteOptions {
  mode?: "read" | "write" | "create";
  memory?: boolean;
  uri?: boolean;
}

export class DB {
  private _wasm: Wasm;
  private _open: boolean;
  private _statements: Set<StatementPtr>;

  /**
   * Create a new database. The file at the
   * given path will be opened with the
   * mode specified in options. The default
   * mode is `create`.
   *
   * If no path is given, or if the `memory`
   * option is set, the database is opened in
   * memory.
   */
  constructor(path: string = ":memory:", options: SqliteOptions = {}) {
    this._wasm = instantiate().exports;
    this._open = false;
    this._statements = new Set();

    // Configure flags
    let flags = 0;
    switch (options.mode) {
      case "read":
        flags = OpenFlags.ReadOnly;
        break;
      case "write":
        flags = OpenFlags.ReadWrite;
        break;
      case "create": // fall through
      default:
        flags = OpenFlags.ReadWrite | OpenFlags.Create;
        break;
    }
    if (options.memory === true) {
      flags |= OpenFlags.Memory;
    }
    if (options.uri === true) {
      flags |= OpenFlags.Uri;
    }

    // Try to open the database
    let status;
    setStr(this._wasm, path, (ptr) => {
      status = this._wasm.open(ptr, flags);
    });
    if (status !== Status.SqliteOk) {
      throw new SqliteError(this._wasm, status);
    }
    this._open = true;
  }

  query(sql: string, params?: QueryParameterSet): Array<Row> {
    const query = this.prepareQuery(sql);
    try {
      const rows = query.queryAll(params);
      query.finalize();
      return rows;
    } catch (err) {
      query.finalize();
      throw err;
    }
  }

  prepareQuery(sql: string): PreparedQuery {
    if (!this._open) {
      throw new SqliteError("Database was closed.");
    }

    const stmt: StatementPtr = setStr(
      this._wasm,
      sql,
      (ptr) => this._wasm.prepare(ptr),
    );
    if (stmt === Values.Null) {
      throw new SqliteError(this._wasm);
    }

    this._statements.add(stmt);
    return new PreparedQuery(this._wasm, stmt, this._statements);
  }

  /**
   * Close the database. This must be called if
   * the database is no longer used to avoid leaking
   * open file descriptors.
   *
   * If force is specified, any active `PreparedQuery`s
   * will be finalized. Otherwise, this throws if there
   * are active queries.
   */
  close(force = false) {
    if (!this._open) {
      return;
    }
    if (force) {
      for (const stmt of this._statements) {
        if (this._wasm.finalize(stmt) !== Status.SqliteOk) {
          throw new SqliteError(this._wasm);
        }
      }
    }
    if (this._wasm.close() !== Status.SqliteOk) {
      throw new SqliteError(this._wasm);
    }
    this._open = false;
  }

  /**
   * Get last inserted row id. This corresponds to
   * the SQLite function `sqlite3_last_insert_rowid`.
   *
   * By default, it will return 0 if there is no row
   * inserted yet.
   */
  get lastInsertRowId(): number {
    return this._wasm.last_insert_rowid();
  }

  /**
   * Return the number of rows modified, inserted or
   * deleted by the most recently completed query.
   * This corresponds to the SQLite function
   * `sqlite3_changes`.
   */
  get changes(): number {
    return this._wasm.changes();
  }

  /**
   * Return the number of rows modified, inserted or
   * deleted since the database was opened.
   * This corresponds to the SQLite function
   * `sqlite3_total_changes`.
   */
  get totalChanges(): number {
    return this._wasm.total_changes();
  }
}
