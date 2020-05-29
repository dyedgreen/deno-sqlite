# SQLite for Deno Documentation

[![test status](https://github.com/dyedgreen/deno-sqlite/workflows/tests/badge.svg?branch=master)](https://github.com/dyedgreen/deno-sqlite/actions)
[![docs status](https://github.com/dyedgreen/deno-sqlite/workflows/docs/badge.svg?branch=master)](https://dyedgreen.github.io/deno-sqlite/)
[![deno doc](https://doc.deno.land/badge.svg)](https://deno.land/x/sqlite)
[![playground](https://img.shields.io/badge/playground-web-blue)](https://dyedgreen.github.io/deno-sqlite/playground/)

This is the documentation for the Deno SQLite module. The module
uses a version of SQLite compiled to WebAssembly to provide a
JavaScript binding to SQLite.

## Table of Contents

- [API Documentation](api.md)
- [Examples](examples.md)
- [Contributing](contributing.md)
- [Module Design and Internals](design.md)
- [Playground (Experimental)](https://dyedgreen.github.io/deno-sqlite/playground/)

## Runnable Example

```javascript
import { DB } from "https://deno.land/x/sqlite/mod.ts";

// Open a database
const db = new DB("test.db");
db.query("CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");

const names = ["Peter Parker", "Clark Kent", "Bruce Wayne"];

// Run a simple query
for (const name of names)
  db.query("INSERT INTO people (name) VALUES (?)", [name]);

// Print out data in table
for (const [name] of db.query("SELECT name FROM people"))
  console.log(name);

// Close connection
db.close();
```
