# JavaScript SQLite Interface

This is a wrapper for SQLite for JavaScript. The wrapper is targeted at [Deno](https://deno.land)
and uses a version of SQLite3 compiled to WebAssembly (WASM).

## API Documentation
The API is simplicity itself:

```JavaScript
import {DB} from "mod.js";

// Construct a database
const db = new DB("./some-file.db"); // omit file path for in-memory database

// Queries return iterators
for (const [name, email] of db.query("SELECT name, email FROM users;")) {
  console.log(name, email);
}

// Parameters are passed after the query string
let birthdays = [...db.query("SELECT birthdays FROM users WHERE name LIKE ?;", "Clark Kent")].map(unix => new Date(unix));
console.log(birthdays);

// Save database to disc (TODO: explain why necessary)
db.save();
```
