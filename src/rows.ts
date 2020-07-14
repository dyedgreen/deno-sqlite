import { getStr } from "./wasm.ts";
import { Status, Values, Types } from "./constants.ts";
import SqliteError, { ERROR_TRANSACTION_FINALIZED } from "./error.ts";

interface ColumnName {
  name: string;
  originName: string;
  tableName: string;
}

export class Rows {
  private _db: any;
  private _stmt: number;
  private _done: boolean;

  /**
   * Rows
   *
   * Rows represent a set of results from a query.
   * They are iterable and yield arrays with
   * the data from the selected columns.
   *
   * This class is not exported from the module
   * and the only correct way to obtain a `Rows`
   * object is by making a database query.
   */
  constructor(db: any, stmt: number) {
    this._db = db;
    this._stmt = stmt;
    this._done = false;

    if (!this._db) {
      this._done = true;
    }
  }

  /**
   * Rows.done
   *
   * Call this if you are done with the
   * query and have not iterated over all
   * the available results.
   *
   * !> If you leave rows with results before
   * making new queries, you will leak memory.
   * Always use `.done()` instead of `break`.
   *
   *     const rows = db.query("SELECT name FROM users;");
   *     for (const [name] of rows) {
   *       if (name === "Clark Kent")
   *         rows.done();
   *     }
   */
  done() {
    if (this._done) {
      return;
    }
    // Release transaction slot
    this._db._wasm.finalize(this._stmt);
    this._db._transactions.delete(this);
    this._done = true;
  }

  /**
   * Rows.next
   *
   * Implements the iterator protocol.
   */
  next(): IteratorResult<any[]> {
    if (this._done) return { value: undefined, done: true };
    // Load row data and advance statement
    const row = this._get();
    const status = this._db._wasm.step(this._stmt);
    switch (status) {
      case Status.SqliteRow:
        // NO OP
        break;
      case Status.SqliteDone:
        this.done();
        break;
      default:
        this.done();
        throw this._db._error(status);
        break;
    }
    return { value: row, done: false };
  }

  /**
   * Rows.columns
   *
   * Call this if you need column names from the result of a select query.
   *
   * This method returns an array of objects, where each object has the following properties:
   *
   * | Property     | Value                                      |
   * |--------------|--------------------------------------------|
   * | `name`       | the result of `sqlite3_column_name`        |
   * | `originName` | the result of `sqlite3_column_origin_name` |
   * | `tableName`  | the result of `sqlite3_column_table_name`  |
   */
  columns(): ColumnName[] {
    if (this._done) {
      throw new SqliteError(
        ERROR_TRANSACTION_FINALIZED,
      );
    }

    const columnCount = this._db._wasm.column_count(this._stmt);
    const columns: ColumnName[] = [];
    for (let i = 0; i < columnCount; i++) {
      const name = getStr(
        this._db._wasm,
        this._db._wasm.column_name(this._stmt, i),
      );
      const originName = getStr(
        this._db._wasm,
        this._db._wasm.column_origin_name(this._stmt, i),
      );
      const tableName = getStr(
        this._db._wasm,
        this._db._wasm.column_table_name(this._stmt, i),
      );
      columns.push({ name, originName, tableName });
    }
    return columns;
  }

  /**
   * Rows.toObjects
   * 
   * Call this if you need to ouput the rows as objects.
   * 
   * Will return an empty array if there are no entries in the table.
   * 
   *     const rows = db.query("SELECT name FROM users;").toObjects();
   */
  toObjects<T extends any = Record<string, any>>(): T[] {
    try {
      const cols = this.columns();
      const rows: T[] = [];

      for (let row of this) {
        const res: any = {};
        for (let i = 0; i < row.length; i++) {
          res[cols[i].name] = row[i];
        }
        rows.push(res);
      }

      return rows;
    } catch (e) {
      if (
        e instanceof SqliteError &&
        e.code === -1 &&
        e.message === ERROR_TRANSACTION_FINALIZED
      ) {
        return [];
      }
      throw e;
    }
  }

  [Symbol.iterator]() {
    return this;
  }

  private _get(): any[] {
    // Get results from row
    const row = [];
    // return row;
    for (
      let i = 0, c = this._db._wasm.column_count(this._stmt);
      i < c;
      i++
    ) {
      switch (this._db._wasm.column_type(this._stmt, i)) {
        case Types.Integer:
          row.push(this._db._wasm.column_int(this._stmt, i));
          break;
        case Types.Float:
          row.push(this._db._wasm.column_double(this._stmt, i));
          break;
        case Types.Text:
          row.push(
            getStr(
              this._db._wasm,
              this._db._wasm.column_text(this._stmt, i),
            ),
          );
          break;
        case Types.Blob: {
          const ptr = this._db._wasm.column_blob(this._stmt, i);
          if (ptr === 0) {
            // Zero pointer results in null
            row.push(null);
          } else {
            const length = this._db._wasm.column_bytes(this._stmt, i);
            // Slice should copy the bytes, as it makes a shallow copy
            row.push(
              new Uint8Array(this._db._wasm.memory.buffer, ptr, length).slice(),
            );
          }
          break;
        }
        case Types.BigInteger: {
          const ptr = this._db._wasm.column_text(this._stmt, i);
          row.push(BigInt(getStr(this._db._wasm, ptr)));
          break;
        }
        default:
          // TODO: Differentiate between NULL and not-recognized?
          row.push(null);
          break;
      }
    }
    return row;
  }
}

/**
 * Empty
 *
 * A special constant. This is a `Rows` object
 * which has no results. It is still iterable,
 * however it won't yield any results.
 *
 * `Empty` is returned from queries which return
 * no data.
 */
export const Empty = new Rows(null, Values.Null);
