# JavaScript SQLite Module

This is an SQLite module for JavaScript. The wrapper is targeted at [Deno](https://deno.land)
and uses a version of SQLite3 compiled to WebAssembly (WASM).

This is still in an early stage of development. If you use this in a project, please report any
issues you encounter, as well any other feedback by opening an issue.

## Caveats

This is still a work in progress. While the API will probably remain mostly stable, there are currently
no guarantees.

## TODO - Goals

- [x] Initial API draft
- [x] Tests
- [x] Support BLOBs
- [x] The WASM context seems to prevent Deno from exiting when an error is thrown ([fixed by deno 3503](https://github.com/denoland/deno/pull/3503))
- [ ] More tests (high-load, edge-cases, issues as they arise)
- [ ] Documentation (there are in-file comments)
- [ ] Rewrite internals to use TypeScript
- [ ] Benchmarks
- [ ] Replace EMSCRIPTEN with WASI (long term)

## API Documentation
The API is simplicity itself:

```JavaScript
import {open, Empty} from "https://deno.land/x/sqlite/mod.ts";

// Construct a database
const db = await open(); // pass file path to load database contents

// You can easily bind values to your queries
const first = ["Bruce", "Clark", "Peter"];
const last = ["Wane", "Kent", "Parker"];
db.query("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subscribed INTEGER);");

for (let i = 0; i < 100; i ++) {
  const name = `${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}`;
  const email = `${name.replace(" ", "-")}@deno.land`;
  const subscribed = Math.random() > 0.5 ? true : false;
  db.query("INSERT INTO users (name, email, subscribed) VALUES (?, ?, ?);", name, email, subscribed);
}

// Queries return iterators
for (const [name, email] of db.query("SELECT name, email FROM users WHERE subscribed = ? LIMIT 5;", true)) {
  console.log(name, email);
}

// If a query has no rows to return, they return Empty
// (which is also an iterator)
const res = db.query("SELECT email FROM users WHERE name LIKE ?;", "Robert Parr");
if (Empty === res)
  console.log("No results!");
res.done();

// To write the data to disk use
db.save("emails.db");

// Make sure to always read all results returned from
// a query, or call done on the returned Row object.
const subscribers = db.query("SELECT name, email FROM users WHERE subscribed = ?", true);
for (const [name, email] of subscribers) {
  if (Math.random() > 0.5)
    continue;
  console.log("Winner:", name, email);
  // Call this instead of break to prevent
  // using concurrent queries!
  subscribers.done();
}
```
