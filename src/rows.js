import { getStr } from "./wasm.js";
import * as constants from "./constants.js";

export class Rows {
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
  constructor(db, id) {
    this._db = db;
    this._id = id;
    this._done = false;

    if (!this._db)
      this._done = true;
  }

  /**
   * Rows.done
   *
   * Call this if you are done with the
   * query and have not iterated over all
   * the available results.
   *
   * !> If you leave rows with results before
   * making new queries, you may run into the
   * maximum limit for concurrent queries.
   * Always use `.done()` instead of `break`.
   *
   *     const rows = db.query("SELECT name FROM users;");
   *     for (const [name] of rows) {
   *       if (name === "Clark Kent")
   *         rows.done();
   *     }
   */
  done() {
    if (this._done)
      return;
    // Release transaction slot
    this._db._wasm.finalize(this._db._id, this._id);
    this._done = true;
  }

  next() {
    if (this._done) return { done: true };
    // Load row data and advance statement
    const row = this._get();
    const status = this._db._wasm.step(this._db._id, this._id);
    switch (status) {
      case constants.status.sqliteRow:
        // NO OP
        break;
      case constants.status.sqliteDone:
        this.done();
        break;
      default:
        this.done();
        throw this._db._error(status);
        break;
    }
    return { value: row, done: false };
  }

  [Symbol.iterator]() {
    return this;
  }

  _get() {
    // Get results from row
    const row = [];
    // return row;
    for (let i = 0, c = this._db._wasm.column_count(this._db._id, this._id); i < c; i++) {
      switch (this._db._wasm.column_type(this._db._id, this._id, i)) {
        case constants.types.integer:
          row.push(this._db._wasm.column_int(this._db._id, this._id, i));
          break;
        case constants.types.float:
          row.push(this._db._wasm.column_double(this._db._id, this._id, i));
          break;
        case constants.types.text:
          row.push(getStr(this._db._wasm, this._db._wasm.column_text(this._db._id, this._id, i)));
          break;
        case constants.types.blob:
          const ptr = this._db._wasm.column_blob(this._db._id, this._id, i);
          if (ptr === 0) {
            // Zero pointer results in null
            row.push(null);
          } else {
            const length = this._db._wasm.column_bytes(this._db._id, this._id, i);
            // Slice should copy the bytes, as it makes a shallow copy
            row.push(new Uint8Array(this._db._wasm.memory.buffer, ptr, length).slice());
          }
          break;
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
const Empty = new Rows(null, -1);
export { Empty };
