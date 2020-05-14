# Deno SQLite Module

[![test status](https://github.com/dyedgreen/deno-sqlite/workflows/tests/badge.svg?branch=master)](https://github.com/dyedgreen/deno-sqlite/actions)
[![docs status](https://github.com/dyedgreen/deno-sqlite/workflows/docs/badge.svg?branch=master)](https://dyedgreen.github.io/deno-sqlite/)
[![playground](https://img.shields.io/badge/playground-web-blue)](https://dyedgreen.github.io/deno-sqlite/playground/)

This is an SQLite module for JavaScript. The wrapper is targeted at [Deno](https://deno.land)
and uses a version of SQLite3 compiled to WebAssembly (WASM). This module focuses on performance
and ease of use.

While this module guarantees API compatibility according to [semantic versioning](https://semver.org),
it has not been extensively tested in production. Please open issues (and if possible pull requests)
for any problems you encounter.

## Documentation

Documentation is available as a [website](https://dyedgreen.github.io/deno-sqlite/) or in the
[`docs`](./docs/README.md) folder.

## Example

Also try the experimental [web playground](https://dyedgreen.github.io/deno-sqlite/playground/)!

```javascript
import { open, save } from "https://deno.land/x/sqlite/mod.ts";

// Open a database
const db = await open("test.db");
db.query("CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");

const name = ["Peter Parker", "Clark Kent", "Bruce Wayne"][Math.floor(Math.random() * 3)];

// Run a simple query
db.query("INSERT INTO people (name) VALUES (?)", [name]);

// Print out data in table
for (const [name] of db.query("SELECT name FROM people"))
  console.log(name);

// Save and close connection
await save(db);
db.close();
```
