# JavaScript SQLite Module

This is an SQLite module for JavaScript. The wrapper is targeted at [Deno](https://deno.land)
and uses a version of SQLite3 compiled to WebAssembly (WASM).

This is still in an early stage of development. If you use this in a project, please report any
issues you encounter, as well any other feedback by opening an issue.


## API Documentation

Below is an example of how to use the wrapper. See the [full documentation](https://dyedgreen.github.io/deno-sqlite/)
for more info.

```JavaScript
import {open, save, Empty} from "https://deno.land/x/sqlite/mod.ts";

// Open a database
const db = await open("test.db"); // or new DB() for an in-memory database

// You can easily bind values to your queries
const first = ["Bruce", "Clark", "Peter"];
const last = ["Wane", "Kent", "Parker"];
db.query("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subscribed INTEGER)");

for (let i = 0; i < 100; i ++) {
  const name = `${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}`;
  const email = `${name.replace(" ", "-")}@deno.land`;
  const subscribed = Math.random() > 0.5 ? true : false;
  db.query("INSERT INTO users (name, email, subscribed) VALUES (?, ?, ?)", name, email, subscribed);
}

// Queries return iterators
for (const [name, email] of db.query("SELECT name, email FROM users WHERE subscribed = ? LIMIT 5", true)) {
  console.log(name, email);
}

// If a query has no rows to return, they return Empty
// (which is also an iterator)
const res = db.query("SELECT email FROM users WHERE name LIKE ?", "Robert Parr");
if (Empty === res)
  console.log("No results!");
res.done();

// To write the data to disk
save(db);

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

// Make sure to always close the database if
// you're done!
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
