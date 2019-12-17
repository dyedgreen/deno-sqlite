import { runIfMain, test } from "https://deno.land/std/testing/mod.ts";
import { assert, assertEquals, assertMatch, assertThrows } from "https://deno.land/std/testing/asserts.ts";

import { open, Empty } from "./mod.ts";

/** Ensure the README examples works as advertised. */
test(async function readmeExample() {
  const db = await open();
  const first = ["Bruce", "Clark", "Peter"];
  const last = ["Wane", "Kent", "Parker"];
  db.query(
    "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subscribed INTEGER)"
  );

  for (let i = 0; i < 100; i++) {
    const name = `${first[Math.floor(Math.random() * first.length)]} ${
      last[Math.floor(Math.random() * last.length)]
    }`;
    const email = `${name.replace(" ", "-")}@deno.land`;
    const subscribed = Math.random() > 0.5 ? true : false;
    db.query(
      "INSERT INTO users (name, email, subscribed) VALUES (?, ?, ?)",
      name,
      email,
      subscribed
    );
  }

  for (const [name, email] of db.query(
    "SELECT name, email FROM users WHERE subscribed = ? LIMIT 100",
    true
  )) {
    assertMatch(name, /(Bruce|Clark|Peter) (Wane|Kent|Parker)/);
    assertEquals(email, `${name.replace(" ", "-")}@deno.land`);
  }

  const res = db.query(
    "SELECT email FROM users WHERE name LIKE ?",
    "Robert Parr"
  );
  assertEquals(res, Empty);
  res.done();

  // Omit write tests, as we don't want to require ---allow-write
  // and have a write test, which checks for the flag and skips itself.

  const subscribers = db.query(
    "SELECT name, email FROM users WHERE subscribed = ?",
    true
  );
  for (const [name, email] of subscribers) {
    if (Math.random() > 0.5) continue;
    subscribers.done();
  }
});

/** Ensure binding values works correctly. */
test(async function bindValues() {
  const db = await open();
  let vals, rows;

  // string
  db.query("CREATE TABLE strings (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)");
  vals = ["Hello World!", "I love Deno.", "Täst strüng..."];
  for (const val of vals)
    db.query("INSERT INTO strings (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM strings")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // integer
  db.query("CREATE TABLE ints (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)");
  vals = [42, 1, 2, 3, 4, 3453246, 4536787093, 45536787093];
  for (const val of vals)
    db.query("INSERT INTO ints (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM ints")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // float
  db.query("CREATE TABLE floats (id INTEGER PRIMARY KEY AUTOINCREMENT, val REAL)");
  vals = [42.1, 1.235, 2.999, 1/3, 4.2345, 345.3246, 4536787.953e-8];
  for (const val of vals)
    db.query("INSERT INTO floats (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM floats")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // boolean
  db.query("CREATE TABLE bools (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)");
  vals = [true, false];
  for (const val of vals)
    db.query("INSERT INTO bools (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM bools")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, [1, 0]);

  // blob
  db.query("CREATE TABLE blobs (id INTEGER PRIMARY KEY AUTOINCREMENT, val BLOB)");
  vals = [new Uint8Array([1,2,3,4,5,6,7,8,9,0]), new Uint8Array([3,57,45])];
  for (const val of vals)
    db.query("INSERT INTO blobs (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM blobs")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // null & undefined
  db.query("CREATE TABLE nulls (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)");
  vals = [null, undefined];
  for (const val of vals)
    db.query("INSERT INTO nulls (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM nulls")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, [null, null]); // undefined -> null

  // mixed
  db.query("CREATE TABLE mix (id INTEGER PRIMARY KEY AUTOINCREMENT, val1 INTEGER, val2 TEXT, val3 REAL, val4 TEXT)");
  vals = [42, "Hello World!", 0.33333, null];
  db.query("INSERT INTO mix (val1, val2, val3, val4) VALUES (?, ?, ?, ?)", ...vals);
  rows = [...db.query("SELECT val1, val2, val3, val4 FROM mix")];
  assertEquals(rows.length, 1);
  assertEquals(rows[0], vals);

  // too many
  assertThrows(() => {
    db.query("SELECT * FROM strings", null);
    db.query("SELECT * FROM strings LIMIT ?", 35, "extra");
  });

  // too few
  assertThrows(() => {
    db.query("SELECT * FROM strings LIMIT ?");
    db.query("INSERT INTO mix (val1, val2, val3, val4) VALUES (?, ?, ?, ?)", 1, null);
  });
});

/** Ensure blob data is copied and not viewed. */
test(async function blobsAreCopies() {
  const db = await open();

  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val BLOB)");
  const data = new Uint8Array([1,2,3,4,5]);
  db.query("INSERT INTO test (val) VALUES (?)", data);

  const [[a]] = [...db.query("SELECT val FROM test")];
  const [[b]] = [...db.query("SELECT val FROM test")];

  assertEquals(data, a);
  assertEquals(data, b);
  assertEquals(a, b);

  a[0] = 100;
  assertEquals(a[0], 100);
  assertEquals(b[0], 1);
  assertEquals(data[0], 1);

  data[0] = 5;
  const [[c]] = [...db.query("SELECT val FROM test")];
  assertEquals(c[0], 1);
});

/** Ensure saving to file works. */
test(async function saveToFile() {
  const data = ["Hello World!", "Hello Deno!", "JavaScript <3", "This costs 0€!", "Wéll, hällö thėrè¿"];

  // Write data to db
  const db = await open();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)");
  for (const val of data)
    db.query("INSERT INTO test (val) VALUES (?)", val);
  try {
    await Deno.remove("test.db");
  } catch {}
  await db.save("test.db");

  // Read db and check the data is restored
  const db2 = await open("test.db");
  for (const [id, val] of db2.query("SELECT * FROM test"))
    assertEquals(data[id-1], val);
  await Deno.remove("test.db");
});

/** Test error is thrown on invalid SQL */
test(async function invalidSQL() {
  const db = await open();
  const queries = [
    "INSERT INTO does_not_exist (balance) VALUES (5)",
    "this is not sql",
    { sql: "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)" },
  ];
  for (const query of queries)
    assertThrows(() => db.query(query));
});

/** Test default is enforcing foreign key constraints. */
test(async function foreignKeys() {
  const db = await open();
  db.query("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  db.query("CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user INTEGER, FOREIGN KEY(user) REFERENCES users(id))");

  db.query("INSERT INTO users (id) VALUES (1)");
  const [[id]] = [...db.query("SELECT id FROM users")];

  // User must exist
  assertThrows(() => {
    db.query("INSERT INTO orders (user) VALUES (?)", id+1);
  });
  db.query("INSERT INTO orders (user) VALUES (?)", id);
  // Can't delete if that violates the constraint
  assertThrows(() => {
    db.query("DELETE FROM users WHERE id = ?", id);
  });
  // Now deleting is OK
  db.query("DELETE FROM orders WHERE user = ?", id);
  db.query("DELETE FROM users WHERE id = ?", id);
});

// Skip this tests if we don't have read or write
// permissions.
const skip = [];
const write = (await Deno.permissions.query({ name: "write" })).state === "granted";
const read = (await Deno.permissions.query({ name: "read" })).state === "granted";
if (!write || !read)
  skip.push(...["saveToFile"]);

runIfMain(import.meta, { skip: new RegExp(`^${skip.join("|")}$`), exitOnFail: false });
