# SQLite for Deno Examples

Examples of how to use the SQLite module. Contributions are welcome!


## Opening and Saving Database Files

Database Files can be opened by constructing a new `DB` object. Any transactions run against the
database are automatically saved to disk.
```javascript
import { DB } from "https://deno.land/x/sqlite/mod.ts";

const db = new DB("test.db");

// do something with db

db.close();
```


## Accessing Query Results

Rows selected from a table can be iterated over. You can also use the `...` syntax
to quickly collect them into an array.
```javascript
// somehow obtain a db

for (const [id, name, email] of db.query("SELECT id, name, email FROM people")) {
  // do something with the rows entries
}

const names = [...db.query("SELECT name FROM people")].map(([name]) => name);
// do something with names
```

?> If you iterate the rows fully, using `for ... of` or the `...` syntax,
`.done()` is called automatically!


## Binding Values to Queries

You can easily bind values from variables into your queries.
```javascript
// somehow obtain a db

const name = "Peter Parker";
const email = "peter.parker@deno.land";

db.query("INSERT INTO people (name, email) VALUES (?, ?)", [name, email]);
```

!> Always bind user provided data and don't use string interpolation to avoid
[SQL injection](https://en.wikipedia.org/wiki/SQL_injection).

?> Queries like `INSERT INTO` don't return any rows. For these queries `.done()`
is called automatically.

?> You can bind `Date`s and `Uint8Array`s directly. The wrapper will automatically
convert them to the appropriate SQLite data types.


## Named Query Parameters

SQLite supports named query parameters. Use them like this:
```javascript
// somehow obtain a db

const name = "Peter Parker";
const email = "peter.parker@deno.land";

db.query("INSERT INTO people (name, email) VALUES (:name, :email)", { name, email });
```

?> Using named parameters can make your code more readable.


## Error handling

`DB.query` will throw an exception on failure.

```javascript
try {
  db.query("NOT A QUERY");
} catch (error) {
  console.log(error.message);
  console.log(error.code);
  console.log(error.codeName);
}
```
