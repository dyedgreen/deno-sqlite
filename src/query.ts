import { StatementPtr, Wasm } from "../build/sqlite.js";
import { getStr, setArr, setStr } from "./wasm.ts";
import { Status, Types, Values } from "./constants.ts";
import { SqliteError } from "./error.ts";

/**
 * The default type for returned rows.
 */
export type Row = Array<unknown>;

/**
 * The default type for row returned
 * as objects.
 */
export type RowObject = Record<string, unknown>;

/**
 * Possible parameter values to be bound to a query.
 *
 * When values are bound to a query, they are
 * converted between JavaScript and SQLite types
 * in the following way:
 *
 * | JS type in | SQL type        | JS type out      |
 * |------------|-----------------|------------------|
 * | number     | INTEGER or REAL | number           |
 * | bigint     | INTEGER         | number or bigint |
 * | boolean    | INTEGER         | number           |
 * | string     | TEXT            | string           |
 * | Date       | TEXT            | string           |
 * | Uint8Array | BLOB            | Uint8Array       |
 * | null       | NULL            | null             |
 * | undefined  | NULL            | null             |
 *
 * If no value is provided for a given parameter,
 * SQLite will default to NULL.
 *
 * If a `bigint` is bound, it is converted to a
 * signed 64 bit integer, which may overflow.
 *
 * If an integer value is read from the database, which
 * is too big to safely be contained in a `number`, it
 * is automatically returned as a `bigint`.
 *
 * If a `Date` is bound, it will be converted to
 * an ISO 8601 string: `YYYY-MM-DDTHH:MM:SS.SSSZ`.
 * This format is understood by built-in SQLite
 * date-time functions. Also see https://sqlite.org/lang_datefunc.html.
 */
export type QueryParameter =
  | boolean
  | number
  | bigint
  | string
  | null
  | undefined
  | Date
  | Uint8Array;

/**
 * A set of query parameters.
 *
 * When a query is constructed, it can contain
 * either positional or named parameters. For
 * more information see https://www.sqlite.org/lang_expr.html#parameters.
 *
 * A set of parameters can be passed to
 * a query method either as an array of
 * parameters (in positional order), or
 * as an object which maps parameter names
 * to their values:
 *
 * | SQL Parameter | QueryParameterSet       |
 * |---------------|-------------------------|
 * | `?NNN` or `?` | NNN-th value in array   |
 * | `:AAAA`       | value `AAAA` or `:AAAA` |
 * | `@AAAA`       | value `@AAAA`           |
 * | `$AAAA`       | value `$AAAA`           |
 *
 * See `QueryParameter` for documentation on
 * how values are converted between SQL
 * and JavaScript types.
 */
export type QueryParameterSet =
  | Record<string, QueryParameter>
  | Array<QueryParameter>;

/**
 * Name of a column returned from a database query.
 */
export interface ColumnName {
  /**
   * Name of the returned column.
   *
   * Corresponds to the `sqlite3_column_name`
   * function.
   */
  name: string;
  /**
   * Name of the database column that stores
   * the data returned from this query.
   *
   * This might be different from `name` if a
   * columns was renamed using e.g. as in
   * `SELECT foo AS bar FROM table`.
   *
   * Corresponds to the `sqlite3_column_origin_name`
   * function.
   */
  originName: string;
  /**
   * Name of the table that stores the data
   * returned from this query.
   *
   * Corresponds to the `sqlite3_column_table_name`
   * function.
   */
  tableName: string;
}

interface RowsIterator<R> {
  next: () => IteratorResult<R>;
  [Symbol.iterator]: () => RowsIterator<R>;
}

/**
 * A prepared query which can be executed many
 * times.
 */
export class PreparedQuery<
  R extends Row = Row,
  O extends RowObject = RowObject,
  P extends QueryParameterSet = QueryParameterSet,
> {
  #wasm: Wasm;
  #stmt: StatementPtr;
  #openStatements: Set<StatementPtr>;

  #status: number;
  #iterKv: boolean;
  #rowKeys?: Array<string>;
  #finalized: boolean;

  /**
   * This constructor should never be used directly.
   * Instead a prepared query can be obtained by
   * calling `DB.prepareQuery`.
   */
  constructor(
    wasm: Wasm,
    stmt: StatementPtr,
    openStatements: Set<StatementPtr>,
  ) {
    this.#wasm = wasm;
    this.#stmt = stmt;
    this.#openStatements = openStatements;

    this.#status = Status.Unknown;
    this.#iterKv = false;
    this.#finalized = false;
  }

  #startQuery(params?: P) {
    if (this.#finalized) {
      throw new SqliteError("Query is finalized.");
    }

    // Reset query
    this.#wasm.reset(this.#stmt);
    this.#wasm.clear_bindings(this.#stmt);

    // Prepare parameter array
    let parameters = [];
    if (Array.isArray(params)) {
      parameters = params;
    } else if (typeof params === "object") {
      // Resolve parameter index for named parameter
      for (const key of Object.keys(params)) {
        let name = key;
        // blank names default to ':'
        if (name[0] !== ":" && name[0] !== "@" && name[0] !== "$") {
          name = `:${name}`;
        }
        const idx = setStr(
          this.#wasm,
          name,
          (ptr) => this.#wasm.bind_parameter_index(this.#stmt, ptr),
        );
        if (idx === Values.Error) {
          throw new SqliteError(`No parameter named '${name}'.`);
        }
        parameters[idx - 1] = params[key];
      }
    }

    // Bind parameters
    for (let i = 0; i < parameters.length; i++) {
      let value = parameters[i];
      let status;
      switch (typeof value) {
        case "boolean":
          value = value ? 1 : 0;
          // fall through
        case "number":
          if (Number.isSafeInteger(value)) {
            status = this.#wasm.bind_int(this.#stmt, i + 1, value);
          } else {
            status = this.#wasm.bind_double(this.#stmt, i + 1, value);
          }
          break;
        case "bigint":
          // bigint is bound as two 32bit integers and reassembled on the C side
          if (value > 9223372036854775807n || value < -9223372036854775808n) {
            throw new SqliteError(
              `BigInt value ${value} overflows 64 bit integer.`,
            );
          } else {
            const posVal = value >= 0n ? value : -value;
            const sign = value >= 0n ? 1 : -1;
            const upper = Number(BigInt.asUintN(32, posVal >> 32n));
            const lower = Number(BigInt.asUintN(32, posVal));
            status = this.#wasm.bind_big_int(
              this.#stmt,
              i + 1,
              sign,
              upper,
              lower,
            );
          }
          break;
        case "string":
          status = setStr(
            this.#wasm,
            value,
            (ptr) => this.#wasm.bind_text(this.#stmt, i + 1, ptr),
          );
          break;
        default:
          if (value instanceof Date) {
            // Dates are allowed and bound to TEXT, formatted `YYYY-MM-DDTHH:MM:SS.SSSZ`
            status = setStr(
              this.#wasm,
              value.toISOString(),
              (ptr) => this.#wasm.bind_text(this.#stmt, i + 1, ptr),
            );
          } else if (value instanceof Uint8Array) {
            // Uint8Arrays are allowed and bound to BLOB
            const size = value.length;
            status = setArr(
              this.#wasm,
              value,
              (ptr) => this.#wasm.bind_blob(this.#stmt, i + 1, ptr, size),
            );
          } else if (value === null || value === undefined) {
            // Both null and undefined result in a NULL entry
            status = this.#wasm.bind_null(this.#stmt, i + 1);
          } else {
            throw new SqliteError(`Can not bind ${typeof value}.`);
          }
          break;
      }
      if (status !== Status.SqliteOk) {
        throw new SqliteError(this.#wasm, status);
      }
    }
  }

  #getQueryRow(): R {
    if (this.#finalized) {
      throw new SqliteError("Query is finalized.");
    }

    const columnCount = this.#wasm.column_count(this.#stmt);
    const row: Row = new Array(columnCount);
    for (let columnIdx = 0; columnIdx < columnCount; columnIdx++) {
      switch (this.#wasm.column_type(this.#stmt, columnIdx)) {
        case Types.Integer:
          row[columnIdx] = this.#wasm.column_int(this.#stmt, columnIdx);
          break;
        case Types.Float:
          row[columnIdx] = this.#wasm.column_double(this.#stmt, columnIdx);
          break;
        case Types.Text:
          row[columnIdx] = getStr(
            this.#wasm,
            this.#wasm.column_text(this.#stmt, columnIdx),
          );
          break;
        case Types.Blob: {
          const ptr = this.#wasm.column_blob(this.#stmt, columnIdx);
          if (ptr === 0) {
            // Zero pointer results in null
            row[columnIdx] = null;
          } else {
            const length = this.#wasm.column_bytes(this.#stmt, columnIdx);
            // Slice should copy the bytes, as it makes a shallow copy
            row[columnIdx] = new Uint8Array(
              this.#wasm.memory.buffer,
              ptr,
              length,
            ).slice();
          }
          break;
        }
        case Types.BigInteger: {
          const ptr = this.#wasm.column_text(this.#stmt, columnIdx);
          row[columnIdx] = BigInt(getStr(this.#wasm, ptr));
          break;
        }
        default:
          // TODO(dyedgreen): Differentiate between NULL and not-recognized?
          row[columnIdx] = null;
          break;
      }
    }
    return row as R;
  }

  #makeRowObject(row: Row): O {
    if (this.#rowKeys == null) {
      const rowCount = this.#wasm.column_count(this.#stmt);
      this.#rowKeys = [];
      for (let i = 0; i < rowCount; i++) {
        this.#rowKeys.push(
          getStr(this.#wasm, this.#wasm.column_name(this.#stmt, i)),
        );
      }
    }

    const obj = row.reduce<RowObject>((obj, val, idx) => {
      obj[this.#rowKeys![idx]] = val;
      return obj;
    }, {});
    return obj as O;
  }

  /**
   * Binds the given parameters to the query
   * and returns an iterator over rows.
   *
   * Using an iterator avoids loading all returned
   * rows into memory and hence allows to process a large
   * number of rows.
   *
   * Calling `iter`, `all`, or `first` invalidates any iterators
   * previously returned from this prepared query.
   *
   * # Examples
   *
   * ```typescript
   * const query = db.prepareQuery<[number, string]>("SELECT id, name FROM people");
   * for (const [id, name] of query.iter()) {
   *   // ...
   * }
   * ```
   *
   * To avoid SQL injection, user-provided values
   * should always be passed to the database through
   * a query parameter.
   *
   * ```typescript
   * const query = db.prepareQuery("SELECT id FROM people WHERE name = ?");
   * query.iter([name]);
   * ```
   *
   * ```typescript
   * const query = db.prepareQuery("SELECT id FROM people WHERE name = :name");
   * query.iter({ name });
   * ```
   *
   * See `QueryParameterSet` for documentation on
   * how values can be bound to SQL statements.
   *
   * See `QueryParameter` for documentation on how
   * values are returned from the database.
   */
  iter(params?: P): RowsIterator<R> {
    this.#startQuery(params);
    this.#status = this.#wasm.step(this.#stmt);
    if (
      this.#status !== Status.SqliteRow && this.#status !== Status.SqliteDone
    ) {
      throw new SqliteError(this.#wasm, this.#status);
    }
    this.#iterKv = false;
    return this as RowsIterator<R>;
  }

  /**
   * Like `iter` except each row is returned
   * as an object containing key-value pairs.
   *
   * # Example
   *
   * ```typescript
   * const query = db.prepareQuery<[number, string], { id: number, name: string }>("SELECT id, name FROM people");
   * for (const { id, name } of query.iterEntries()) {
   *   // ...
   * }
   * ```
   */
  iterEntries(params?: P): RowsIterator<O> {
    this.iter(params);
    this.#iterKv = true;
    return this as RowsIterator<O>;
  }

  /**
   * @ignore
   *
   * Implements the iterable protocol. It is
   * a bug to call this method directly.
   */
  [Symbol.iterator](): RowsIterator<R | O> {
    return this;
  }

  /**
   * @ignore
   *
   * Implements the iterator protocol. It is
   * a bug to call this method directly.
   */
  next(): IteratorResult<R | O> {
    if (this.#status === Status.SqliteRow) {
      const value = this.#getQueryRow();
      this.#status = this.#wasm.step(this.#stmt);
      if (this.#iterKv) {
        return { value: this.#makeRowObject(value), done: false };
      } else {
        return { value, done: false };
      }
    } else if (this.#status === Status.SqliteDone) {
      return { value: null, done: true };
    } else {
      throw new SqliteError(this.#wasm, this.#status);
    }
  }

  /**
   * Binds the given parameters to the query
   * and returns an array containing all resulting
   * rows.
   *
   * # Examples
   *
   * ```typescript
   * const query = db.prepareQuery<[number, string]>("SELECT id, name FROM people");
   * const rows = query.all();
   * // rows = [[1, "Peter"], ...]
   * ```
   *
   * To avoid SQL injection, user-provided values
   * should always be passed to the database through
   * a query parameter.
   *
   * ```typescript
   * const query = db.prepareQuery("SELECT id FROM people WHERE name = ?");
   * query.all([name]);
   * ```
   *
   * ```typescript
   * const query = db.prepareQuery("SELECT id FROM people WHERE name = :name");
   * query.all({ name });
   * ```
   *
   * See `QueryParameterSet` for documentation on
   * how values can be bound to SQL statements.
   *
   * See `QueryParameter` for documentation on how
   * values are returned from the database.
   */
  all(params?: P): Array<R> {
    this.#startQuery(params);
    const rows: Array<R> = [];
    this.#status = this.#wasm.step(this.#stmt);
    while (this.#status === Status.SqliteRow) {
      rows.push(this.#getQueryRow());
      this.#status = this.#wasm.step(this.#stmt);
    }
    if (this.#status !== Status.SqliteDone) {
      throw new SqliteError(this.#wasm, this.#status);
    }
    return rows;
  }

  /**
   * Like `all` except each row is returned
   * as an object containing key-value pairs.
   *
   * # Example
   *
   * ```typescript
   * const query = db.prepareQuery<[number, string], { id: number, name: string }>("SELECT id, name FROM people");
   * const rows = query.allEntries();
   * // rows = [{ id: 1, name: "Peter" }, ...]
   * ```
   */
  allEntries(params?: P): Array<O> {
    return this.all(params).map((row) => this.#makeRowObject(row));
  }

  /**
   * Binds the given parameters to the query
   * and returns the first resulting row or
   * `undefined` when there are no rows returned
   * by the query.
   *
   * # Examples
   *
   * ```typescript
   * const query = db.prepareQuery<[number, string]>("SELECT id, name FROM people");
   * const person = query.first();
   * // person = [1, "Peter"]
   * ```
   *
   * ```typescript
   * const query = db.prepareQuery("SELECT id, name FROM people WHERE name = ?");
   * const person = query.first(["not a name"]);
   * // person = undefined
   * ```
   *
   * To avoid SQL injection, user-provided values
   * should always be passed to the database through
   * a query parameter.
   *
   * ```typescript
   * const query = db.prepareQuery("SELECT id FROM people WHERE name = ?");
   * query.first([name]);
   * ```
   *
   * ```typescript
   * const query = db.prepareQuery("SELECT id FROM people WHERE name = :name");
   * query.first({ name });
   * ```
   *
   * See `QueryParameterSet` for documentation on
   * how values can be bound to SQL statements.
   *
   * See `QueryParameter` for documentation on how
   * values are returned from the database.
   */
  first(params?: P): R | undefined {
    this.#startQuery(params);

    this.#status = this.#wasm.step(this.#stmt);
    let row = undefined;
    if (this.#status === Status.SqliteRow) {
      row = this.#getQueryRow();
    }

    while (this.#status === Status.SqliteRow) {
      this.#status = this.#wasm.step(this.#stmt);
    }
    if (this.#status !== Status.SqliteDone) {
      throw new SqliteError(this.#wasm, this.#status);
    }

    return row;
  }

  /**
   * Like `first` except the row is returned
   * as an object containing key-value pairs.
   *
   * # Example
   *
   * ```typescript
   * const query = db.prepareQuery<[number, string], { id: number, name: string }>("SELECT id, name FROM people");
   * const person = query.firstEntry();
   * // person = { id: 1, name: "Peter" }
   * ```
   */
  firstEntry(params?: P): O | undefined {
    const row = this.first(params);
    return row === undefined ? undefined : this.#makeRowObject(row);
  }

  /**
   * **Deprecated:** prefer `first`.
   */
  one(params?: P): R {
    const rows = this.all(params);

    if (rows.length === 0) {
      throw new SqliteError("The query did not return any rows.");
    } else if (rows.length > 1) {
      throw new SqliteError("The query returned more than one row.");
    } else {
      return rows[0];
    }
  }

  /**
   * **Deprecated:** prefer `firstEntry`.
   */
  oneEntry(params?: P): O {
    return this.#makeRowObject(this.one(params));
  }

  /**
   * Binds the given parameters to the query and
   * executes the query, ignoring any rows which
   * might be returned.
   *
   * Using this method is more efficient when the
   * rows returned by a query are not needed or
   * the query does not return any rows.
   *
   * # Examples
   *
   * ```typescript
   * const query = db.prepareQuery<never, never, [string]>("INSERT INTO people (name) VALUES (?)");
   * query.execute(["Peter"]);
   * ```
   *
   * ```typescript
   * const query = db.prepareQuery<never, never, { name: string }>("INSERT INTO people (name) VALUES (:name)");
   * query.execute({ name: "Peter" });
   * ```
   *
   * See `QueryParameterSet` for documentation on
   * how values can be bound to SQL statements.
   *
   * See `QueryParameter` for documentation on how
   * values are returned from the database.
   */
  execute(params?: P) {
    this.#startQuery(params);
    this.#status = this.#wasm.step(this.#stmt);
    while (this.#status === Status.SqliteRow) {
      this.#status = this.#wasm.step(this.#stmt);
    }
    if (this.#status !== Status.SqliteDone) {
      throw new SqliteError(this.#wasm, this.#status);
    }
  }

  /**
   * Closes the prepared query. This must be
   * called once the query is no longer needed
   * to avoid leaking resources.
   *
   * After a prepared query has been finalized,
   * calls to `iter`, `all`, `first`, `execute`,
   * or `columns` will fail.
   *
   * Using iterators which were previously returned
   * from the finalized query will fail.
   *
   * `finalize` may safely be called multiple
   * times.
   */
  finalize() {
    if (!this.#finalized) {
      this.#wasm.finalize(this.#stmt);
      this.#openStatements.delete(this.#stmt);
      this.#finalized = true;
    }
  }

  /**
   * Returns the column names for this query.
   */
  columns(): Array<ColumnName> {
    if (this.#finalized) {
      throw new SqliteError(
        "Unable to retrieve column names from finalized transaction.",
      );
    }

    const columnCount = this.#wasm.column_count(this.#stmt);
    const columns: Array<ColumnName> = [];
    for (let i = 0; i < columnCount; i++) {
      const name = getStr(
        this.#wasm,
        this.#wasm.column_name(this.#stmt, i),
      );
      const originName = getStr(
        this.#wasm,
        this.#wasm.column_origin_name(this.#stmt, i),
      );
      const tableName = getStr(
        this.#wasm,
        this.#wasm.column_table_name(this.#stmt, i),
      );
      columns.push({ name, originName, tableName });
    }
    return columns;
  }

  /**
   * Returns the SQL string used to construct this
   * query, substituting placeholders (e.g. `?`) with
   * their values supplied in `params`.
   *
   * Calling this function invalidates any iterators
   * previously returned by calls to `iter`.
   *
   * See `QueryParameterSet` for documentation on
   * how values can be bound to SQL statements.
   */
  expandSql(params?: P): string {
    this.#startQuery(params);
    const ptr = this.#wasm.expanded_sql(this.#stmt);
    const sql = getStr(this.#wasm, ptr);
    if (ptr != Values.Null) this.#wasm.sqlite_free(ptr);
    return sql;
  }
}
