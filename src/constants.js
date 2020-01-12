const status = Object.freeze({
  sqliteOk:          0,   // Successful result
  sqliteError:       1,   // Generic error
  sqliteInternal:    2,   // Internal logic error in SQLite
  sqlitePerm:        3,   // Access permission denied
  sqliteAbort:       4,   // Callback routine requested an abort
  sqliteBusy:        5,   // The database file is locked
  sqliteLocked:      6,   // A table in the database is locked
  sqliteNoMem:       7,   // A malloc() failed
  sqliteReadOnly:    8,   // Attempt to write a readonly database
  sqliteInterrupt:   9,   // Operation terminated by sqlite3_interrupt()
  sqliteIOErr:       10,  // Some kind of disk I/O error occurred
  sqliteCorrupt:     11,  // The database disk image is malformed
  sqliteNotFound:    12,  // Unknown opcode in sqlite3_file_control()
  sqliteFull:        13,  // Insertion failed because database is full
  sqliteCantOpen:    14,  // Unable to open the database file
  sqliteProtocol:    15,  // Database lock protocol error
  sqliteEmpty:       16,  // Internal use only
  sqliteSchema:      17,  // The database schema changed
  sqliteTooBig:      18,  // String or BLOB exceeds size limit
  sqliteConstraint:  19,  // Abort due to constraint violation
  sqliteMismatch:    20,  // Data type mismatch
  sqliteMisuse:      21,  // Library used incorrectly
  sqliteNoLFS:       22,  // Uses OS features not supported on host
  sqliteAuth:        23,  // Authorization denied
  sqlietFormat:      24,  // Not used
  sqliteRange:       25,  // 2nd parameter to sqlite3_bind out of range
  sqliteNotADB:      26,  // File opened that is not a database file
  sqliteNotice:      27,  // Notifications from sqlite3_log()
  sqliteWarning:     28,  // Warnings from sqlite3_log()
  sqliteRow:         100, // sqlite3_step() has another row ready
  sqliteDone:        101, // sqlite3_step() has finished executing

  stmtLimit:         1000, // Statement limit was reached: the statement registry is full, no more statements can be opened
  noStmt:            1001, // Registry entry at this id is empty
  databaseLimit:     1002, // Database limit was reached: the database registry is full, no more databases can be opened
  noDatabase:        1003, // Registry entry at this id is empty
});

const types = {
  integer: 1,
  float:   2,
  text:    3,
  blob:    4,
  null:    5,
};

const values = {
  error: -1,
};

export { status, types, values };
