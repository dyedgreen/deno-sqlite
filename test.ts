import {
  assertEquals,
  assertMatch,
  assertThrows,
} from "https://deno.land/std@0.53.0/testing/asserts.ts";
import { DB, Status } from "./mod.ts";
import { SqliteError } from "./src/error.ts";

// file used for fs io tests
const testDbFile = "test.db";

const permRead =
  (await Deno.permissions.query({ name: "read", path: "./" })).state ===
    "granted";
const permWrite =
  (await Deno.permissions.query({ name: "write", path: "./" })).state ===
    "granted";

async function removeTestDb(name: string) {
  try {
    await Deno.remove(name);
  } catch { /* no op */ }
  try {
    await Deno.remove(`${testDbFile}-journal`);
  } catch { /* no op */ }
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
  for (const [_name] of db.query("SELECT name FROM people")) continue; // no console.log ;)

  db.close();
});

Deno.test("readmeExampleOld", function () {
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
  assertEquals(res, []);

  // Omit write tests, as we don't want to require ---allow-write
  // and have a write test, which checks for the flag and skips itself.

  const subscribers = db.query(
    "SELECT name, email FROM users WHERE subscribed = ?",
    [true],
  );
  for (const [_name, _email] of subscribers) {
    if (Math.random() > 0.5) continue;
    break;
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
  const intVals: (bigint | number)[] = [9007199254741991n, 100n];
  for (const val of intVals) {
    db.query(
      "INSERT INTO bigints (val) VALUES (?)",
      [val],
    );
  }
  rows = [...db.query("SELECT val FROM bigints")].map(([v]) => v);
  intVals[1] = 100;
  assertEquals(rows, intVals);

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
  assertEquals(rows, [null, null]);

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

Deno.test("preparedQueryQueryMethod", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  db.query("INSERT INTO test (id) VALUES (1), (2), (3)");

  const res = [];
  const select = db.prepareQuery("SELECT id FROM test");
  for (const [id] of select.query()) {
    res.push(id);
  }
  assertEquals(res, [1, 2, 3]);

  select.finalize();
  db.close();
});

Deno.test("preparedQueryQueryAllMethod", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  const select = db.prepareQuery("SELECT id FROM test");

  assertEquals(select.queryAll(), []);
  db.query("INSERT INTO test (id) VALUES (1), (2), (3)");
  assertEquals(select.queryAll(), [[1], [2], [3]]);

  select.finalize();
  db.close();
});

Deno.test("preparedQueryQueryOneMethod", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  db.query("INSERT INTO test (id) VALUES (1), (2), (3)");

  const selectOne = db.prepareQuery("SELECT id FROM test WHERE id = ?");
  assertEquals(selectOne.queryOne([2]), [2]);
  selectOne.finalize();

  const selectAll = db.prepareQuery("SELECT id FROM test");
  assertThrows(() => selectAll.queryOne());
  selectAll.finalize();

  db.close();
});

Deno.test("preparedQueryExecuteMethod", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");

  const insert = db.prepareQuery("INSERT INTO test (id) VALUES (:id)");
  for (const id of [1, 2, 3]) {
    insert.execute({ id });
  }
  insert.finalize();
  assertEquals(db.query("SELECT id FROM test"), [[1], [2], [3]]);

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

  const query = db.prepareQuery("SELECT name FROM test");
  assertThrows(() => db.close());
  query.finalize();

  db.close();
});

Deno.test("openQueriesCleanedUpByForcedClose", function () {
  const db = new DB();
  db.query("CREATE TABLE test (name TEXT PRIMARY KEY)");
  db.query("INSERT INTO test (name) VALUES (?)", ["Deno"]);

  db.query("SELECT name FROM test");
  db.prepareQuery("SELECT name FROM test WHERE name like '%test%'");

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

Deno.test("invalidBindingThrows", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER)");
  assertThrows(() => {
    // deno-lint-ignore no-explicit-any
    const badBinding: any = [{}];
    db.query("SELECT * FORM test WHERE id = ?", badBinding);
  });
  db.close();
});

Deno.test("invalidBindDoesNotLeakStatements", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER)");

  for (let n = 0; n < 100; n++) {
    assertThrows(() => {
      // deno-lint-ignore no-explicit-any
      const badBinding: any = [{}];
      db.query("INSERT INTO test (id) VALUES (?)", badBinding);
    });
    assertThrows(() => {
      const badBinding = { missingKey: null };
      db.query("INSERT INTO test (id) VALUES (?)", badBinding);
    });
  }

  db.query("INSERT INTO test (id) VALUES (1)");

  db.close();
});

Deno.test("getColumnsWithoutNames", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );

  const query = db.prepareQuery("SELECT id, name from test");

  assertEquals(query.columns(), [
    { name: "id", originName: "id", tableName: "test" },
    { name: "name", originName: "name", tableName: "test" },
  ]);
});

Deno.test("insertReturning", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );
  const query = db.prepareQuery(
    "INSERT INTO test (name) VALUES (?) RETURNING *",
  );

  assertEquals(query.columns(), [
    { name: "id", originName: "", tableName: "" },
    { name: "name", originName: "", tableName: "" },
  ]);

  assertEquals(query.queryAll(["name"]), [[1, "name"]]);
});

Deno.test("getColumnsWithNames", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );
  db.query("INSERT INTO test (name) VALUES (?)", ["name"]);

  const query = db.prepareQuery(
    "SELECT id AS test_id, name AS test_name from test",
  );
  const columns = query.columns();

  assertEquals(columns, [
    { name: "test_id", originName: "id", tableName: "test" },
    { name: "test_name", originName: "name", tableName: "test" },
  ]);
});

Deno.test("getColumnsFromFinalizedRows", function () {
  const db = new DB();

  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");

  const query = db.prepareQuery("SELECT id from test");
  query.finalize();

  // after iteration is done
  assertThrows(() => {
    query.columns();
  });
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
  // will be reset to 0 again
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
  const [[objectType]] = db.query(`SELECT json_type('{}')`);
  assertEquals(objectType, "object");

  const [[integerType]] = db.query(`SELECT json_type(?)`, ["2"]);
  assertEquals(integerType, "integer");

  const [[realType]] = db.query(`SELECT json_type(?)`, ["2.5"]);
  assertEquals(realType, "real");

  const [[stringType]] = db.query(`SELECT json_type(?)`, [`"hello"`]);
  assertEquals(stringType, "text");

  const [[integerTypeAtPath]] = db.query(
    `SELECT json_type(?, ?)`,
    [`["hello", 2, {"world": 4}]`, `$[2].world`],
  );
  assertEquals(integerTypeAtPath, "integer");
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
  ignore: !permRead || !permWrite || !(await dbExists("./build/2GB_test.db")),
  fn: function () {
    const db = new DB("./build/2GB_test.db"); // can be generated with `cd build && make testdb`

    db.query("INSERT INTO test (value) VALUES (?)", ["This is a test..."]);

    const rows = [
      ...db.query("SELECT value FROM test ORDER BY id DESC LIMIT 10"),
    ];
    assertEquals(rows.length, 10);
    assertEquals(rows[0][0], "This is a test...");

    db.close();
  },
});

Deno.test("emptyQueryReturnsEmptyArray", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY)");
  assertEquals([], db.query("SELECT * FROM test"));
  db.close();
});

Deno.test("prepareQueryCanBeReused", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY)");

  const query = db.prepareQuery("INSERT INTO test (id) VALUES (?)");
  query.execute([1]);
  query.execute([2]);
  query.execute([3]);

  assertEquals([[1], [2], [3]], db.query("SELECT id FROM test"));

  query.finalize();
  db.close();
});

Deno.test("prepareQueryClearsBindingsBeforeReused", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)");

  const query = db.prepareQuery("INSERT INTO test (value) VALUES (?)");
  query.execute([1]);
  query.execute();

  assertEquals([[1], [null]], db.query("SELECT value FROM test"));

  query.finalize();
  db.close();
});

// TODO(dyedgreen): Should it?
// Deno.test("prepareQueryMarksOldRowsAsDoneWhenReused", function () {
//   const db = new DB();
//   db.query("CREATE TABLE test (id INTEGER PRIMARY KEY)");
//   db.query("INSERT INTO test (id) VALUES (?), (?), (?)", [1, 2, 3]);
//
//   const query = db.prepareQuery("SELECT id FROM test");
//
//   const a = query.query();
//   assertEquals({ done: false, value: [1] }, a.next());
//
//   const b = query();
//   assertEquals([], [...a]);
//   assertEquals([[1], [2], [3]], [...b]);
//
//   query.finalize();
//   db.close();
// });

Deno.test("bigIntegersBindCorrectly", function () {
  const db = new DB();
  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)",
  );

  const goodValues = [
    0n,
    42n,
    -42n,
    9223372036854775807n,
    -9223372036854775808n,
  ];
  const overflowValues = [
    9223372036854775807n + 1n,
    -9223372036854775808n - 1n,
    2352359223372036854775807n,
    -32453249223372036854775807n,
  ];

  const query = db.prepareQuery("INSERT INTO test (val) VALUES (?)");
  for (const val of goodValues) {
    query.execute([val]);
  }

  const dbValues = [...db.query("SELECT val FROM test ORDER BY id")].map((
    [id],
  ) => BigInt(id));
  assertEquals(goodValues, dbValues);

  for (const bigVal of overflowValues) {
    assertThrows(() => {
      query.execute([bigVal]);
    });
  }

  query.finalize();
  db.close();
});

Deno.test("queryFinalizedPreparedQueryFails", function () {
  const db = new DB();
  db.query("CREATE TABLE test (name TEXT)");
  const query = db.prepareQuery("INSERT INTO test (name) VALUES (?)");
  query.finalize();

  assertThrows(() => query.execute(["test"]));
  db.close();
});

Deno.test("rowsOnPreparedQuery", function () {
  const db = new DB();
  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEST, age INTEGER)",
  );
  db.query("INSERT INTO test (name, age) VALUES (?, ?)", ["Peter Parker", 21]);

  const query = db.prepareQuery("SELECT * FROM test");
  const columnsFromPreparedQuery = query.columns();
  query.finalize();

  const queryEmpty = db.prepareQuery("SELECT * FROM test WHERE 1 = 0");
  const columnsFromPreparedQueryWithEmptyQuery = queryEmpty.columns();
  assertEquals(queryEmpty.queryAll(), []);
  query.finalize();

  assertEquals(
    [{ name: "id", originName: "id", tableName: "test" }, {
      name: "name",
      originName: "name",
      tableName: "test",
    }, { name: "age", originName: "age", tableName: "test" }],
    columnsFromPreparedQuery,
  );
  assertEquals(
    columnsFromPreparedQueryWithEmptyQuery,
    columnsFromPreparedQuery,
  );
});

Deno.test("localtimeReflectsSystemLocale", function () {
  const db = new DB();
  const [[timeDb]] = db.query("SELECT datetime('now', 'localtime')");
  const now = new Date();

  const jsMonth = `${now.getMonth() + 1}`.padStart(2, "0");
  const jsDate = `${now.getDate()}`.padStart(2, "0");
  const jsHour = `${now.getHours()}`.padStart(2, "0");
  const jsMinute = `${now.getMinutes()}`.padStart(2, "0");
  const jsSecond = `${now.getSeconds()}`.padStart(2, "0");
  const timeJs =
    `${now.getFullYear()}-${jsMonth}-${jsDate} ${jsHour}:${jsMinute}:${jsSecond}`;

  assertEquals(timeDb, timeJs);
});

// Tests which drop the permission from read + write to read only
// and should run after any other test.

Deno.test({
  name: "databaseOpenOptions",
  ignore: !permRead || !permWrite,
  fn: async function () {
    await removeTestDb(testDbFile);

    // when no file exists, these should error
    assertThrows(() => new DB(testDbFile, { mode: "write" }));
    assertThrows(() => new DB(testDbFile, { mode: "read" }));

    // create the database
    const dbCreate = new DB(testDbFile, { mode: "create" });
    dbCreate.query(
      "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)",
    );
    dbCreate.close();

    const dbWrite = new DB(testDbFile, { mode: "write" });
    dbWrite.query("INSERT INTO test (name) VALUES (?)", ["open-options-test"]);
    dbWrite.close();

    const dbRead = new DB(testDbFile, { mode: "read" });
    const rows = [...dbRead.query("SELECT id, name FROM test")];
    assertEquals(rows, [[1, "open-options-test"]]);
    assertThrows(() =>
      dbRead.query("INTERT INTO test (name) VALUES (?)", ["this-fails"])
    );
    dbRead.close();

    await Deno.permissions.revoke({ name: "write" });
    assertThrows(() => new DB(testDbFile));
    assertThrows(() => new DB(testDbFile, { mode: "create" }));
    assertThrows(() => new DB(testDbFile, { mode: "write" }));
    (new DB(testDbFile, { mode: "read" })).close();

    // with memory flag set, the database will be in memory and
    // not require any permissions
    await Deno.permissions.revoke({ name: "read" });
    assertThrows(() => new DB(testDbFile, { mode: "read" }));
    (new DB(testDbFile, { memory: true })).close();

    // the mode can also be specified via uri flag and setting the
    // relevant parameter
    (new DB(`file:${testDbFile}?mode=memory`, { uri: true })).close();
  },
});
