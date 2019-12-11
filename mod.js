import sqlite from "./sqlite.js";
import {status, types, errorVal} from "./constants.js";

class Rows {
  [Symbol.iterator]() {
    return this;
  }
}

class FullRows extends Rows {
  constructor(db, id) {
    super();
    this._db = db;
    this._id = id;
    this._done = false;

    // Setup types
    const colCount = this._db._inst._column_count(this._id);
    this._getters = [];
    for (let i = 0; i < colCount; i ++) {
      switch (this._db._inst._column_type(this._id, i)) {
        case types.integer:
          this._getters.push(() => this._db._inst._column_int(this._id, i));
          break;
        case types.float:
          this._getters.push(() => this._db._inst._column_double(this._id, i));
          break;
        case types.text:
          this._getters.push(() => this._db._inst.ccall("column_text", "string", ["number", "number"], [this._id, i]));
          break;
        default:
          this._getters.push(() => null);
          break;
      }
    }
  }

  done() {
    // TODO: Call this automatically when deallocated somehow ...
    if (this._done)
      return;
    this._done = true;
    this._db._inst._finalize(this._id);
  }

  next() {
    if (this._done)
      return {done: true};

    // Construct row
    const row = this._getters.map(getter => getter());

    // Next step
    switch(this._db._inst._step(this._id)) {
      case status.sqliteRow:
        break;
      case status.sqliteDone:
        this.done();
        break;
      default:
        throw Error("Internal error.");
        break;
    }
    return {value: row, done: false};
  }
}

class EmptyRows extends Rows {
  constructor() {
    super();
  }

  next() {
    return {done: true};
  }
}

class DB {
  constructor(instance) {
    // Build wrapper functions
    this._inst = instance;
    this._get_sqlite_error_str = this._inst.cwrap("get_sqlite_error_str", "string", []);

    // Initialize db
    if (this._inst._init() !== status.sqliteOk)
      throw Error(this._get_sqlite_error_str());

    // TODO: Load database from file ...
  }

  query(sql, ...values) {
    if (typeof sql !== "string")
      sql = "".concat(sql);

    // Prepare statement
    const id = this._inst.ccall("prepare", "number", ["string"], [sql]);
    if (id === errorVal) {
      if (this._inst._get_status() === status.transactionLimit)
        throw Error("Transaction limit reached.");
      throw Error(this._get_sqlite_error_str());
    }

    // Try to bind any values provided
    for (let i = 0; i < values.length; i ++) {
      let s;
      switch (typeof values[i]) {
        case "number":
          if (Math.floor(values[i]) === values) {
            s = this._inst._bind_int(id, i+1, values[i]);
          } else {
            s = this._inst._bind_double(id, i+1, values[i]);
          }
          break;
        case "string":
          s = this._inst.ccall("bind_text", "number", ["number", "number", "string"], [id, i+1, values[i]]);
          break;
        // TODO: Support dates (?)
        default:
          throw Error("Values can only be strings or numbers.");
      }
      if (s !== status.sqliteOk) {
        this._inst._finalize(id);
        throw s === status.noTransaction ? Error("Internal error.") : Error(this._get_sqlite_error_str());
      }
    }

    // Execute once to handle case where no rows are returned
    switch (this._inst._step(id)) {
      // Does not return any rows, finish immediately
      case status.sqliteDone:
        this._inst._finalize(id);
        return new EmptyRows();
        break;
      // Returns rows, return a row iterator
      case status.sqliteRow:
        return new FullRows(this, id);
        break;
      case status.noTransaction:
        throw Error("Internal error.");
        break;
      default:
        throw Error(this._get_sqlite_error_str());
        break;
    }
  }

  // This is the public interface for creating new
  // database instances.
  static async open(file) {
    return new Promise((accept, reject) => {
      if (file !== undefined) {
        reject(Error("Not implemented."));
        return;
      }
      sqlite().then(inst => {
        accept(new DB(inst));
      });
    });
  }
}

// Module().then(mod => {
//   console.log("init 2");
//   console.log(mod);
//   console.log("init_status:", mod._init());
//   const statement = mod.ccall("prepare", "number", ["string"], ["SELECT * FROM users;"]);
//   console.log("statement:", statement);
//   console.log("last_status:", mod._get_status());
//   if (mod._get_status() !== 0) {
//     console.log("error:", mod.ccall("get_sqlite_error_str", "string", [], []));
//   }
// });

// const wasmImports = {
//   imports: {
//     wasi_unstable: {},
//   },
// };

// const inst = await WebAssembly.instantiate(await Deno.readFile("test.wasm"), wasmImports);
// console.log(inst);

const db = await DB.open();
console.log(db);

// Write some simple data
db.query("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER);");
db.query("INSERT INTO users (name, age) VALUES ('Peter', 21), ('Clark', 32), ('Bruce', 26);");

// This seems broken :( ...
db.query("INSERT INTO users (name, age) VALUES (?, ?);", "i love baby".toUpperCase(), Math.floor(Math.random() * 30));

// Read some data back
for (const [name, age] of db.query("SELECT name, age FROM users ORDER BY age ASC;"))
  console.log(name, age);
