import { Status } from "./constants.ts";

export default class SqliteError extends Error {
  /**
   * SqliteError
   *
   * Extension over the standard JS Error object
   * to also contain class members for error code
   * and error code name.
   *
   * This class is not exported by the module and
   * should only be obtained from exceptions raised
   * in this module.
   */
  constructor(message: string, code?: number) {
    super(message);
    this.name = "SqliteError";
    this.code = code ?? undefined;
  }

  /**
   * SqliteError.code
   *
   * The SQLite result status code,
   * see the SQLite docs for more
   * information about each code.
   *
   * https://www.sqlite.org/rescode.html
   *
   * Beyond the SQLite status codes, this member
   * can also contain custom status codes specific
   * to this library (starting from 1000).
   *
   * | JS name          | code | JS name (cont.)  | code |
   * |------------------|------|------------------|------|
   * | sqliteOk         | 0    | sqliteTooBig     | 18   |
   * | sqliteError      | 1    | sqliteConstraint | 19   |
   * | sqliteInternal   | 2    | sqliteMismatch   | 20   |
   * | sqlitePerm       | 3    | sqliteMisuse     | 21   |
   * | sqliteAbort      | 4    | sqliteNoLFS      | 22   |
   * | sqliteBusy       | 5    | sqliteAuth       | 23   |
   * | sqliteLocked     | 6    | sqlietFormat     | 24   |
   * | sqliteNoMem      | 7    | sqliteRange      | 25   |
   * | sqliteReadOnly   | 8    | sqliteNotADB     | 26   |
   * | sqliteInterrupt  | 9    | sqliteNotice     | 27   |
   * | sqliteIOErr      | 10   | sqliteWarning    | 28   |
   * | sqliteCorrupt    | 11   | sqliteRow        | 100  |
   * | sqliteNotFound   | 12   | sqliteDone       | 101  |
   * | sqliteFull       | 13   | stmtLimit        | 1000 |
   * | sqliteCantOpen   | 14   | noStmt           | 1001 |
   * | sqliteProtocol   | 15   | databaseLimit    | 1002 |
   * | sqliteEmpty      | 16   | noDatabase       | 1003 |
   * | sqliteSchema     | 17   |                  |      |
   *
   * These codes are accessible via
   * the exported `Status` object.
   */
  code?: number;

  /**
   * SqliteError.codeName
   *
   * Key of code in exported `status`
   * object.
   *
   * E.g. if `code` is `19`,
   * `codeName` would be `SqliteConstraint`.
   */
  get codeName(): string | undefined {
    return this.code ? Status[this.code] : undefined;
  }
}
