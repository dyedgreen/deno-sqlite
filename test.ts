import { runIfMain, test } from "https://deno.land/std/testing/mod.ts";
import { assert, assertEquals, assertMatch, assertThrows } from "https://deno.land/std/testing/asserts.ts";

import { open, Empty } from "./mod.ts";

/** Ensure the README examples works as advertised. */
test(async function readmeExample() {
  const db = await open();
  const first = ["Bruce", "Clark", "Peter"];
  const last = ["Wane", "Kent", "Parker"];
  db.query(
    "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subscribed INTEGER);"
  );

  for (let i = 0; i < 100; i++) {
    const name = `${first[Math.floor(Math.random() * first.length)]} ${
      last[Math.floor(Math.random() * last.length)]
    }`;
    const email = `${name.replace(" ", "-")}@deno.land`;
    const subscribed = Math.random() > 0.5 ? true : false;
    db.query(
      "INSERT INTO users (name, email, subscribed) VALUES (?, ?, ?);",
      name,
      email,
      subscribed
    );
  }

  for (const [name, email] of db.query(
    "SELECT name, email FROM users WHERE subscribed = ? LIMIT 100;",
    true
  )) {
    assertMatch(name, /(Bruce|Clark|Peter) (Wane|Kent|Parker)/);
    assertEquals(email, `${name.replace(" ", "-")}@deno.land`);
  }

  const res = db.query(
    "SELECT email FROM users WHERE name LIKE ?;",
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

/** Ensure binding values works correctly */
test(async function bindValues() {
  const db = await open();
  let vals, rows;

  // string
  db.query("CREATE TABLE strings (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT);");
  vals = ["Hello World!", "I love Deno.", "Täst strüng..."];
  for (const val of vals)
    db.query("INSERT INTO strings (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM strings;")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // integer
  db.query("CREATE TABLE ints (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER);");
  vals = [42, 1, 2, 3, 4, 3453246, 4536787093, 45536787093];
  for (const val of vals)
    db.query("INSERT INTO ints (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM ints;")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // float
  db.query("CREATE TABLE floats (id INTEGER PRIMARY KEY AUTOINCREMENT, val REAL);");
  vals = [42.1, 1.235, 2.999, 1/3, 4.2345, 345.3246, 4536787.953e-8];
  for (const val of vals)
    db.query("INSERT INTO floats (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM floats;")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // boolean
  db.query("CREATE TABLE bools (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER);");
  vals = [true, false];
  for (const val of vals)
    db.query("INSERT INTO bools (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM bools;")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, [1, 0]);

  // null & undefined
  db.query("CREATE TABLE nulls (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER);");
  vals = [null, undefined];
  for (const val of vals)
    db.query("INSERT INTO nulls (val) VALUES (?)", val);
  rows = [...db.query("SELECT val FROM nulls;")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, [null, null]); // undefined -> null

  // mixed
  db.query("CREATE TABLE mix (id INTEGER PRIMARY KEY AUTOINCREMENT, val1 INTEGER, val2 TEXT, val3 REAL, val4 TEXT);");
  vals = [42, "Hello World!", 0.33333, null];
  db.query("INSERT INTO mix (val1, val2, val3, val4) VALUES (?, ?, ?, ?)", ...vals);
  rows = [...db.query("SELECT val1, val2, val3, val4 FROM mix;")];
  assertEquals(rows.length, 1);
  assertEquals(rows[0], vals);

  // too many
  assertThrows(() => {
    db.query("SELECT * FROM strings;", null);
    db.query("SELECT * FROM strings LIMIT ?;", 35, "extra");
  });

  // too few
  assertThrows(() => {
    db.query("SELECT * FROM strings LIMIT ?;");
    db.query("INSERT INTO mix (val1, val2, val3, val4) VALUES (?, ?, ?, ?)", 1, null);
  });
});

runIfMain(import.meta);
