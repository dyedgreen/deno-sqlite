import { status } from "./constants.js";

export default class SqliteError extends Error {
  /**
   * SqliteError
   *
   * Extension over the standard JS Error object
   * to also contain class members for error code
   * and error code name.
   */
  constructor(message, code) {
    super(message);
    this.name = "SqliteError";
    this.code = code ?? null;
  }

  /**
   * SqliteError.code
   *
   * The SQLite result error code,
   * see the SQLite docs for more
   * information about each error code.
   *
   * https://www.sqlite.org/rescode.html
   *
   * Beyond the SQLite error code, this member
   * can also contain custom error codes specific
   * to this library (starts at 1000).
   *
   * | JS name          | code |
   * |------------------|------|
   * | sqliteOk         | 0    |
   * | sqliteError      | 1    |
   * | sqliteInternal   | 2    |
   * | sqlitePerm       | 3    |
   * | sqliteAbort      | 4    |
   * | sqliteBusy       | 5    |
   * | sqliteLocked     | 6    |
   * | sqliteNoMem      | 7    |
   * | sqliteReadOnly   | 8    |
   * | sqliteInterrupt  | 9    |
   * | sqliteIOErr      | 10   |
   * | sqliteCorrupt    | 11   |
   * | sqliteNotFound   | 12   |
   * | sqliteFull       | 13   |
   * | sqliteCantOpen   | 14   |
   * | sqliteProtocol   | 15   |
   * | sqliteEmpty      | 16   |
   * | sqliteSchema     | 17   |
   * | sqliteTooBig     | 18   |
   * | sqliteConstraint | 19   |
   * | sqliteMismatch   | 20   |
   * | sqliteMisuse     | 21   |
   * | sqliteNoLFS      | 22   |
   * | sqliteAuth       | 23   |
   * | sqlietFormat     | 24   |
   * | sqliteRange      | 25   |
   * | sqliteNotADB     | 26   |
   * | sqliteNotice     | 27   |
   * | sqliteWarning    | 28   |
   * | sqliteRow        | 100  |
   * | sqliteDone       | 101  |
   * | stmtLimit        | 1000 |
   * | noStmt           | 1001 |
   * | databaseLimit    | 1002 |
   * | noDatabase       | 1003 |
   *
   * These codes are accessible via
   * the exported `status` object.
   */

  /**
   * SqliteError.codeName
   *
   * String representation
   * of the error code number.
   *
   * For example, if `code` is 19,
   * `codeName` would be sqliteConstraint.
   */
  get codeName() {
    return Object.keys(status).find(
      key => status[key] === this.code
    );
  }
}
