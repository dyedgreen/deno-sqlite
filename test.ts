import {
  assert,
  assertEquals,
  assertMatch,
  assertThrows,
} from "https://deno.land/std/testing/asserts.ts";
import { open, save, DB, Empty, Status } from "./mod.ts";
import SqliteError from "./src/error.ts";

// permissions for skipping tests which require them
// if the permission can't be read, it is assumed granted
const d: any = Deno as any;
const permWrite = !d.permissions ||
  (await d.permissions.query({ name: "write" })).state === "granted";
const permRead = !d.permissions ||
  (await d.permissions.query({ name: "read" })).state === "granted";

/** Ensure README example works as advertised. */
Deno.test("readmeExample", function () {
  // Open a database (no file permission version of open)
  const db = new DB();
  db.query(
    "CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );

  const name =
    ["Peter Parker", "Clark Kent", "Bruce Wane"][Math.floor(Math.random() * 3)];

  // Run a simple query
  db.query("INSERT INTO people (name) VALUES (?)", [name]);

  // Print out data in table
  for (const [name] of db.query("SELECT name FROM people")) continue; // no console.log ;)

  // Save and close connection
  // await save(db);
  db.close();
});

/** Ensure the old README examples works as advertised. */
Deno.test("readmeExampleOld", async function () {
  const db = new DB();
  const first = ["Bruce", "Clark", "Peter"];
  const last = ["Wane", "Kent", "Parker"];
  db.query(
    "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subscribed INTEGER)",
  );

  for (let i = 0; i < 100; i++) {
    const name = `${first[Math.floor(Math.random() * first.length)]} ${
      last[
        Math.floor(
          Math.random() * last.length,
        )
      ]
    }`;
    const email = `${name.replace(" ", "-")}@deno.land`;
    const subscribed = Math.random() > 0.5 ? true : false;
    db.query("INSERT INTO users (name, email, subscribed) VALUES (?, ?, ?)", [
      name,
      email,
      subscribed,
    ]);
  }

  for (
    const [
      name,
      email,
    ] of db.query(
      "SELECT name, email FROM users WHERE subscribed = ? LIMIT 100",
      [true],
    )
  ) {
    assertMatch(name, /(Bruce|Clark|Peter) (Wane|Kent|Parker)/);
    assertEquals(email, `${name.replace(" ", "-")}@deno.land`);
  }

  const res = db.query("SELECT email FROM users WHERE name LIKE ?", [
    "Robert Parr",
  ]);
  assertEquals(res, Empty);
  res.done();

  // Omit write tests, as we don't want to require ---allow-write
  // and have a write test, which checks for the flag and skips itself.

  const subscribers = db.query(
    "SELECT name, email FROM users WHERE subscribed = ?",
    [true],
  );
  for (const [name, email] of subscribers) {
    if (Math.random() > 0.5) continue;
    subscribers.done();
  }

  db.close();
});

/** Ensure binding values works correctly. */
Deno.test("bindValues", function () {
  const db = new DB();
  let vals, rows;

  // string
  db.query(
    "CREATE TABLE strings (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)",
  );
  vals = ["Hello World!", "I love Deno.", "Täst strüng..."];
  for (const val of vals) {
    db.query("INSERT INTO strings (val) VALUES (?)", [val]);
  }
  rows = [...db.query("SELECT val FROM strings")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // integer
  db.query(
    "CREATE TABLE ints (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)",
  );
  vals = [42, 1, 2, 3, 4, 3453246, 4536787093, 45536787093];
  for (const val of vals) db.query("INSERT INTO ints (val) VALUES (?)", [val]);
  rows = [...db.query("SELECT val FROM ints")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // float
  db.query(
    "CREATE TABLE floats (id INTEGER PRIMARY KEY AUTOINCREMENT, val REAL)",
  );
  vals = [42.1, 1.235, 2.999, 1 / 3, 4.2345, 345.3246, 4536787.953e-8];
  for (const val of vals) {
    db.query("INSERT INTO floats (val) VALUES (?)", [val]);
  }
  rows = [...db.query("SELECT val FROM floats")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // boolean
  db.query(
    "CREATE TABLE bools (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)",
  );
  vals = [true, false];
  for (const val of vals) {
    db.query(
      "INSERT INTO bools (val) VALUES (?)",
      [val],
    );
  }
  rows = [...db.query("SELECT val FROM bools")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, [1, 0]);

  // date
  db.query("CREATE TABLE dates (date TEXT NOT NULL)");
  vals = [new Date(), new Date("2018-11-20"), new Date(123456789)];
  for (const val of vals) {
    db.query("INSERT INTO dates (date) VALUES (?)", [val]);
  }
  rows = [...db.query("SELECT date FROM dates")].map(([d]) => new Date(d));
  assertEquals(rows, vals);

  // blob
  db.query(
    "CREATE TABLE blobs (id INTEGER PRIMARY KEY AUTOINCREMENT, val BLOB)",
  );
  vals = [
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
    new Uint8Array([3, 57, 45]),
  ];
  for (const val of vals) {
    db.query(
      "INSERT INTO blobs (val) VALUES (?)",
      [val],
    );
  }
  rows = [...db.query("SELECT val FROM blobs")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, vals);

  // null & undefined
  db.query(
    "CREATE TABLE nulls (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)",
  );
  vals = [null, undefined];
  for (const val of vals) {
    db.query(
      "INSERT INTO nulls (val) VALUES (?)",
      [val],
    );
  }
  rows = [...db.query("SELECT val FROM nulls")].map(([v]) => v);
  assertEquals(rows.length, vals.length);
  assertEquals(rows, [null, null]); // TODO(hsjoberg) undefined -> null

  // mixed
  db.query(
    "CREATE TABLE mix (id INTEGER PRIMARY KEY AUTOINCREMENT, val1 INTEGER, val2 TEXT, val3 REAL, val4 TEXT)",
  );
  vals = [42, "Hello World!", 0.33333, null];
  db.query(
    "INSERT INTO mix (val1, val2, val3, val4) VALUES (?, ?, ?, ?)",
    vals,
  );
  rows = [...db.query("SELECT val1, val2, val3, val4 FROM mix")];
  assertEquals(rows.length, 1);
  assertEquals(rows[0], vals);

  // too many
  assertThrows(() => {
    db.query("SELECT * FROM strings", [null]);
  });
  assertThrows(() => {
    db.query("SELECT * FROM strings LIMIT ?", [5, "extra"]);
  });

  // too few
  assertThrows(() => {
    db.query("SELECT * FROM strings LIMIT ?");
  });
  assertThrows(() => {
    db.query(
      "SELECT * FROM mix WHERE val1 = ? AND val2 = ? AND val3 = ? LIMIT ?",
      [
        1,
        "second",
      ],
    );
  });

  // omitted is null
  db.query(
    "CREATE TABLE omit_is_null (idx INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)",
  );
  db.query("INSERT INTO omit_is_null (val) VALUES (?)");
  rows = [...db.query("SELECT val FROM omit_is_null")].map(([val]) => val);
  assertEquals(rows, [null]);

  db.close();
});

/** Ensure binding named values works as advertised. */
Deno.test("bindNamedParameters", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)",
  );

  // default named syntax
  db.query("INSERT INTO test (val) VALUES (:val)", { val: "value" });
  db.query(
    "INSERT INTO test (val) VALUES (:otherVal)",
    { otherVal: "value other" },
  );

  // @ named syntax
  db.query(
    "INSERT INTO test (val) VALUES (@someName)",
    { ["@someName"]: "@value" },
  );

  // $ names syntax
  db.query(
    "INSERT INTO test (val) VALUES ($var::Name)",
    { ["$var::Name"]: "$value" },
  );

  // explicit positional syntax
  db.query("INSERT INTO test (id, val) VALUES (?2, ?1)", ["this-is-it", 1000]);

  // names must exist
  assertThrows(() => {
    db.query(
      "INSERT INTO test (val) VALUES (:val)",
      { Val: "miss-spelled :(" },
    );
  });

  // Make sure the data came through correctly
  const vals = [...db.query("SELECT val FROM test ORDER BY id ASC")].map(
    (row) => row[0],
  );
  assertEquals(
    vals,
    ["value", "value other", "@value", "$value", "this-is-it"],
  );

  db.close();
});

/** Ensure blob data is copied and not viewed. */
Deno.test("blobsAreCopies", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val BLOB)",
  );
  const data = new Uint8Array([1, 2, 3, 4, 5]);
  db.query("INSERT INTO test (val) VALUES (?)", [data]);

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

  db.close();
});

/** Ensure data returned works. */
Deno.test("data", function () {
  const db = new DB();

  // Write some data
  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)",
  );
  db.query("INSERT INTO test (val) VALUES ('test')");

  // Construct second db that is a copy of the first
  const db2 = new DB(db.data());
  const [[val]] = [...db.query("SELECT val FROM test")];
  const [[val2]] = [...db2.query("SELECT val FROM test")];
  assertEquals(val, val2);

  db.close();
  db2.close();
});

/** Ensure saving to file works. */
Deno.test({
  name: "saveToFile",
  ignore: !permRead || !permWrite,
  fn: async function () {
    const data = [
      "Hello World!",
      "Hello Deno!",
      "JavaScript <3",
      "This costs 0€!",
      "Wéll, hällö thėrè¿",
    ];

    // Ensure test file does not exist
    try {
      await Deno.remove("test.db");
    } catch {}

    // Write data to db
    const db = await open("test.db");
    db.query(
      "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)",
    );
    for (const val of data) {
      db.query("INSERT INTO test (val) VALUES (?)", [val]);
    }
    await save(db);

    // Read db and check the data is restored
    const db2 = await open("test.db");
    for (const [id, val] of db2.query("SELECT * FROM test")) {
      assertEquals(data[id - 1], val);
    }

    // Clean up
    await Deno.remove("test.db");
    db.close();
    db2.close();
  },
});

/** Test error is thrown on invalid SQL. */
Deno.test("invalidSQL", function () {
  const db = new DB();
  const queries = [
    "INSERT INTO does_not_exist (balance) VALUES (5)",
    "this is not sql",
    { sql: "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)" },
  ];
  for (const query of queries) assertThrows(() => db.query(query));

  db.close();
});

/** Test default is enforcing foreign key constraints. */
Deno.test("foreignKeys", function () {
  const db = new DB();
  db.query("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  db.query(
    "CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user INTEGER, FOREIGN KEY(user) REFERENCES users(id))",
  );

  db.query("INSERT INTO users (id) VALUES (1)");
  const [[id]] = [...db.query("SELECT id FROM users")];

  // User must exist
  assertThrows(() => {
    db.query("INSERT INTO orders (user) VALUES (?)", [id + 1]);
  });
  db.query("INSERT INTO orders (user) VALUES (?)", [id]);
  // Can't delete if that violates the constraint
  assertThrows(() => {
    db.query("DELETE FROM users WHERE id = ?", [id]);
  });
  // Now deleting is OK
  db.query("DELETE FROM orders WHERE user = ?", [id]);
  db.query("DELETE FROM users WHERE id = ?", [id]);

  db.close();
});

/** Test db limit. */
Deno.test("dbLimit", function () {
  const dbs = [];
  let limitReached = false;
  try {
    // try to open too many DBs
    // (we currently do not guarantee what the limit is)
    for (let i = 0; i < 10_000; i++) dbs.push(new DB());
  } catch {
    limitReached = true;
  }
  assertEquals(limitReached, true);
  assertThrows(() => new DB());
  dbs.forEach((db) => db.close());
  const db = new DB();
  db.close();
});

/** Test query limit. */
Deno.test("queryLimit", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY)");
  db.query("INSERT INTO test VALUES (1)");

  const queries = [];
  try {
    for (let i = 0; i < 10_000; i++) {
      queries.push(db.query("SELECT * FROM test"));
    }
  } catch {}

  assertThrows(() => {
    db.query("SELECT * FROM test");
  });
  queries.forEach((query) => query.done());
  db.query("SELECT * FROM test").done();

  db.close();
});

/** Test close behaves correctly. */
Deno.test("closeDB", function () {
  const db = new DB();
  db.close();

  assertThrows(() => db.query("CREATE TABLE test (name TEXT PRIMARY KEY)"));
  assertThrows(() => db.data());
});

/** Test having open queries blocks closing. */
Deno.test("openQueriesBlockClose", function () {
  const db = new DB();
  db.query("CREATE TABLE test (name TEXT PRIMARY KEY)");
  db.query("INSERT INTO test (name) VALUES (?)", ["Deno"]);
  const rows = db.query("SELECT name FROM test");

  // We have an open query
  assertThrows(() => db.close());

  rows.done();
  db.close();
});

/** Test SQLite constraint error code. */
Deno.test("constraintErrorCode", function () {
  const db = new DB();
  db.query("CREATE TABLE test (name TEXT PRIMARY KEY)");
  db.query("INSERT INTO test (name) VALUES (?)", ["A"]);

  const e = assertThrows(() =>
    db.query("INSERT INTO test (name) VALUES (?)", ["A"])
  ) as SqliteError;
  assertEquals(e.code, Status.SqliteConstraint, "Got wrong error code");
  assertEquals(
    Status[e.codeName],
    Status.SqliteConstraint,
    "Got wrong error code name",
  );
});

/** Test SQLite syntax error error code. */
Deno.test("syntaxErrorErrorCode", function () {
  const db = new DB();

  const e = assertThrows(() =>
    db.query("CREATE TABLEX test (name TEXT PRIMARY KEY)")
  ) as SqliteError;
  assertEquals(e.code, Status.SqliteError, "Got wrong error code");
  assertEquals(
    Status[e.codeName],
    Status.SqliteError,
    "Got wrong error code name",
  );
});

/** Test invalid value does not cause statement leakage. */
Deno.test("invalidBindDoesNotLeakStatements", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER)");

  for (let n = 0; n < 100; n++) {
    try {
      db.query("INSERT INTO test (id) VALUES (?)", [{}]);
    } catch {}
  }

  db.query("INSERT INTO test (id) VALUES (1)");

  db.close();
});

Deno.test("getColumnsWithoutNames", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );
  db.query("INSERT INTO test (name) VALUES (?)", ["name"]);

  const rows = db.query("SELECT id, name from test");
  const columns = rows.columns();

  assertEquals(columns, [
    { name: "id", originName: "id", tableName: "test" },
    { name: "name", originName: "name", tableName: "test" },
  ]);
});

Deno.test("getColumnsWithNames", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );
  db.query("INSERT INTO test (name) VALUES (?)", ["name"]);

  const rows = db.query("SELECT id AS test_id, name AS test_name from test");
  const columns = rows.columns();

  assertEquals(columns, [
    { name: "test_id", originName: "id", tableName: "test" },
    { name: "test_name", originName: "name", tableName: "test" },
  ]);
});

Deno.test("getColumnsFromFinalizedRows", function () {
  const db = new DB();

  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");

  const rows = db.query("SELECT id from test");

  rows.done();

  // after iteration is done
  assertThrows(() => {
    rows.columns();
  });
});

Deno.test("dateTimeIsCorrect", function () {
  const db = new DB();
  // the date/ time is passed from JS and should be current (note that it is GMT)
  const [[now]] = [...db.query("SELECT current_timestamp")];
  assertEquals(new Date(now + "Z"), new Date());
  db.close();
});
