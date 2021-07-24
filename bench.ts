import {
  bench,
  runBenchmarks,
} from "https://deno.land/std@0.53.0/testing/bench.ts";
import { DB } from "./mod.ts";

const dbFile = Deno.args[0] || ":memory:";
const db = new DB(dbFile);

db.query(
  "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, balance INTEGER)",
);

/** Performance of insert statements (1 insert). */
let n = 0;
const names = "Deno Land Peter Parker Clark Kent Robert Parr".split(" ");

bench({
  name: "insert (named)",
  runs: 10_000,
  func: (b): void => {
    n = (10 * n) % 10_000;
    b.start();
    db.query(
      "INSERT INTO users (name, balance) VALUES (:name, :balance)",
      { name: names[n % names.length], balance: n },
    );
    b.stop();
  },
});

bench({
  name: "insert (positional)",
  runs: 10_000,
  func: (b): void => {
    n = (10 * n) % 10_000;
    b.start();
    db.query(
      "INSERT INTO users (name, balance) VALUES (?, ?)",
      [names[n % names.length], n],
    );
    b.stop();
  },
});

bench({
  name: "insert (prepared)",
  runs: 10_000,
  func: (b): void => {
    const query = db.prepareQuery(
      "INSERT INTO users (name, balance) VALUES (?, ?)",
    );
    b.start();
    for (let i = 0; i < 100; i++) {
      query.execute([names[n % names.length], n]);
    }
    b.stop();
    query.finalize();
  },
});

/** Performance of select statements (select + iterate 1000 rows). */
bench({
  name: "select",
  runs: 1000,
  func: (b): void => {
    b.start();
    for (
      const [_name, _balance] of db.query(
        "SELECT name, balance FROM users LIMIT 1000",
      )
    ) {
      continue;
    }
    b.stop();
  },
});

/** Performance when sorting rows (select and sort 1000 rows). */
bench({
  name: "order",
  runs: 100,
  func: (b): void => {
    b.start();
    for (
      const [_name, _balance] of db.query(
        "SELECT name, balance FROM users ORDER BY balance DESC LIMIT 1000",
      )
    ) {
      continue;
    }
    b.stop();
  },
});

/** Performance when sorting using random order. */
bench({
  name: "random",
  runs: 100,
  func: (b): void => {
    b.start();
    for (
      const [name, balance] of db.query(
        "SELECT name, balance FROM users ORDER BY RANDOM() LIMIT 1000",
      )
    ) {
      continue;
    }
    b.stop();
  },
});

runBenchmarks();
