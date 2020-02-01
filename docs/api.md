# SQLite for Deno API Documentation

This file documents all of the public interfaces for [deno-sqlite](https://github.com/dyedgreen/deno-sqlite).
The documentation is generated automatically using the `docs/generate.js` script. If you want to
clarify any of the notes in this file, edit the corresponding comment in the source file and
rerun the generator, to avoid loosing the changes.


## How to import
```javascript
import { open, save, DB, Empty, status } from "https://deno.land/x/sqlite/mod.ts"
```
The above statement lists all the available imports.


## open
```javascript
async function open(path, ignoreNotFound=true)
```
Open a new SQLite3 database. The file at
the path is read and preloaded into the database.

?> Unlike the SQLite3 C library, this will not
automatically write any changes to disk. Use
`db.data()` or `save(db)` to persist any changes
you make.


## save
```javascript
async function save(db, path)
```
Save database to file. If the database was opened
from a file using `open()`, the second parameter
is optional.


## DB
```javascript
new DB(data)
```
Create a new database. If a `Uint8Array`
is provided as the first argument the
database is pre-loaded with the array as the
database file. If no arguments are provided
a new in-memory database is opened.

The Uint8Array could be obtained from
`db.data()`, or by reading a database
file written by SQLite.

### DB.query
```javascript
query(sql, values)
```
Run a query against the database. The query
can contain placeholder parameters, which
are bound to the values passed in 'values'.

    db.query("SELECT name, email FROM users WHERE subscribed = ? AND list LIKE ?", [true, listName]);

This supports positional and named parameters.
Positional parameters can be set by passing an
array for values. Named parameters can be set
by passing an object for values.

While they can be mixed in principle, this is
not recommended.

| Parameter     | Values                  |
|---------------|-------------------------|
| `?NNN` or `?` | NNN-th value in array   |
| `:AAAA`       | value `AAAA` or `:AAAA` |
| `@AAAA`       | value `@AAAA`           |
| `$AAAA`       | value `$AAAA`           |

(see https://www.sqlite.org/lang_expr.html)

Values may only be of the following
types and are converted as follows:

| JS in      | SQL type        | JS out     |
|------------|-----------------|------------|
| number     | INTEGER or REAL | number     |
| boolean    | INTEGER         | number     |
| string     | TEXT            | string     |
| Uint8Array | BLOB            | Uint8Array |
| null       | NULL            | null       |
| undefined  | NULL            | null       |

If no value is provided to a given parameter,
SQLite will default to NULL.

This always returns an iterable Rows object.
As a special case, if the query has no rows
to return this returns the Empty row (which
is also iterable, but has zero entries).

!> Any returned Rows object needs to be fully
iterated over or discarded by calling
`.done()`.

### DB.data
```javascript
data()
```
Return SQLite file as a `Uint8Array`. This
makes a copy of the data. To save the data
to a file prefer to use `save()` exported by
`mod.ts`, which avoids making a copy.

?> Making a copy of a database could be done like
this: `const copy = new DB(original.data());`

### DB.close
```javascript
close()
```
Close database handle. This must be called if
DB is no longer used.

!> Not closing the database may cause you to
encounter the limit for open database
connections.


## SqliteError
```javascript
new SqliteError(message, code)
```
Extension over the standard JS Error object
to also contain class members for error code
and error code name.

This class is not exported by the module and
should only be obtained from exceptions raised
in this module.

### SqliteError.code

The SQLite result status code,
see the SQLite docs for more
information about each code.

https://www.sqlite.org/rescode.html

Beyond the SQLite status codes, this member
can also contain custom status codes specific
to this library (starting from 1000).

| JS name          | code | JS name (cont.)  | code |
|------------------|------|------------------|------|
| sqliteOk         | 0    | sqliteTooBig     | 18   |
| sqliteError      | 1    | sqliteConstraint | 19   |
| sqliteInternal   | 2    | sqliteMismatch   | 20   |
| sqlitePerm       | 3    | sqliteMisuse     | 21   |
| sqliteAbort      | 4    | sqliteNoLFS      | 22   |
| sqliteBusy       | 5    | sqliteAuth       | 23   |
| sqliteLocked     | 6    | sqlietFormat     | 24   |
| sqliteNoMem      | 7    | sqliteRange      | 25   |
| sqliteReadOnly   | 8    | sqliteNotADB     | 26   |
| sqliteInterrupt  | 9    | sqliteNotice     | 27   |
| sqliteIOErr      | 10   | sqliteWarning    | 28   |
| sqliteCorrupt    | 11   | sqliteRow        | 100  |
| sqliteNotFound   | 12   | sqliteDone       | 101  |
| sqliteFull       | 13   | stmtLimit        | 1000 |
| sqliteCantOpen   | 14   | noStmt           | 1001 |
| sqliteProtocol   | 15   | databaseLimit    | 1002 |
| sqliteEmpty      | 16   | noDatabase       | 1003 |
| sqliteSchema     | 17   |                  |      |

These codes are accessible via
the exported `status` object.

### SqliteError.codeName
```javascript
get codeName()
```
Key of code in exported `status`
object.

E.g. if `code` is `19`,
`codeName` would be `sqliteConstraint`.


## Rows
```javascript
new Rows(db, id)
```
Rows represent a set of results from a query.
They are iterable and yield arrays with
the data from the selected columns.

This class is not exported from the module
and the only correct way to obtain a `Rows`
object is by making a database query.

### Rows.done
```javascript
done()
```
Call this if you are done with the
query and have not iterated over all
the available results.

!> If you leave rows with results before
making new queries, you may run into the
maximum limit for concurrent queries.
Always use `.done()` instead of `break`.

    const rows = db.query("SELECT name FROM users;");
    for (const [name] of rows) {
      if (name === "Clark Kent")
        rows.done();
    }

### Rows.columns
```javascript
columns()
```
Call this if you need column names from the result of a select query.

This method returns an array of objects, where each object has the following properties:

| Property     | Value                                      |
|--------------|--------------------------------------------|
| `name`       | the result of `sqlite3_column_name`        |
| `originName` | the result of `sqlite3_column_origin_name` |
| `tableName`  | the result of `sqlite3_column_table_name`  |


## Empty

A special constant. This is a `Rows` object
which has no results. It is still iterable,
however it won't yield any results.

`Empty` is returned from queries which return
no data.
