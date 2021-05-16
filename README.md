# Deno SQLite Module

[![test status](https://github.com/dyedgreen/deno-sqlite/workflows/tests/badge.svg?branch=master)](https://github.com/dyedgreen/deno-sqlite/actions)
[![docs status](https://github.com/dyedgreen/deno-sqlite/workflows/docs/badge.svg?branch=master)][docs-web]
[![deno doc](https://doc.deno.land/badge.svg)][docs-deno]

[docs-deno]: https://deno.land/x/sqlite
[docs-web]: https://dyedgreen.github.io/deno-sqlite/

This is an SQLite module for JavaScript. The wrapper is targeted at
[Deno](https://deno.land) and uses a version of SQLite3 compiled to WebAssembly
(WASM). This module focuses on ease of use and performance.

This module guarantees API compatibility according to
[semantic versioning](https://semver.org). Please report any issues you
encounter.

## Documentation

Documentation is available as a [website][docs-web], on [Deno Docs][docs-deno],
or in the [`docs`](./docs/README.md) folder.

## Example

```javascript
import { DB } from "https://deno.land/x/sqlite/mod.ts";

// Open a database
const db = new DB("test.db");
db.query(
  "CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
);

const names = ["Peter Parker", "Clark Kent", "Bruce Wayne"];

// Run a simple query
for (const name of names) {
  db.query("INSERT INTO people (name) VALUES (?)", [name]);
}

// Print out data in table
for (const [name] of db.query("SELECT name FROM people")) {
  console.log(name);
}

// Close connection
db.close();
```

## Comparison to Plugin based Modules

### TL;DR

If you just want something that works, use this library. Depending on your
specific needs, there is also
[deno_sqlite_plugin](https://github.com/crabmusket/deno_sqlite_plugin), however
this module seems to no longer be actively maintained.

### Advantages

- Security: benefit from Denos security settings, without the need to trust a
  third party
- Portability: runs everywhere Deno runs and can even run in the browser
- Easy: takes full advantage of Denos module cache and does not require any
  network access after initial download

### Disadvantages

- Speed: file system IO through Deno can be lower compared to what is achievable
  using a native code
- Weaker Persistence Guarantees: due to limitations in Denos file system APIs,
  SQLite can't acquire file locks or memory map files (e.g. this module can't
  safely use WAL mode)

## Users

_(In alphabetical order)_

- [cotton](https://github.com/rahmanfadhil/cotton)
- [deno-nessie](https://github.com/halvardssm/deno-nessie)
- [denodb](https://github.com/eveningkid/denodb)
- [denolib/typeorm](https://github.com/denolib/typeorm)
- [dexecutor](https://github.com/denjucks/dexecutor)
- [small-orm-sqlite](https://github.com/enimatek-nl/small-orm-sqlite)
