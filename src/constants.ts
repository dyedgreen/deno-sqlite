/**
 * Status codes which can be returned
 * by SQLite.
 *
 * Also see https://www.sqlite.org/rescode.html.
 */
export enum Status {
  /** Unknown status. */
  Unknown = -1,

  /** Successful result. */
  SqliteOk = 0,
  /** Generic error. */
  SqliteError = 1,
  /** Internal logic error in SQLite. */
  SqliteInternal = 2,
  /** Access permission denied. */
  SqlitePerm = 3,
  /** Callback routine requested an abort. */
  SqliteAbort = 4,
  /** The database file is locked. */
  SqliteBusy = 5,
  /** A table in the database is locked. */
  SqliteLocked = 6,
  /** A `malloc()` failed. */
  SqliteNoMem = 7,
  /** Attempt to write a read-only database. */
  SqliteReadOnly = 8,
  /** Operation terminated by `sqlite3_interrupt()`. */
  SqliteInterrupt = 9,
  /** Some kind of disk I/O error occurred. */
  SqliteIOErr = 10,
  /** The database disk image is malformed. */
  SqliteCorrupt = 11,
  /** Unknown opcode in `sqlite3_file_control()`. */
  SqliteNotFound = 12,
  /** Insertion failed because database is full. */
  SqliteFull = 13,
  /** Unable to open the database file. */
  SqliteCantOpen = 14,
  /** Database lock protocol error. */
  SqliteProtocol = 15,
  /** Internal use only. */
  SqliteEmpty = 16,
  /** The database schema changed. */
  SqliteSchema = 17,
  /** String or BLOB exceeds size limit. */
  SqliteTooBig = 18,
  /** Abort due to constraint violation. */
  SqliteConstraint = 19,
  /** Data type mismatch. */
  SqliteMismatch = 20,
  /** Library used incorrectly. */
  SqliteMisuse = 21,
  /** Uses OS features not supported on host. */
  SqliteNoLFS = 22,
  /** Authorization denied. */
  SqliteAuth = 23,
  /** Not used. */
  SqliteFormat = 24,
  /** 2nd parameter to `sqlite3_bind` out of range. */
  SqliteRange = 25,
  /** File opened that is not a database file. */
  SqliteNotADB = 26,
  /** Notifications from `sqlite3_log()`. */
  SqliteNotice = 27,
  /** Warnings from `sqlite3_log()`. */
  SqliteWarning = 28,
  /** `sqlite3_step()` has another row ready. */
  SqliteRow = 100,
  /** `sqlite3_step()` has finished executing. */
  SqliteDone = 101,
}

export enum OpenFlags {
  ReadOnly = 0x00000001,
  ReadWrite = 0x00000002,
  Create = 0x00000004,
  Uri = 0x00000040,
  Memory = 0x00000080,
}

export enum DeserializeFlags {
  FreeOnClose = 1,
  Resizeable = 2,
  ReadOnly = 4,
}

export enum FunctionFlags {
  Deterministic = 0x000000800,
  DirectOnly = 0x000080000,
}

export enum Types {
  Integer = 1,
  Float = 2,
  Text = 3,
  Blob = 4,
  Null = 5,
  BigInteger = 6,
}

export enum Values {
  Error = -1,
  Null = 0,
}
