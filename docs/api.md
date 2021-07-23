# SQLite for Deno API Documentation

This file documents all of the public interfaces for
[deno-sqlite](https://github.com/dyedgreen/deno-sqlite). The documentation is
generated automatically using the `docs/generate.js` script. If you want to
clarify any of the notes in this file, edit the corresponding comment in the
source file and rerun the generator, to avoid loosing the changes.

## How to import

```javascript
import { DB, Empty, Status } from "https://deno.land/x/sqlite/mod.ts";
```

The above statement lists all the available imports.

## DB

```javascript
new DB(path = ":memory:", options = {});
```

Create a new database. The passed path will be opened with read/ write
permissions and created if it does not already exist.

The default opens an in-memory database.

### DB.query

```javascript
query(sql, values, QueryParam> | QueryParam[])
```

Run a query against the database. The query can contain placeholder parameters,
which are bound to the values passed in 'values'.

    db.query("SELECT name, email FROM users WHERE subscribed = ? AND list LIKE ?", [true, listName]);

This supports positional and named parameters. Positional parameters can be set
by passing an array for values. Named parameters can be set by passing an object
for values.

While they can be mixed in principle, this is not recommended.

| Parameter     | Values                  |
| ------------- | ----------------------- |
| `?NNN` or `?` | NNN-th value in array   |
| `:AAAA`       | value `AAAA` or `:AAAA` |
| `@AAAA`       | value `@AAAA`           |
| `$AAAA`       | value `$AAAA`           |

(see https://www.sqlite.org/lang_expr.html)

Values may only be of the following types and are converted as follows:

| JS in      | SQL type        | JS out           |
| ---------- | --------------- | ---------------- |
| number     | INTEGER or REAL | number or bigint |
| bigint     | INTEGER         | number or bigint |
| boolean    | INTEGER         | number           |
| string     | TEXT            | string           |
| Date       | TEXT            | string           |
| Uint8Array | BLOB            | Uint8Array       |
| null       | NULL            | null             |
| undefined  | NULL            | null             |

If no value is provided to a given parameter, SQLite will default to NULL.

If a `bigint` is bound, it is converted to a signed 64 big integer, which may
not be lossless. If an integer value is read from the database, which is too big
to safely be contained in a `number`, it is automatically returned as a
`bigint`.

If a `Date` is bound, it will be converted to an ISO 8601 string:
`YYYY-MM-DDTHH:MM:SS.SSSZ`. This format is understood by built-in SQLite
date-time functions. Also see https://sqlite.org/lang_datefunc.html.

This always returns an iterable Rows object. As a special case, if the query has
no rows to return this returns the Empty row (which is also iterable, but has
zero entries).

!> Any returned Rows object needs to be fully iterated over or discarded by
calling `.return()` or closing the iterator.

!> To prevent SQL injections, sql queries should never be obtained via string
interpolation. Instead, dynamic parameters should be bound using query
parameters:

    db.query("SELECT name FROM users WHERE id = ?", [id]); // GOOD
    db.query(`SELECT name FROM users WHERE id = ${id}`); // BAD: Potential SQL injection!

### DB.prepareQuery

```javascript
prepareQuery(sql);
```

This is similar to `query()`, with the difference that the returned function can
be called multiple times (with different values to bind each time).

Using a prepared query instead of `query()` will improve performance if the
query is issued a lot, e.g. when writing a web server, the queries used by the
server could be prepared once and then used through it's runtime.

A prepared query must be finalized when it is no longer in used by calling
`query.finalize()`. So the complete lifetime of a query would look like this:

    // once
    const query = db.prepareQuery("INSERT INTO messages (message, author) VALUES (?, ?)");
    // many times
    query([messageValueOne, authorValueOne]);
    query([messageValueTwo, authorValueTwo]);
    // ...
    // once
    query.finalize();

### DB.close

```javascript
close(force = false);
```

Close database handle. This must be called if DB is no longer used, to avoid
leaking file resources.

If force is specified, any on-going transactions will be closed.

### DB.lastInsertRowId

```javascript
get lastInsertRowId()
```

Get last inserted row id. This corresponds to the SQLite function
`sqlite3_last_insert_rowid`.

By default, it will return 0 if there is no row inserted yet.

### DB.changes

```javascript
get changes()
```

Return the number of rows modified, inserted or deleted by the most recently
completed query. This corresponds to the SQLite function `sqlite3_changes`.

### DB.totalChanges

```javascript
get totalChanges()
```

Return the number of rows modified, inserted or deleted since the database was
opened. This corresponds to the SQLite function `sqlite3_total_changes`.

## SqliteError

```javascript
new SqliteError(context, code);
```

Extension over the standard JS Error object to also contain class members for
error code and error code name.

This class is not exported by the module and should only be obtained from
exceptions raised in this module.

### SqliteError.code

The SQLite result status code, see the SQLite docs for more information about
each code.

https://www.sqlite.org/rescode.html

Beyond the SQLite status codes, this member can also contain custom status codes
specific to this library (starting from 1000).

Errors that originate in the JavaScript part of the library will not have an
associated status code. For these errors, the code will be `Status.Unknown`.

| JS name         | code | JS name (cont.)  | code |
| --------------- | ---- | ---------------- | ---- |
| SqliteOk        | 0    | SqliteEmpty      | 16   |
| SqliteError     | 1    | SqliteSchema     | 17   |
| SqliteInternal  | 2    | SqliteTooBig     | 18   |
| SqlitePerm      | 3    | SqliteConstraint | 19   |
| SqliteAbort     | 4    | SqliteMismatch   | 20   |
| SqliteBusy      | 5    | SqliteMisuse     | 21   |
| SqliteLocked    | 6    | SqliteNoLFS      | 22   |
| SqliteNoMem     | 7    | SqliteAuth       | 23   |
| SqliteReadOnly  | 8    | SqliteFormat     | 24   |
| SqliteInterrupt | 9    | SqliteRange      | 25   |
| SqliteIOErr     | 10   | SqliteNotADB     | 26   |
| SqliteCorrupt   | 11   | SqliteNotice     | 27   |
| SqliteNotFound  | 12   | SqliteWarning    | 28   |
| SqliteFull      | 13   | SqliteRow        | 100  |
| SqliteCantOpen  | 14   | SqliteDone       | 101  |
| SqliteProtocol  | 15   | Unknown          | -1   |

These codes are accessible via the exported `Status` object.

### SqliteError.codeName

```javascript
get codeName()
```

Key of code in exported `status` object.

E.g. if `code` is `19`, `codeName` would be `SqliteConstraint`.

## RowObjects

```javascript
new RowObjects(rows);
```

RowObjects represent a set of results from a query in the form of an object.
They are iterable and yield objects.

This class is not exported from the module and the only correct way to obtain a
`RowObjects` object is by making a database query and using the `asObject()`
method on the `Rows` result.

### RowObjects.return

```javascript
return()
```

Implements the closing iterator protocol. See also:
https://exploringjs.com/es6/ch_iteration.html#sec_closing-iterators

### RowObjects.next

```javascript
next();
```

Implements the iterator protocol.

## Rows

```javascript
new Rows(wasm, stmt, cleanup);
```

Rows represent a set of results from a query. They are iterable and yield arrays
with the data from the selected columns.

This class is not exported from the module and the only correct way to obtain a
`Rows` object is by making a database query.

### Rows.return

```javascript
return()
```

Implements the closing iterator protocol. See also:
https://exploringjs.com/es6/ch_iteration.html#sec_closing-iterators

### Rows.done

```javascript
done();
```

Deprecated, prefer `Rows.return`.

### Rows.next

```javascript
next();
```

Implements the iterator protocol.

### Rows.columns

```javascript
columns();
```

Call this if you need column names from the result of a select query.

This method returns an array of objects, where each object has the following
properties:

| Property     | Value                                      |
| ------------ | ------------------------------------------ |
| `name`       | the result of `sqlite3_column_name`        |
| `originName` | the result of `sqlite3_column_origin_name` |
| `tableName`  | the result of `sqlite3_column_table_name`  |

### Rows.asObjects

```javascript
asObjects();
```

Call this if you need to ouput the rows as objects.

    const rows = [...db.query("SELECT name FROM users;").asObjects()];

## Empty

A special constant. This is a `Rows` object which has no results. It is still
iterable, however it won't yield any results.

`Empty` is returned from queries which return no data.
