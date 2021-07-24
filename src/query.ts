// @deno-types="../build/sqlite.d.ts"
import { StatementPtr, Wasm } from "../build/sqlite.js";
import { getStr, setArr, setStr } from "./wasm.ts";
import { Status, Types, Values } from "./constants.ts";
import { SqliteError } from "./error.ts";

// deno-lint-ignore no-explicit-any
export type Row = Array<any>;

/**
 * Possible parameter values to be bound to a query.
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
 */
export type QueryParameterSet =
  | Record<string, QueryParameter>
  | Array<QueryParameter>;

/**
 * Name of a column in
 * a database query.
 */
export interface ColumnName {
  name: string;
  originName: string;
  tableName: string;
}

interface RowsIterator {
  next: () => IteratorResult<Row>;
  [Symbol.iterator]: () => RowsIterator;
}

export class PreparedQuery {
  private _wasm: Wasm;
  private _stmt: StatementPtr;
  private _openStatements: Set<StatementPtr>;

  private _status: number;
  private _finalized: boolean;

  /**
   * A prepared query can be executed many
   * times.
   *
   * The constructor should never be used directly.
   * Instead a prepared query can be obtained by
   * calling `DB.prepareQuery`.
   */
  constructor(
    wasm: Wasm,
    stmt: StatementPtr,
    openStatements: Set<StatementPtr>,
  ) {
    this._wasm = wasm;
    this._stmt = stmt;
    this._openStatements = openStatements;

    this._status = Status.Unknown;
    this._finalized = false;
  }

  private startQuery(params?: QueryParameterSet) {
    if (this._finalized) {
      throw new SqliteError("Query is finalized.");
    }

    // Reset query
    this._wasm.reset(this._stmt);
    this._wasm.clear_bindings(this._stmt);

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
          this._wasm,
          name,
          (ptr) => this._wasm.bind_parameter_index(this._stmt, ptr),
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
            status = this._wasm.bind_int(this._stmt, i + 1, value);
          } else {
            status = this._wasm.bind_double(this._stmt, i + 1, value);
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
            status = this._wasm.bind_big_int(
              this._stmt,
              i + 1,
              sign,
              upper,
              lower,
            );
          }
          break;
        case "string":
          status = setStr(
            this._wasm,
            value,
            (ptr) => this._wasm.bind_text(this._stmt, i + 1, ptr),
          );
          break;
        default:
          if (value instanceof Date) {
            // Dates are allowed and bound to TEXT, formatted `YYYY-MM-DDTHH:MM:SS.SSSZ`
            status = setStr(
              this._wasm,
              value.toISOString(),
              (ptr) => this._wasm.bind_text(this._stmt, i + 1, ptr),
            );
          } else if (value instanceof Uint8Array) {
            // Uint8Arrays are allowed and bound to BLOB
            const size = value.length;
            status = setArr(
              this._wasm,
              value,
              (ptr) => this._wasm.bind_blob(this._stmt, i + 1, ptr, size),
            );
          } else if (value === null || value === undefined) {
            // Both null and undefined result in a NULL entry
            status = this._wasm.bind_null(this._stmt, i + 1);
          } else {
            throw new SqliteError(`Can not bind ${typeof value}.`);
          }
          break;
      }
      if (status !== Status.SqliteOk) {
        throw new SqliteError(this._wasm, status);
      }
    }
  }

  private getQueryRow(): Row {
    if (this._finalized) {
      throw new SqliteError("Query is finalized.");
    }

    const columnCount = this._wasm.column_count(this._stmt);
    const row: Row = [];
    for (let i = 0; i < columnCount; i++) {
      switch (this._wasm.column_type(this._stmt, i)) {
        case Types.Integer:
          row.push(this._wasm.column_int(this._stmt, i));
          break;
        case Types.Float:
          row.push(this._wasm.column_double(this._stmt, i));
          break;
        case Types.Text:
          row.push(
            getStr(
              this._wasm,
              this._wasm.column_text(this._stmt, i),
            ),
          );
          break;
        case Types.Blob: {
          const ptr = this._wasm.column_blob(this._stmt, i);
          if (ptr === 0) {
            // Zero pointer results in null
            row.push(null);
          } else {
            const length = this._wasm.column_bytes(this._stmt, i);
            // Slice should copy the bytes, as it makes a shallow copy
            row.push(
              new Uint8Array(this._wasm.memory.buffer, ptr, length).slice(),
            );
          }
          break;
        }
        case Types.BigInteger: {
          const ptr = this._wasm.column_text(this._stmt, i);
          row.push(BigInt(getStr(this._wasm, ptr)));
          break;
        }
        default:
          // TODO(dyedgreen): Differentiate between NULL and not-recognized?
          row.push(null);
          break;
      }
    }
    return row;
  }

  query(params?: QueryParameterSet): RowsIterator {
    this.startQuery(params);
    this._status = this._wasm.step(this._stmt);
    if (
      this._status !== Status.SqliteRow && this._status !== Status.SqliteDone
    ) {
      throw new SqliteError(this._wasm, this._status);
    }
    return this;
  }

  /**
   * Implements the iterable protocol.
   */
  [Symbol.iterator](): RowsIterator {
    return this;
  }

  /**
   * Implements the iterable protocol.
   */
  next(): IteratorResult<Row> {
    if (this._status === Status.SqliteRow) {
      const value = this.getQueryRow();
      this._status = this._wasm.step(this._stmt);
      return { value, done: false };
    } else if (this._status === Status.SqliteDone) {
      return { value: null, done: true };
    } else {
      throw new SqliteError(this._wasm, this._status);
    }
  }

  queryAll(params?: QueryParameterSet): Array<Row> {
    this.startQuery(params);
    const rows: Array<Row> = [];
    this._status = this._wasm.step(this._stmt);
    while (this._status === Status.SqliteRow) {
      rows.push(this.getQueryRow());
      this._status = this._wasm.step(this._stmt);
    }
    if (this._status !== Status.SqliteDone) {
      throw new SqliteError(this._wasm, this._status);
    }
    return rows;
  }

  queryOne(params?: QueryParameterSet): Row {
    this.startQuery(params);

    // Get first row
    this._status = this._wasm.step(this._stmt);
    if (this._status !== Status.SqliteRow) {
      if (this._status === Status.SqliteDone) {
        throw new SqliteError("The query did not return any rows.");
      } else {
        throw new SqliteError(this._wasm, this._status);
      }
    }
    const row = this.getQueryRow();

    // Ensure the query only returns one row
    this._status = this._wasm.step(this._stmt);
    if (this._status !== Status.SqliteDone) {
      if (this._status === Status.SqliteRow) {
        throw new SqliteError("The query returned more than one row.");
      } else {
        throw new SqliteError(this._wasm, this._status);
      }
    }

    return row;
  }

  execute(params?: QueryParameterSet) {
    this.startQuery(params);
    this._status = this._wasm.step(this._stmt);
    while (this._status === Status.SqliteRow) {
      this._status = this._wasm.step(this._stmt);
    }
    if (this._status !== Status.SqliteDone) {
      throw new SqliteError(this._wasm, this._status);
    }
  }

  /**
   * Closes the prepared query. This must be
   * called once the query is no longer needed
   * to avoid leaking resources.
   */
  finalize() {
    if (!this._finalized) {
      this._wasm.finalize(this._stmt);
      this._openStatements.delete(this._stmt);
      this._finalized = true;
    }
  }

  /**
   * Returns the column names for the query
   * results.
   *
   * This method returns an array of objects,
   * where each object has the following properties:
   *
   * | Property     | Value                                      |
   * |--------------|--------------------------------------------|
   * | `name`       | the result of `sqlite3_column_name`        |
   * | `originName` | the result of `sqlite3_column_origin_name` |
   * | `tableName`  | the result of `sqlite3_column_table_name`  |
   */
  columns(): Array<ColumnName> {
    if (this._finalized) {
      throw new SqliteError(
        "Unable to retrieve column names from finalized transaction.",
      );
    }

    const columnCount = this._wasm.column_count(this._stmt);
    const columns: Array<ColumnName> = [];
    for (let i = 0; i < columnCount; i++) {
      const name = getStr(
        this._wasm,
        this._wasm.column_name(this._stmt, i),
      );
      const originName = getStr(
        this._wasm,
        this._wasm.column_origin_name(this._stmt, i),
      );
      const tableName = getStr(
        this._wasm,
        this._wasm.column_table_name(this._stmt, i),
      );
      columns.push({ name, originName, tableName });
    }
    return columns;
  }
}
