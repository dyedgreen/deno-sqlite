// Database instance

import constants from "./constants.js";
import {Row, Empty} from "./row.js";

export class DB {
  constructor(inst, file) {
    this._inst = inst;
    // If we have a file given, we try to load it
    if (file)
      this._inst.FS.writeFile("/db", file);
    if (this._inst._init() !== constants.status.sqliteOk)
      throw this._error();
  }

  query(sql, ...values) {
    if (typeof sql !== "string")
      throw new Error("SQL query is not a string.");

    // Prepare sqlite query statement
    const id = this._inst.ccall("prepare", "number", ["string"], [sql]);
    if (id === constants.values.error)
      throw this._error();

    // Bind values
    for (let i = 0; i < values.length; i ++) {
      let status;
      switch (typeof values[i]) {
        case "number":
          if (Math.floor(values[i]) === values[i]) {
            status = this._inst._bind_int(id, i+1, values[i]);
          } else {
            status = this._inst._bind_double(id, i+1, values[i]);
          }
          break;
        case "string":
          status = this._inst.ccall("bind_text", "number", ["number", "number", "string"], [id, i+1, values[i]]);
          break;
        default:
          throw new Error("Can not bind ".concat(values[i]));
          break;
      }
      if (status !== constants.status.sqliteOk) {
        this._inst._finalize(id);
        throw this._error(status);
      }
    }

    // Step once to handle case where result is empty
    switch (this._inst._step(id)) {
      case constants.status.sqliteDone:
        this._inst._finalize(id);
        return Empty;
        break;
      case constants.status.sqliteRow:
        return new Row(this, id);
        break;
      default:
        throw this._error();
        break;
    }
  }

  // TODO: name, should this auto-safe? ...
  save(path) {
    return Deno.writeFile(path, this._inst.FS.readFile("/db"));
  }

  _error(code) {
    if (code === undefined)
      code = this._inst._get_status();
    switch (code) {
      case constants.status.transactionLimit:
        return new Error("No transaction slot available.");
        break;
      case constants.status.noTransaction:
        return new Error("Transaction not found.");
        break;
      default:
        // SQLite error
        return new Error(this._inst.ccall("get_sqlite_error_str", "string", []));
    }
  }
}
