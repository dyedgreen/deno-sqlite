// Database result iterators

import constants from "./constants.js";

export class Row {
  constructor(db, id) {
    this._db = db;
    this._id = id;
    this._done = false;

    // Construct getters
    if (this._db === null)
      return;
    this._get = [];
    for (let i = 0, c = this._db._inst._column_count(this._id); i < c; i ++) {
      switch (this._db._inst._column_type(this._id, i)) {
        case constants.types.integer:
          this._get.push(() => this._db._inst._column_int(this._id, i));
          break;
        case constants.types.float:
          this._get.push(() => this._db._inst._column_double(this._id, i));
          break;
        case constants.types.text:
          this._get.push(() => this._db._inst.ccall("column_text", "string", ["number", "number"], [this._id, i]));
          break;
        default:
          // TODO: Differentiate between NULL and not-recognized?
          this._get.push(() => null);
          break;
      }
    }
  }

  done() {
    if (this._done)
      return;
    // Release transaction slot
    this._db._inst._finalize(this._id);
    this._done = true;
  }

  next() {
    if (this._done)
      return {done: true};
    // Load row data and advance statement
    const row = this._get.map(g => g());
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
    return {value: row, done: false};
  }

  [Symbol.iterator] () {
    return this;
  }
}

const Empty = new Row(null, -1);
Empty._done = true;
export {Empty};
