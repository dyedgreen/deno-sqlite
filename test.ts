import {
  assert,
  assertEquals,
  assertMatch,
  assertThrows,
} from "https://deno.land/std@0.53.0/testing/asserts.ts";
import { createHash } from "https://deno.land/std@0.61.0/hash/mod.ts";
import { DB, Empty, Status } from "./mod.ts";
import SqliteError from "./src/error.ts";

// file used for fs io tests
const testDbFile = "test.db";

let permRead =
  (await Deno.permissions.query({ name: "read", path: "./" })).state ===
    "granted";
let permWrite =
  (await Deno.permissions.query({ name: "write", path: "./" })).state ===
    "granted";

async function removeTestDb(name: string) {
  try {
    await Deno.remove(name);
  } catch {}
  try {
    await Deno.remove(`${testDbFile}-journal`);
  } catch {}
}

async function dbExists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

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

  db.close();
});

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
  res.return();

  // Omit write tests, as we don't want to require ---allow-write
  // and have a write test, which checks for the flag and skips itself.

  const subscribers = db.query(
    "SELECT name, email FROM users WHERE subscribed = ?",
    [true],
  );
  for (const [name, email] of subscribers) {
    if (Math.random() > 0.5) continue;
    subscribers.return();
  }

  db.close();
});

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

  // big int
  db.query(
    "CREATE TABLE bigints (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)",
  );
  const int_vals: (bigint | number)[] = [9007199254741991n, 100n];
  for (const val of int_vals) {
    db.query(
      "INSERT INTO bigints (val) VALUES (?)",
      [val],
    );
  }
  rows = [...db.query("SELECT val FROM bigints")].map(([v]) => v);
  int_vals[1] = 100;
  assertEquals(rows, int_vals);

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
    await removeTestDb(testDbFile);

    // Write data to db
    const db = new DB(testDbFile);
    db.query(
      "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)",
    );
    for (const val of data) {
      db.query("INSERT INTO test (val) VALUES (?)", [val]);
    }

    // Read db and check the data is restored
    const db2 = await new DB(testDbFile);
    for (const [id, val] of db2.query("SELECT * FROM test")) {
      assertEquals(data[id - 1], val);
    }

    // Clean up
    await Deno.remove(testDbFile);
    db.close();
    db2.close();
  },
});

Deno.test({
  name: "tempDB",
  ignore: !permRead || !permWrite,
  fn: function () {
    const data = [
      "Hello World!",
      "Hello Deno!",
      "JavaScript <3",
      "This costs 0€!",
      "Wéll, hällö thėrè¿",
    ];

    const db = new DB("");

    db.query(
      "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)",
    );
    for (const val of data) {
      db.query("INSERT INTO test (val) VALUES (?)", [val]);
    }

    // Read db and check the data is restored
    for (const [id, val] of db.query("SELECT * FROM test")) {
      assertEquals(data[id - 1], val);
    }

    db.close();
  },
});

Deno.test({
  name: "largeDB",
  ignore: !permRead || !permWrite,
  fn: async function () {
    // Ensure test file does not exist
    await removeTestDb(testDbFile);
    const db = new DB(testDbFile);

    // test taken from https://github.com/dyedgreen/deno-sqlite/issues/75
    db.query(
      "CREATE TABLE IF NOT EXISTS nos (c1 INTEGER, c2 TEXT, c3 TEXT, c4 TEXT, c5 TEXT, c6 TEXT, c7 INTEGER, c8 TEXT UNIQUE)",
    );

    const MAX = 100000;

    const xs = [];
    for (let i = 0; i < MAX; i++) {
      const a = i * 15000;
      const b = a % 37;
      const c = a * b / 41;
      const d = c + a;
      const e = (new Date()).getTime() + b - a;
      const f = b - a;
      const g = a + e;

      const hash = createHash("sha1");
      hash.update(`${a}${b}{c}{d}{e}{f}{g}`);
      const h = hash.toString();

      xs.push({
        c1: a,
        c2: `${b}`,
        c3: `${c}`,
        c4: `${d}`,
        c5: `${e}`,
        c6: `${f}`,
        c7: g,
        c8: h,
      });
    }

    db.query("begin;");
    for (let i = 0; i < xs.length; i++) {
      const n = i + 1;
      const commit = n % (MAX / 10) === 0;
      const x = xs[i];
      db.query(
        "INSERT OR IGNORE INTO nos(c1, c2, c3, c4, c5, c6, c7, c8) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
        [x.c1, x.c2, x.c3, x.c4, x.c5, x.c6, x.c7, x.c8],
      );
      if (commit) {
        db.query("commit;");
        db.query("begin;");
      }
    }
    db.query("commit;");

    db.close();
  },
});

Deno.test("invalidSQL", function () {
  const db = new DB();
  const queries = [
    "INSERT INTO does_not_exist (balance) VALUES (5)",
    "this is not sql",
    ";;;",
  ];
  for (const query of queries) assertThrows(() => db.query(query));

  db.close();
});

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

Deno.test("closeDB", function () {
  const db = new DB();
  db.close();

  assertThrows(() => db.query("CREATE TABLE test (name TEXT PRIMARY KEY)"));
});

Deno.test("openQueriesBlockClose", function () {
  const db = new DB();
  db.query("CREATE TABLE test (name TEXT PRIMARY KEY)");
  db.query("INSERT INTO test (name) VALUES (?)", ["Deno"]);
  const rows = db.query("SELECT name FROM test");

  // We have an open query
  assertThrows(() => db.close());

  rows.return();
  db.close();
});

Deno.test("openQueriesCleanedUpByForcedClose", function () {
  const db = new DB();
  db.query("CREATE TABLE test (name TEXT PRIMARY KEY)");
  db.query("INSERT INTO test (name) VALUES (?)", ["Deno"]);
  const rows = db.query("SELECT name FROM test");

  assertThrows(() => db.close());
  db.close(true);
});

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

Deno.test("insertReturning", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );
  const result = db.query(
    "INSERT INTO test (name) VALUES (?) RETURNING *",
    ["name"],
  );

  assertEquals(result.columns(), [
    { name: "id", originName: "", tableName: "" },
    { name: "name", originName: "", tableName: "" },
  ]);

  assertEquals([...result.asObjects()], [
    {
      "id": 1,
      "name": "name",
    },
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

  rows.return();

  // after iteration is done
  assertThrows(() => {
    rows.columns();
  });
});

Deno.test("closingIteratorFinalizesRows", function () {
  const db = new DB();

  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  for (let i = 0; i < 10; i++) {
    db.query("INSERT INTO test (id) VALUES (?)", [i]);
  }

  const rows1 = db.query("SELECT * FROM test");
  for (const _ of rows1) {
    break;
  }
  assertEquals(rows1.next().done, true);

  const rows2 = db.query("SELECT * FROM test");
  try {
    for (const _ of rows2) {
      throw "this is an error ...";
    }
  } catch {}
  assertEquals(rows2.next().done, true);

  db.close();
});

Deno.test("dateTimeIsCorrect", function () {
  const db = new DB();
  // the date/ time is passed from JS and should be current (note that it is GMT)
  const [[now]] = [...db.query("SELECT current_timestamp")];
  assertEquals(new Date(now + "Z"), new Date());
  db.close();
});

Deno.test("lastInsertedId", function () {
  const db = new DB();

  // By default, lastInsertRowId must be 0
  assertEquals(db.lastInsertRowId, 0);

  // Create table and insert value
  db.query("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");

  const insertRowIds = [];

  // Insert data to table and collect their ids
  for (let i = 0; i < 10; i++) {
    db.query("INSERT INTO users (name) VALUES ('John Doe')");
    insertRowIds.push(db.lastInsertRowId);
  }

  // Now, the last inserted row id must be 10
  assertEquals(db.lastInsertRowId, 10);

  // All collected row ids must be the same as in the database
  assertEquals(
    insertRowIds,
    [...db.query("SELECT id FROM users")].map(([i]) => i),
  );

  db.close();

  // When the database is closed, the value
  // will be resetted to 0 again
  assertEquals(db.lastInsertRowId, 0);
});

Deno.test("changes", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );

  for (const name of ["a", "b", "c"]) {
    db.query("INSERT INTO test (name) VALUES (?)", [name]);
    assertEquals(1, db.changes);
  }

  db.query("UPDATE test SET name = ?", ["new name"]);
  assertEquals(3, db.changes);

  assertEquals(6, db.totalChanges);
});

Deno.test("outputToObjectArray", function () {
  const db = new DB();

  const expectedName = "John Doe";

  // Create table and insert value
  db.query(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`);

  // Insert data to table
  for (let i = 0; i < 2; i++) {
    db.query("INSERT INTO users (name) VALUES ('John Doe')");
  }

  const res = [...db.query("SELECT * FROM users").asObjects()];

  assert(
    res.length === 2,
    "Result is not an array or does not have the correct length",
  );

  for (let row of res) {
    assert(typeof row === "object", "Row is not an object");
    assert(
      row.hasOwnProperty("id") && row.hasOwnProperty("name"),
      "Row does not have the correct properties",
    );
    assert(row.name === expectedName, "Name is incorrect");
    assert(typeof row.id === "number", "ID is incorrect");
  }
});

Deno.test("outputToObjectArrayEmpty", function () {
  const db = new DB();

  // Create table and insert value
  db.query(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`);

  // All collected row ids must be the same as in the database
  const res = [...db.query("SELECT * FROM users").asObjects()];

  assert(
    res.length === 0,
    "Result is not an array or does not have the correct length",
  );
});

Deno.test("jsonFunctions", function () {
  const db = new DB();

  // The JSON1 functions should exist and we should be able to call them without unexpected errors
  db.query(`SELECT json('{"this is": ["json"]}')`);

  // We should expect an error if we pass invalid JSON where valid JSON is expected
  assertThrows(() => {
    db.query(`SELECT json('this is not json')`);
  });

  // We should be able to use bound values as arguments to the JSON1 functions,
  // and they should produce the expected results for these simple expressions.
  const [[object_type]] = db.query(`SELECT json_type('{}')`);
  assertEquals(object_type, "object");

  const [[integer_type]] = db.query(`SELECT json_type(?)`, ["2"]);
  assertEquals(integer_type, "integer");

  const [[real_type]] = db.query(`SELECT json_type(?)`, ["2.5"]);
  assertEquals(real_type, "real");

  const [[string_type]] = db.query(`SELECT json_type(?)`, [`"hello"`]);
  assertEquals(string_type, "text");

  const [[integer_type_at_path]] = db.query(
    `SELECT json_type(?, ?)`,
    [`["hello", 2, {"world": 4}]`, `$[2].world`],
  );
  assertEquals(integer_type_at_path, "integer");
});

Deno.test("veryLargeNumbers", function () {
  const db = new DB();

  db.query("CREATE TABLE numbers (id INTEGER PRIMARY KEY, number REAL)");

  db.query("INSERT INTO numbers (number) VALUES (?)", [+Infinity]);
  db.query("INSERT INTO numbers (number) VALUES (?)", [-Infinity]);
  db.query("INSERT INTO numbers (number) VALUES (?)", [+20e20]);
  db.query("INSERT INTO numbers (number) VALUES (?)", [-20e20]);

  const [
    [positiveInfinity],
    [negativeInfinity],
    [positiveTwentyTwenty],
    [negativeTwentyTwenty],
  ] = db.query("SELECT number FROM numbers");

  assertEquals(negativeInfinity, -Infinity);
  assertEquals(positiveInfinity, +Infinity);
  assertEquals(positiveTwentyTwenty, +20e20);
  assertEquals(negativeTwentyTwenty, -20e20);
});

Deno.test({
  name: "dbLarger2GB",
  ignore: !permRead || !permWrite || !(await dbExists("movies.db")),
  fn: async function () {
    // This test needs to write to a very large database file (>2GB)
    // generating/ downloading this file at test time takes a long time
    // and so currently this test depends on the file being present in
    // the system already. To get a copy of the file used visit
    // https://www.kaggle.com/clementmsika/mubi-sqlite-database-for-movie-lovers
    //
    // TODO(dyedgreen): Somehow add large database file to GitHub test container
    const db = new DB("movies.db");
    const rand = () => Math.random().toString(36).substring(7);
    db.query("INSERT INTO ratings (critic) VALUES (?)", [rand()]);
    db.close();
  },
});
