import constants from "./constants.js";

/** Result from a query. */
export class Rows {
  constructor(db, id) {
    this._db = db;
    this._id = id;
    this._done = false;

    if (!this._db)
      this._done = true;
  }

  /**
   * Call this if you are done with the
   * query and have not iterated over all
   * the available results.
   *
   * If you leave rows with results before
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
    this._db._inst._finalize(this._id);
    this._done = true;
  }

  next() {
    if (this._done) return { done: true };
    // Load row data and advance statement
    const row = this._get();
    switch (this._db._inst._step(this._id)) {
      case constants.status.sqliteRow:
        // NO OP
        break;
      case constants.status.sqliteDone:
        this.done();
        break;
      default:
        // TODO: Make more helpful
        throw new Error("Internal error.");
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
    for (let i = 0, c = this._db._inst._column_count(this._id); i < c; i++) {
      switch (this._db._inst._column_type(this._id, i)) {
        case constants.types.integer:
          row.push(this._db._inst._column_int(this._id, i));
          break;
        case constants.types.float:
          row.push(this._db._inst._column_double(this._id, i));
          break;
        case constants.types.text:
          row.push(
            this._db._inst.ccall(
              "column_text",
              "string",
              ["number", "number"],
              [this._id, i]
            )
          );
          break;
        case constants.types.blob:
          const ptr = this._db._inst._column_blob(this._id, i);
          if (ptr === 0) {
            // Zero pointer results in null
            row.push(null);
          } else {
            const length = this._db._inst._column_bytes(this._id, i);
            // Slice should copy the bytes, as it makes a shallow copy
            row.push(this._db._inst.HEAPU8.slice(ptr, ptr + length));
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

/** Rows representing empty result. */
const Empty = new Rows(null, -1);
export { Empty };
