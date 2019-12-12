import sqlite from "./sqlite.js";
import {DB} from "./db.js";
import {Empty} from "./row.js";

function instance() {
  // The emscripten module is not a promise
  return new Promise(accept => {
    sqlite().then(inst => accept(inst));
  });
}

/**
* Open a new SQLite3 database. Each database is
* running in a separate WASM instance. This
* returns a promise resolving to the database.
*
* If a file path is provided, then the database
* is initialized with the data from the file.
*
* @param path
* @return Promise<DB>
*/
function open(path) {
  return new Promise((accept, reject) => {
    if (!path) {
      accept();
    } else {
      Deno.readFile(path).then(file => {
        accept(file);
      }).catch(reject);
    }
  }).then(file => {
    return new Promise(accept => {
      sqlite().then(inst => accept(new DB(inst, file)));
    });
  });
}

export {open, Empty};
