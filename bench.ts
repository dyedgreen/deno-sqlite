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
const names = "Deno Land Peter Parker Clark Kent Robert Parr".split(" ");

bench({
  name: "insert (named)",
  runs: 10,
  func: (b): void => {
    b.start();
    const query = db.prepareQuery(
      "INSERT INTO users (name, balance) VALUES (:name, :balance)",
    );
    db.query("begin");
    for (let i = 0; i < 10_000; i++) {
      query.execute({ name: names[i % names.length], balance: i });
    }
    db.query("commit");
    b.stop();
  },
});

bench({
  name: "insert (positional)",
  runs: 10,
  func: (b): void => {
    b.start();
    const query = db.prepareQuery(
      "INSERT INTO users (name, balance) VALUES (?, ?)",
    );
    db.query("begin");
    for (let i = 0; i < 10_000; i++) {
      query.execute([names[i % names.length], i]);
    }
    db.query("commit");
    b.stop();
  },
});

/** Performance of select statements (select all; 10_000). */
bench({
  name: "select",
  runs: 10,
  func: (b): void => {
    b.start();
    db.query(
      "SELECT name, balance FROM users LIMIT 10000",
    );
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
