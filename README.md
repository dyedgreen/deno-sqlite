# JavaScript SQLite Module

[![test status](https://github.com/dyedgreen/deno-sqlite/workflows/tests/badge.svg?branch=master)](https://github.com/dyedgreen/deno-sqlite/actions)
[![docs status](https://github.com/dyedgreen/deno-sqlite/workflows/docs/badge.svg?branch=master)](https://dyedgreen.github.io/deno-sqlite/)

This is an SQLite module for JavaScript. The wrapper is targeted at [Deno](https://deno.land)
and uses a version of SQLite3 compiled to WebAssembly (WASM).

This is still in an early stage of development. If you use this in a project, please report any
issues you encounter, as well any other feedback by opening an issue.

## Documentation

Documentation is available as a [website](https://dyedgreen.github.io/deno-sqlite/) or in the
[`docs`](./docs/README.md) folder.

## Example

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
save(db);
db.close();
```
