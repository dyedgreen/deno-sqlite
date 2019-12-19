# JavaScript SQLite Module

[![ci status](https://github.com/dyedgreen/deno-sqlite/workflows/ci/badge.svg?branch=master)](https://github.com/dyedgreen/deno-sqlite/actions)

This is an SQLite module for JavaScript. The wrapper is targeted at [Deno](https://deno.land)
and uses a version of SQLite3 compiled to WebAssembly (WASM).

This is still in an early stage of development. If you use this in a project, please report any
issues you encounter, as well any other feedback by opening an issue.

## Documentation

Documentation is available as a [website](https://dyedgreen.github.io/deno-sqlite/) or in the
`docs` folder.

## Example

```javascript
import { open, save } from "https://deno.land/x/sqlite/mod.ts";

// Open a database
const db = await open("test.db");
db.query("CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");

const name = ["Peter Parker", "Clark Kent", "Bruce Wane"][Math.floor(Math.random() * 3)];

// Run a simple query
db.query("INSERT INTO people (name) VALUES (?)", name);

// Print out data in table
for (const [name] of db.query("SELECT name FROM people"))
  console.log(name);

// Save and close connection
save(db);
db.close();
```

## TODO - Goals

- [x] Initial API draft
- [x] Tests
- [x] Support BLOBs
- [x] The WASM context seems to prevent Deno from exiting when an error is thrown ([fixed by deno 3503](https://github.com/denoland/deno/pull/3503))
- [x] Benchmarks
- [x] Documentation (there are in-file comments)
- [x] Replace EMSCRIPTEN with WASI
- [ ] More tests (high-load, edge-cases, issues as they arise)
- [ ] Documentation on general design and best practices
- [ ] More/ better benchmarks
- [ ] Rewrite internals to use TypeScript
