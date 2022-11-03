import {
  assertEquals,
  assertInstanceOf,
  assertThrows,
} from "https://deno.land/std@0.154.0/testing/asserts.ts";

import { DB, SqlFunctionArgument, SqliteError, Status } from "../mod.ts";

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

Deno.test("specify function names", function () {
  const db = new DB();

  // name can be inferred from function
  const nameOne = () => "one";
  db.createFunction(nameOne);
  assertEquals([["one"]], db.query("SELECT nameOne()"));
  db.deleteFunction("nameOne");
  assertThrows(() => db.deleteFunction("nameOne"));

  const nameTwo = function () {
    return "two";
  };
  db.createFunction(nameTwo);
  assertEquals([["two"]], db.query("SELECT nameOne()"));
  db.deleteFunction("nameTwo");
  assertThrows(() => db.deleteFunction("nameTwo"));

  const whatsTheName = function namedHere() {
    return "three";
  };
  db.createFunction(whatsTheName);
  assertEquals([["three"]], db.query("SELECT namedHere()"));
  db.deleteFunction("namedHere");
  assertThrows(() => db.deleteFunction("namedHere"));

  // override the name
  const someFunc = () => "overridden";
  db.createFunction(someFunc, { name: "helloWorld" });
  assertEquals([["overridden"]], db.query("SELECT helloWorld()"));
  db.deleteFunction("helloWorld");
  assertThrows(() => db.deleteFunction("namedHere"));

  // empty name is incorrect
  assertThrows(() => db.createFunction(function (/* anonymous */) {}));
  assertThrows(() => db.createFunction(function namedBut() {}, { name: "" }));
});

Deno.test("can't define the same function twice", function () {
  const db = new DB();
  const test = () => {};
  db.createFunction(test);
  assertThrows(() => db.createFunction(test), (err: Error) => {
    assertInstanceOf(err, SqliteError);
    assertEquals(err.code, Status.Unknown);
    assertEquals(err.message, "A function named 'test' already exists");
  });
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

Deno.test("can have multiple functions at the same time", function () {
  const first = () => 1;
  const second = () => 2;
  const db = new DB();
  db.createFunction(first);
  db.createFunction(second);
  assertEquals([[1, 2]], db.query("SELECT first(), second()"));
  db.deleteFunction("first");
  assertEquals([[2]], db.query("SELECT second()"));
  assertThrows(() => db.query("SELECT first()"));
});

Deno.test("expects correct argument count", function () {
  const one = (first: number) => first;
  const three = (first: number, second: number, third: number) =>
    first + second + third;
  const db = new DB();
  db.createFunction(one);
  db.createFunction(three);
  assertEquals([[1, 6]], db.query("SELECT one(1), three(1,2,3)"));
  assertThrows(() => db.query("SELECT one()"));
  assertThrows(() => db.query("SELECT one(1,2,3)"));
  assertThrows(() => db.query("SELECT one(1,2)"));
  assertThrows(() => db.query("SELECT one(1,2,3,4)"));
});

Deno.test("variadic functions", function () {
  const count = (...args: Array<unknown>) => args.length;
  const db = new DB();
  db.createFunction(count);
  assertEquals(
    [[1, 2, 3, 4, 5]],
    db.query(
      "SELECT count(1), count(1, 2), count(1,2,3), count(1,2,3,4), count(1,2,3,4,5)",
    ),
  );
});

function roundTripValues(values: Array<SqlFunctionArgument>): Array<unknown> {
  const identity = (x: SqlFunctionArgument) => x;
  const db = new DB();
  db.createFunction(identity);
  return values.map((value) => db.query("SELECT identity(?)", [value])[0][0]);
}

Deno.test("accept and return string values", function () {
  const values = ["Hello World!", "I love Deno.", "Täst strüng...", "你好"];
  assertEquals(values, roundTripValues(values));
});

Deno.test("accept and return integer values", function () {
  const values = [0, 42, 1, 2, 3, 4, 3453246, 4536787093, 45536787093];
  assertEquals(values, roundTripValues(values));
});

Deno.test("accept and return float values", function () {
  const values = [42.1, 1.235, 2.999, 1 / 3, 4.2345, 345.3246, 4536787.953e-8];
  assertEquals(values, roundTripValues(values));
});

Deno.test("accept and return boolean values", function () {
  assertEquals([1, 0], roundTripValues([true, false]));
});

Deno.test("accept and return null values", function () {
  assertEquals([null], roundTripValues([null]));
});

Deno.test("accept and return blob values", function () {
  const values = [
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
    new Uint8Array([3, 57, 45]),
  ];
  assertEquals(values, roundTripValues(values));
});

Deno.test("accept and return bigint values", function () {
  assertEquals(
    [9007199254741991n, -9007199254741991n, 100],
    roundTripValues([9007199254741991n, -9007199254741991n, 100n]),
  );
});

Deno.test("return void returns NULL", function () {
  const empty = () => {};
  const db = new DB();
  db.createFunction(empty);
  assertEquals([[null]], db.query("SELECT empty()"));
});

Deno.test("return undefined returns NULL", function () {
  const nothing = (shouldReturnNull: boolean) =>
    shouldReturnNull ? null : undefined;
  const db = new DB();
  db.createFunction(nothing, { name: "undefined" });
  assertEquals(
    [[null, null]],
    db.query("SELECT undefined(FALSE), undefined(TRUE)"),
  );
});

Deno.test("return date returns formatted string", function () {
  const unix = (unix: number) => new Date(unix);
  const db = new DB();
  db.createFunction(unix);
  assertEquals([[
    "1970-01-01T00:00:00.000Z",
    "1970-01-01T00:00:00.042Z",
    "2022-11-03T10:37:19.931Z",
  ]], db.query("SELECT unix(0), unix(42), unix(1667471839931)"));
});
