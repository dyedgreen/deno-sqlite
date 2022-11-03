import { instantiate, StatementPtr, Wasm } from "../build/sqlite.js";
import { setStr } from "./wasm.ts";
import { FunctionFlags, OpenFlags, Status, Values } from "./constants.ts";
import { SqliteError } from "./error.ts";
import { PreparedQuery, QueryParameterSet, Row, RowObject } from "./query.ts";
import {
  SqlFunction,
  SqlFunctionArgument,
  SqlFunctionResult,
  wrapSqlFunction,
} from "./function.ts";

/**
 * Options for opening a database.
 */
export interface SqliteOptions {
  /**
   * Mode in which to open the database.
   *
   * - `read`: read-only, throws an error if
   *   the database file does not exists
   * - `write`: read-write, throws an error
   *   if the database file does not exists
   * - `create`: read-write, create the database
   *   if the file does not exist
   *
   * `create` is the default if no mode is
   * specified.
   */
  mode?: "read" | "write" | "create";
  /**
   * Force the database to be in-memory. When
   * this option is set, the database is opened
   * in memory, regardless of the specified
   * filename.
   */
  memory?: boolean;
  /**
   * Interpret the file name as a URI.
   * See https://sqlite.org/uri.html
   * for more information.
   */
  uri?: boolean;
}

export interface SqliteFunctionOptions {
  name?: string;
  deterministic?: boolean;
  directOnly?: boolean;
}

/**
 * A database handle that can be used to run
 * queries.
 */
export class DB {
  #wasm: Wasm;
  #functions: Array<(argc: number) => void>;
  #open: boolean;

  #statements: Set<StatementPtr>;
  #functionNames: Map<string, number>;
  #transactionDepth: number;

  /**
   * Create a new database. The file at the
   * given path will be opened with the
   * mode specified in options. The default
   * mode is `create`.
   *
   * If no path is given, or if the `memory`
   * option is set, the database is opened in
   * memory.
   *
   * # Examples
   *
   * Create an in-memory database.
   * ```typescript
   * const db = new DB();
   * ```
   *
   * Open a database backed by a file on disk.
   * ```typescript
   * const db = new DB("path/to/database.sqlite");
   * ```
   *
   * Pass options to open a read-only database.
   * ```typescript
   * const db = new DB("path/to/database.sqlite", { mode: "read" });
   * ```
   */
  constructor(path: string = ":memory:", options: SqliteOptions = {}) {
    const instance = instantiate();
    this.#wasm = instance.exports;
    this.#functions = instance.functions;
    this.#open = false;

    this.#statements = new Set();
    this.#functionNames = new Map();
    this.#transactionDepth = 0;

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
      this.#wasm,
      path,
      (ptr) => this.#wasm.open(ptr, flags),
    );
    if (status !== Status.SqliteOk) {
      throw new SqliteError(this.#wasm, status);
    }
    this.#open = true;
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
   *
   * # Examples
   *
   * ```typescript
   * const rows = db.query<[string, number]>("SELECT name, age FROM people WHERE city = ?", [city]);
   * // rows = [["Peter Parker", 21], ...]
   * ```
   *
   * ```typescript
   * const rows = db.query<[string, number]>(
   *   "SELECT name, age FROM people WHERE city = :city",
   *   { city },
   *  );
   * // rows = [["Peter Parker", 21], ...]
   * ```
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
   *
   * # Examples
   *
   * ```typescript
   * const rows = db.queryEntries<{ name: string, age: number }>("SELECT name, age FROM people");
   * // rows = [{ name: "Peter Parker", age: 21 }, ...]
   * ```
   *
   * ```typescript
   * const rows = db.queryEntries<{ name: string, age: number }>(
   *   "SELECT name, age FROM people WHERE age >= :minAge",
   *   { minAge },
   *  );
   * // rows = [{ name: "Peter Parker", age: 21 }, ...]
   * ```
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
   * # Typing Queries
   *
   * Prepared query objects accept three type parameters
   * to specify precise types for returned data and
   * query parameters.
   *
   * - The first type parameter `R` indicates the tuple type
   *   for rows returned by the query.
   *
   * - The second type parameter `O` indicates the record type
   *   for rows returned as entries (mappings from column names
   *   to values).
   *
   * - The third type parameter `P` indicates the type this query
   *   accepts as parameters.
   *
   * Note, that the correctness of those types must
   * be guaranteed by the caller of this function.
   *
   * # Example
   *
   * ```typescript
   * const query = db.prepareQuery<
   *   [string, number],
   *   { name: string, age: number },
   *   { city: string },
   *  >("SELECT name, age FROM people WHERE city = :city");
   * // use query ...
   * query.finalize();
   * ```
   */
  prepareQuery<
    R extends Row = Row,
    O extends RowObject = RowObject,
    P extends QueryParameterSet = QueryParameterSet,
  >(
    sql: string,
  ): PreparedQuery<R, O, P> {
    if (!this.#open) {
      throw new SqliteError("Database was closed.");
    }

    const stmt = setStr(
      this.#wasm,
      sql,
      (ptr) => this.#wasm.prepare(ptr),
    );
    if (stmt === Values.Null) {
      throw new SqliteError(this.#wasm);
    }

    this.#statements.add(stmt);
    return new PreparedQuery<R, O, P>(this.#wasm, stmt, this.#statements);
  }

  /**
   * Run multiple semicolon-separated statements from a single
   * string.
   *
   * This method cannot bind any query parameters, and any
   * result rows are discarded. It is only for running a chunk
   * of raw SQL; for example, to initialize a database.
   *
   * # Example
   *
   * ```typescript
   * db.execute(`
   *   CREATE TABLE people (
   *     id INTEGER PRIMARY KEY AUTOINCREMENT,
   *     name TEXT,
   *     age REAL,
   *     city TEXT
   *   );
   *   INSERT INTO people (name, age, city) VALUES ("Peter Parker", 21, "nyc");
   * `);
   * ```
   */
  execute(sql: string) {
    const status = setStr(
      this.#wasm,
      sql,
      (ptr) => this.#wasm.exec(ptr),
    );

    if (status !== Status.SqliteOk) {
      throw new SqliteError(this.#wasm, status);
    }
  }

  /**
   * Run a function within the context of a database
   * transaction. If the function throws an error,
   * the transaction is rolled back. Otherwise, the
   * transaction is committed when the function returns.
   *
   * Calls to `transaction` may be nested. Nested transactions
   * behave like SQLite save points.
   *
   * # Example
   *
   * ```typescript
   * db.transaction(() => {
   *   // call db.query) ...
   *   db.transaction(() => {
   *     // nested transaction
   *   });
   *   // throw to roll back everything
   * });
   * ```
   */
  transaction<V>(closure: () => V): V {
    this.#transactionDepth += 1;
    this.query(`SAVEPOINT _deno_sqlite_sp_${this.#transactionDepth}`);
    let value;
    try {
      value = closure();
    } catch (err) {
      this.query(`ROLLBACK TO _deno_sqlite_sp_${this.#transactionDepth}`);
      this.#transactionDepth -= 1;
      throw err;
    }
    this.query(`RELEASE _deno_sqlite_sp_${this.#transactionDepth}`);
    this.#transactionDepth -= 1;
    return value;
  }

  createFunction<
    A extends Array<SqlFunctionArgument> = Array<SqlFunctionArgument>,
    R extends SqlFunctionResult = SqlFunctionResult,
  >(func: (...args: A) => R, options?: SqliteFunctionOptions) {
    const name = options?.name ?? func.name;
    if (name === "") {
      throw new SqliteError("Function name can not be empty.");
    }

    const argc = func.length === 0 ? -1 : func.length;
    let flags = 0;
    if (options?.deterministic ?? false) flags |= FunctionFlags.Deterministic;
    if (options?.directOnly ?? true) flags |= FunctionFlags.DirectOnly;
    let funcIdx = 0;
    while (this.#functions[funcIdx] != undefined) funcIdx++;
    const status = setStr(
      this.#wasm,
      name,
      (name) => this.#wasm.create_function(name, argc, flags, funcIdx),
    );

    if (status !== Status.SqliteOk) {
      throw new SqliteError(this.#wasm, status);
    } else {
      this.#functions[funcIdx] = wrapSqlFunction(
        this.#wasm,
        name,
        /* This cast is not fully correct (because function arguments
         * are contra-variant), but makes defining custom functions
         * slightly nicer. */
        func as unknown as SqlFunction,
      );
      this.#functionNames.set(name, funcIdx);
    }
  }

  deleteFunction(name: string) {
    if (this.#functionNames.has(name)) {
      const status = setStr(
        this.#wasm,
        name,
        (pts) => this.#wasm.delete_function(pts),
      );
      if (status === Status.SqliteOk) {
        const funcIdx = this.#functionNames.get(name)!;
        this.#functionNames.delete(name);
        delete this.#functions[funcIdx];
      } else {
        throw new SqliteError(this.#wasm, status);
      }
    } else {
      throw new SqliteError(`User defined function '${name}' does not exist`);
    }
  }

  /**
   * Close the database. This must be called if
   * the database is no longer used to avoid leaking
   * open file descriptors.
   *
   * If called with `force = true`, any non-finalized
   * `PreparedQuery` objects will be finalized. Otherwise,
   * this throws if there are active queries.
   *
   * `close` may safely be called multiple
   * times.
   */
  close(force = false) {
    if (!this.#open) {
      return;
    }
    if (force) {
      for (const stmt of this.#statements) {
        if (this.#wasm.finalize(stmt) !== Status.SqliteOk) {
          throw new SqliteError(this.#wasm);
        }
      }
    }
    if (this.#wasm.close() !== Status.SqliteOk) {
      throw new SqliteError(this.#wasm);
    }
    this.#open = false;
  }

  /**
   * Get last inserted row id. This corresponds to
   * the SQLite function `sqlite3_last_insert_rowid`.
   *
   * Before a row is inserted for the first time (since
   * the database was opened), this returns `0`.
   */
  get lastInsertRowId(): number {
    return this.#wasm.last_insert_rowid();
  }

  /**
   * Return the number of rows modified, inserted or
   * deleted by the most recently completed query.
   * This corresponds to the SQLite function
   * `sqlite3_changes`.
   */
  get changes(): number {
    return this.#wasm.changes();
  }

  /**
   * Return the number of rows modified, inserted or
   * deleted since the database was opened.
   * This corresponds to the SQLite function
   * `sqlite3_total_changes`.
   */
  get totalChanges(): number {
    return this.#wasm.total_changes();
  }
}
