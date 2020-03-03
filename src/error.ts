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
    this.code = code ?? Status.Unknown;
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
   * Errors that originate in the JavaScript part of
   * the library will not have an associated status
   * code. For these errors, the code will be
   * `Status.Unknown`.
   *
   * | JS name          | code | JS name (cont.)  | code |
   * |------------------|------|------------------|------|
   * | SqliteOk         | 0    | SqliteTooBig     | 18   |
   * | SqliteError      | 1    | SqliteConstraint | 19   |
   * | SqliteInternal   | 2    | SqliteMismatch   | 20   |
   * | SqlitePerm       | 3    | SqliteMisuse     | 21   |
   * | SqliteAbort      | 4    | SqliteNoLFS      | 22   |
   * | SqliteBusy       | 5    | SqliteAuth       | 23   |
   * | SqliteLocked     | 6    | sqlietFormat     | 24   |
   * | SqliteNoMem      | 7    | SqliteRange      | 25   |
   * | SqliteReadOnly   | 8    | SqliteNotADB     | 26   |
   * | SqliteInterrupt  | 9    | SqliteNotice     | 27   |
   * | SqliteIOErr      | 10   | SqliteWarning    | 28   |
   * | SqliteCorrupt    | 11   | SqliteRow        | 100  |
   * | SqliteNotFound   | 12   | SqliteDone       | 101  |
   * | SqliteFull       | 13   | StmtLimit        | 1000 |
   * | SqliteCantOpen   | 14   | NoStmt           | 1001 |
   * | SqliteProtocol   | 15   | DatabaseLimit    | 1002 |
   * | SqliteEmpty      | 16   | NoDatabase       | 1003 |
   * | SqliteSchema     | 17   | Unknown          | -1   |
   *
   * These codes are accessible via
   * the exported `Status` object.
   */
  code: number;

  /**
   * SqliteError.codeName
   *
   * Key of code in exported `status`
   * object.
   *
   * E.g. if `code` is `19`,
   * `codeName` would be `SqliteConstraint`.
   */
  get codeName(): keyof typeof Status {
    return Status[this.code] as keyof typeof Status;
  }
}
