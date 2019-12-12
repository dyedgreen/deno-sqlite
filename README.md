# JavaScript SQLite Interface

This is a wrapper for SQLite for JavaScript. The wrapper is targeted at [Deno](https://deno.land)
and uses a version of SQLite3 compiled to WebAssembly (WASM).

## Caveats

This is still a work in progress. While the API will probably remain mostly stable, there are currently
no guarantees.

This also still needs unit tests, better documentation, and a re-write in TypeScript.

## API Documentation
The API is simplicity itself:

```JavaScript
import {open, Empty} from "./mod.ts";

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
