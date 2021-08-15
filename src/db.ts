import instantiate, { StatementPtr, Wasm } from "../build/sqlite.js";
import { setStr } from "./wasm.ts";
import { OpenFlags, Status, Values } from "./constants.ts";
import { SqliteError } from "./error.ts";
import { PreparedQuery, QueryParameterSet, Row, RowObject } from "./query.ts";

/**
 * Options for opening a database.
 *
 * The `mode` can be set to control
 * how the database file will be
 * opened.
 *
 * If `memory` is set to true, the
 * database will be opened as an in
 * memory database.
 *
 * If `uri` is set to true, the file
 * name accepts a URI. See https://sqlite.org/uri.html
 * for more information on the URI
 * format.
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
    const status = setStr(
      this._wasm,
      path,
      (ptr) => this._wasm.open(ptr, flags),
    );
    if (status !== Status.SqliteOk) {
      throw new SqliteError(this._wasm, status);
    }
    this._open = true;
  }

  /**
   * Query the database and return all matching
   * rows.
   *
   * This is equivalent to calling `all` on
   * a prepared query which is then immediately
   * finalized.
   *
   * The type parameter `R` may be supplied by
   * the user to indicated the type for the rows returned
   * by the query. Notice that the user is responsible
   * for ensuring the correctness of the supplied type.
   *
   * To avoid SQL injection, user-provided values
   * should always be passed to the database through
   * a query parameter.
   *
   * See `QueryParameterSet` for documentation on
   * how values can be bound to SQL statements.
   *
   * See `QueryParameter` for documentation on how
   * values are returned from the database.
   */
  query<R extends Row = Row>(
    sql: string,
    params?: QueryParameterSet,
  ): Array<R> {
    const query = this.prepareQuery<R>(sql);
    try {
      const rows = query.all(params);
      query.finalize();
      return rows;
    } catch (err) {
      query.finalize();
      throw err;
    }
  }

  /**
   * Like `query` except each row is returned
   * as an object containing key-value pairs.
   */
  queryEntries<O extends RowObject = RowObject>(
    sql: string,
    params?: QueryParameterSet,
  ): Array<O> {
    const query = this.prepareQuery<Row, O>(sql);
    try {
      const rows = query.allEntries(params);
      query.finalize();
      return rows;
    } catch (err) {
      query.finalize();
      throw err;
    }
  }

  /**
   * Prepares the given SQL query, so that it
   * can be run multiple times and potentially
   * with different parameters.
   *
   * If a query will be issued a lot, this is more
   * efficient than using `query`. A prepared
   * query also provides more control over how
   * the query is run, as well as access to meta-data
   * about the issued query.
   *
   * The returned `PreparedQuery` object must be
   * finalized by calling its `finalize` method
   * once it is no longer needed.
   *
   * ## Typing Queries
   *
   * Prepared query objects accept three type parameters
   * to specify precise types for returned data and
   * query parameters.
   *
   * The first type parameter `R` indicates the tuple type
   * for rows returned by the query.
   *
   * The second type parameter `O` indicates the record type
   * for rows returned as entries (mappings from column names
   * to values).
   *
   * The third type parameter `P` indicates the type this query
   * accepts as parameters.
   *
   * Note, that the correctness of those types must
   * be guaranteed by the caller of this function.
   */
  prepareQuery<
    R extends Row = Row,
    O extends RowObject = RowObject,
    P extends QueryParameterSet = QueryParameterSet,
  >(
    sql: string,
  ): PreparedQuery<R, O, P> {
    if (!this._open) {
      throw new SqliteError("Database was closed.");
    }

    const stmt = setStr(
      this._wasm,
      sql,
      (ptr) => this._wasm.prepare(ptr),
    );
    if (stmt === Values.Null) {
      throw new SqliteError(this._wasm);
    }

    this._statements.add(stmt);
    return new PreparedQuery<R, O, P>(this._wasm, stmt, this._statements);
  }

  /**
   * Close the database. This must be called if
   * the database is no longer used to avoid leaking
   * open file descriptors.
   *
   * If force is specified, any active `PreparedQuery`
   * will be finalized. Otherwise, this throws if there
   * are active queries.
   *
   * `close` may safely be called multiple
   * times.
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
   * Before a row is inserted for the first time (since
   * the database was opened), this returns `0`.
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
