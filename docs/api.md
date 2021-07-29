# SQLite for Deno API Documentation

This file documents all of the public interfaces for
[deno-sqlite](https://github.com/dyedgreen/deno-sqlite). The documentation is
generated automatically using the `docs/generate.js` script. If you want to
clarify any of the notes in this file, edit the corresponding comment in the
source file and rerun the generator, to avoid loosing the changes.

## How to import

```javascript
import { DB, Status } from "https://deno.land/x/sqlite/mod.ts";
```

The above statement lists all the available imports.

## Status codes which can be returned

Also see https://www.sqlite.org/rescode.html.

## Options for opening a database

undefined

### Options for opening a database.

The `mode` can be set to control how the database file will be opened.

If `memory` is set to true, the database will be opened as an in memory
database.

If `uri` is set to true, the file name accepts a URI. See
https://sqlite.org/uri.html for more information on the URI format.

## Create a new database

undefined

### Create a new database. The file at the

```javascript
new Create a new database(path = ":memory:", options = {})
```

mode specified in options. The default mode is `create`.

If no path is given, or if the `memory` option is set, the database is opened in
memory.

## Query the database and return all matching

This is equivalent to calling `all` on a prepared query which is then
immediately finalized.

The type parameter `R` may be supplied by the user to indicated the type for the
rows returned by the query. Notice that the user is responsible for ensuring the
correctness of the supplied type.

To avoid SQL injection, user-provided values should always be passed to the
database through a query parameter.

See `QueryParameterSet` for documentation on how values can be bound to SQL
statements.

See `QueryParameter` for documentation on how values are returned from the
database.

## Prepares the given SQL query, so that it

with different parameters.

If a query will be issued a lot, this is more efficient than using `query`. A
prepared query also provides more control over how the query is run, as well as
access to meta-data about the issued query.

The returned `PreparedQuery` object must be finalized by calling its `finalize`
method once it is no longer needed.

The type parameter `R` may be supplied by the user to indicated the type for the
rows returned by the query. Notice that the user is responsible for ensuring the
correctness of the supplied type.

## Close the database

undefined

### Close the database. This must be called if

```javascript
close(force = false);
```

open file descriptors.

If force is specified, any active `PreparedQuery` will be finalized. Otherwise,
this throws if there are active queries.

`close` may safely be called multiple times.

## Get last inserted row id

undefined

### Get last inserted row id. This corresponds to

```javascript
get lastInsertRowId()
```

Before a row is inserted for the first time (since the database was opened),
this returns `0`.

## Return the number of rows modified, inserted or

```javascript
get totalChanges()
```

This corresponds to the SQLite function `sqlite3_total_changes`.

## Extension over the standard JS Error object

```javascript
new Extension over the standard JS Error object(context, code)
```

and error code name.

Instances of this class should not be constructed directly and should only be
obtained from exceptions raised in this module.

## The SQLite status code which caused this error

undefined

### The SQLite status code which caused this error.

Errors that originate in the JavaScript part of the library will not have an
associated status code. For these errors, the code will be `Status.Unknown`.

These codes are accessible via the exported `Status` object.

## Key of code in exported `status`

```javascript
get codeName()
```

E.g. if `code` is `19`, `codeName` would be `SqliteConstraint`.

## The default type for returned rows

undefined

### The default type for returned rows.

## Possible parameter values to be bound to a query

undefined

### Possible parameter values to be bound to a query.

When values are bound to a query, they are converted between JavaScript and
SQLite types in the following way:

| JS type in | SQL type        | JS type out      |
| ---------- | --------------- | ---------------- |
| number     | INTEGER or REAL | number or bigint |
| bigint     | INTEGER         | number or bigint |
| boolean    | INTEGER         | number           |
| string     | TEXT            | string           |
| Date       | TEXT            | string           |
| Uint8Array | BLOB            | Uint8Array       |
| null       | NULL            | null             |
| undefined  | NULL            | null             |

If no value is provided for a given parameter, SQLite will default to NULL.

If a `bigint` is bound, it is converted to a signed 64 bit integer, which may
overflow.

If an integer value is read from the database, which is too big to safely be
contained in a `number`, it is automatically returned as a `bigint`.

If a `Date` is bound, it will be converted to an ISO 8601 string:
`YYYY-MM-DDTHH:MM:SS.SSSZ`. This format is understood by built-in SQLite
date-time functions. Also see https://sqlite.org/lang_datefunc.html.

## A set of query parameters

undefined

### A set of query parameters.

When a query is constructed, it can contain either positional or named
parameters. For more information see
https://www.sqlite.org/lang_expr.html#parameters.

A set of parameters can be passed to a query method either as an array of
parameters (in positional order), or as an object which maps parameter names to
their values:

| SQL Parameter | QueryParameterSet       |
| ------------- | ----------------------- |
| `?NNN` or `?` | NNN-th value in array   |
| `:AAAA`       | value `AAAA` or `:AAAA` |
| `@AAAA`       | value `@AAAA`           |
| `$AAAA`       | value `$AAAA`           |

See `QueryParameter` for documentation on how values are converted between SQL
and JavaScript types.

## Name of a column in a database query

undefined

### Name of a column in a database query.

## A prepared query which can be executed many

```javascript
new A prepared query which can be executed many(
    wasm,
    stmt,
    openStatements,
  )
```

The constructor should never be used directly. Instead a prepared query can be
obtained by calling `DB.prepareQuery`.

## Binds the given parameters to the query

```javascript
all(params);
```

rows.

Calling `all` invalidates any iterators previously returned by calls to `iter`.
Using an invalidated iterator is a bug.

To avoid SQL injection, user-provided values should always be passed to the
database through a query parameter.

See `QueryParameterSet` for documentation on how values can be bound to SQL
statements.

See `QueryParameter` for documentation on how values are returned from the
database.

## @ignore

```javascript
next();
```

Implements the iterator protocol. It is a bug to call this method directly.

## Binds the given parameters to the query and

```javascript
execute(params);
```

might be returned.

Using this method is more efficient when the rows returned by a query are not
needed or the query does not return any rows.

Calling `execute` invalidates any iterators previously returned by calls to
`iter`. Using an invalidated iterator is a bug.

To avoid SQL injection, user-provided values should always be passed to the
database through a query parameter.

See `QueryParameterSet` for documentation on how values can be bound to SQL
statements.

## Closes the prepared query

undefined

### Closes the prepared query. This must be

```javascript
finalize();
```

to avoid leaking resources.

After a prepared query has been finalized, trying to call `iter`, `all`, `one`,
`execute`, or `columns`, or using iterators which where previously obtained from
the finalized query is a bug.

`finalize` may safely be called multiple times.

## Returns the column names for the query

```javascript
columns();
```

This method returns an array of objects, where each object has the following
properties:

| Property     | Value                                      |
| ------------ | ------------------------------------------ |
| `name`       | the result of `sqlite3_column_name`        |
| `originName` | the result of `sqlite3_column_origin_name` |
| `tableName`  | the result of `sqlite3_column_table_name`  |
