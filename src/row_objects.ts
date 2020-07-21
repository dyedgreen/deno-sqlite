import { Rows, Empty, ColumnName } from "./rows.ts";

export class RowObjects<T extends any = Record<string, any>> {
  private _rows: Rows;
  private _columns?: ColumnName[];
  private _done = false;

  /**
   * RowObjects
   *
   * RowObjects represent a set of results 
   * from a query in the form of an object.
   * They are iterable and yield objects.
   *
   * This class is not exported from the module
   * and the only correct way to obtain a `RowObjects`
   * object is by making a database query
   * and using the `asObject()` method on the `Rows` result.
   */
  constructor(rows: Rows) {
    this._rows = rows;

    if (rows === Empty) {
      this._done = true;
    } else {
      this._columns = this._rows.columns();
    }
  }

  /**
   * RowObjects.return
   *
   * Implements the closing iterator
   * protocol. See also:
   * https://exploringjs.com/es6/ch_iteration.html#sec_closing-iterators
   */
  return(): IteratorResult<T> {
    this._done = true;
    return this._rows.return();
  }

  /**
   * RowObjects.next
   *
   * Implements the iterator protocol.
   */
  next(): IteratorResult<T> {
    if (this._done) return this._rows.return();

    const row = this._rows.next();

    if (row.done) return this._rows.return();

    const rowAsObject: any = {};

    for (let i = 0; i < row.value.length; i++) {
      rowAsObject[this._columns![i].name] = row.value[i];
    }

    return { value: rowAsObject, done: false };
  }

  [Symbol.iterator]() {
    return this;
  }
}
