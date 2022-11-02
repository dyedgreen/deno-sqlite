import {
  assertEquals,
  assertInstanceOf,
  assertThrows,
} from "https://deno.land/std@0.154.0/testing/asserts.ts";

import { DB, SqliteError, Status } from "../mod.ts";

Deno.test("can create scalar functions", function () {
  const db = new DB();
  const double = (num: number) => num * 2;
  db.createFunction(double, { deterministic: true });
  assertEquals(42, double(21));
  assertEquals([[42]], db.query("SELECT double(21)"));
});

Deno.test("can delete scalar functions", function () {
  const db = new DB();
  const answer = () => 42;
  db.createFunction(answer);
  assertEquals([[42]], db.query("SELECT answer()"));
  db.deleteFunction("answer");
  assertThrows(() => db.query("SELECT answer()"));
  assertThrows(() => db.deleteFunction("answer"));
});

Deno.test("can throw errors in user defined functions", function () {
  const db = new DB();
  const error = (message: string) => {
    throw new Error(message);
  };
  db.createFunction(error);
  assertThrows(() => error("Boom!"), (err: Error) => {
    assertInstanceOf(err, Error);
    assertEquals(err.message, "Boom!");
  });
  assertThrows(() => db.query("SELECT error('Boom!')"), (err: Error) => {
    assertInstanceOf(err, SqliteError);
    assertEquals(err.code, Status.SqliteError);
    assertEquals(err.message, "Error in user defined function 'error': Boom!");
  });
});
