import sqlite from "./sqlite.js";
import {DB} from "./db.js";
import {Empty} from "./row.js";

function instance() {
  // The emscripten module is not a promise
  return new Promise(accept => {
    sqlite().then(inst => accept(inst));
  });
}

function open(file) {
  return new Promise((accept, reject) => {
    if (!file) {
      accept();
    } else {
      Deno.readFile(file).then(file => {
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
