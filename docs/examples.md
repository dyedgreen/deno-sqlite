# SQLite for Deno Examples

Examples of how to use the SQLite module. Contributions are welcome!


## Opening and Saving Database Files

Database Files can be opened and saved like this:
```javascript
import { open, save } from "https://deno.land/x/sqlite/mod.ts";

const db =  await open("test.db");

// do something with db

await save(db);
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

const names = [...db.query("SELECT name FROM people")].map([name] => name);
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

db.query("INSERT INTO people (name, email) VALUES (?, ?)", name, email);
```

!> Always bind user provided data and don't use string interpolation to avoid
[SQL injection](https://en.wikipedia.org/wiki/SQL_injection).

?> Queries like `INSERT INTO` don't return any rows. For these queries `.done()`
is called automatically.

## Copying a Database

You can copy a whole database in memory.
```javascript
const copy = new DB(original.data());
```

?> This is an in-memory copy.
