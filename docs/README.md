# SQLite for Deno Documentation

[![test status](https://github.com/dyedgreen/deno-sqlite/workflows/tests/badge.svg?branch=master)](https://github.com/dyedgreen/deno-sqlite/actions)

This is the documentation for the Deno SQLite module. The module
uses a version of SQLite compiled to WebAssembly to provide a
JavaScript binding to SQLite.

## Table of Contents

- [API Documentation](api.md)
- [Examples](examples.md)
- [Module Design and Internals](design.md)

## Runnable Example

```javascript
import { open, save } from "https://deno.land/x/sqlite/mod.ts";

// Open a database
const db = await open("test.db");
db.query("CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");

const name = ["Peter Parker", "Clark Kent", "Bruce Wayne"][Math.floor(Math.random() * 3)];

// Run a simple query
db.query("INSERT INTO people (name) VALUES (?)", name);

// Print out data in table
for (const [name] of db.query("SELECT name FROM people"))
  console.log(name);

// Save and close connection
save(db);
db.close();
```
