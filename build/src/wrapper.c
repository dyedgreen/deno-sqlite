#include <stdlib.h>
#include <sqlite3.h>
#include <pcg.h>
#include "buffer.h"
#include "registry.h"
#include "debug.h"

#define KEEPALIVE __attribute__((used)) __attribute__ ((visibility ("default")))
#define ERROR_VAL -1

// Custom/ wrapper status codes
#define STATUS_STMT_LIMIT 1000
#define STATUS_NO_STMT    1001
#define STATUS_DB_LIMIT   1002
#define STATUS_NO_DB      1003

// Status returned by last instruction
int last_status = SQLITE_OK;

// Helper needed to read strings from C
int KEEPALIVE str_len(const char* str) {
  int len;
  for (len = 0; str[len] != '\0'; len ++);
  return len;
}

// Seed the random number generator. We pass a double, to
// get as many bytes from the JS number as possible.
void KEEPALIVE seed_rng(double seed) {
  pcg_seed((uint64_t)seed);
}

// Return last status encountered. This combines
// SQLite status codes and wrapper error codes.
int KEEPALIVE get_status() {
  return last_status;
}

// Reserve a database entry. Returns the entry_id on
// success of ERROR_VAL.
int KEEPALIVE reserve() {
  int entry_id = claim_reg_entry();
  if (entry_id == -1) {
    debug_printf("could not obtain free registry entry\n");
    last_status = STATUS_DB_LIMIT;
    return ERROR_VAL;
  }
  return entry_id;
}

// Initialize a database and return the status. If
// this fails, the entry_id is freed up.
int KEEPALIVE init(entry_id) {
  registry_entry* entry = get_reg_entry(entry_id);
  if (entry == NULL || entry->sqlite != NULL) {
    last_status = STATUS_NO_DB;
    return last_status;
  }

  // Open SQLite db connection
  last_status = sqlite3_open(path_for_reg_entry_id(entry_id), &(entry->sqlite));
  if (last_status != SQLITE_OK) {
    debug_printf("failed to open database with status %i\n", last_status);
    delete_reg_entry(entry_id);
    return last_status;
  }
  debug_printf("opened database using registry %i\n", entry_id);
  return last_status;
}

// Attempt to close given database connection.
int KEEPALIVE close(int entry_id) {
  registry_entry* entry = get_reg_entry(entry_id);
  if (entry == NULL) {
    last_status = STATUS_NO_DB;
    return last_status;
  }

  last_status = sqlite3_close(entry->sqlite);
  if (last_status == SQLITE_OK) {
    // Delete associated file buffers
    delete_reg_buffer(buffer_for_reg_entry_id(entry_id));
    delete_reg_buffer(buffer_for_reg_entry_id(entry_id) + 1);
    // Delete registry entry
    delete_reg_entry(entry_id);
  }
  return last_status;
}

// Return most recent SQLite error as a string
const char* KEEPALIVE get_sqlite_error_str(int entry_id) {
  registry_entry* entry = get_reg_entry(entry_id);
  if (entry == NULL || entry->sqlite == NULL)
    return "database missing";
  return sqlite3_errmsg(entry->sqlite);
}

// Read file buffer for given database entry_id
char* KEEPALIVE get_db_file(int entry_id) {
  buffer* b = get_reg_buffer(buffer_for_reg_entry_id(entry_id));
  if (b == NULL) {
    last_status = STATUS_NO_DB;
    return NULL;
  }
  return b->bytes;
}
int KEEPALIVE get_db_file_size(int entry_id) {
  buffer* b = get_reg_buffer(buffer_for_reg_entry_id(entry_id));
  if (b == NULL) {
    last_status = STATUS_NO_DB;
    return 0;
  }
  return b->size;
}

// Grow buffer for database file. This can be used to write to
// the buffer.
int KEEPALIVE grow_db_file(int entry_id, int size) {
  buffer* b = get_reg_buffer(buffer_for_reg_entry_id(entry_id));
  if (b == NULL) {
    last_status = STATUS_NO_DB;
    return last_status;
  }
  last_status = grow_buffer(b, size) ? SQLITE_OK : SQLITE_NOMEM;
  return last_status;
}

// Wraps sqlite3_prepare. Returns statement id.
int KEEPALIVE prepare(int entry_id, const char* sql) {
  registry_entry* entry = get_reg_entry(entry_id);
  if (entry == NULL) {
    last_status = STATUS_NO_DB;
    return ERROR_VAL;
  }

  // Prepare sqlite statement
  sqlite3_stmt* stmt;
  last_status = sqlite3_prepare_v2(entry->sqlite, sql, -1, &stmt, NULL);
  debug_printf("prepared sql statement (entry: %i, status: %i, used: %i)\n", entry_id, last_status, entry->used);
  if (last_status != SQLITE_OK)
    return ERROR_VAL;

  // Store statement handle in registry
  int stmt_id = add_reg_entry_stmt(entry_id, stmt);
  if (stmt_id == -1) {
    debug_printf("no space in statement list\n");
    sqlite3_finalize(stmt);
    last_status = STATUS_STMT_LIMIT;
    return ERROR_VAL;
  }

  return stmt_id;
}

// Helper used to obtain statement or return status code
// after this, stmt exists and is a valid sqlite3_stmt*
#define GUARD_STMT(entry_id, stmt_id) \
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id); \
  if (stmt == NULL) { \
    debug_printf("statement does not exist(entry %i, stmt %i)\n", entry_id, stmt_id); \
    last_status = STATUS_NO_STMT; \
    return last_status; \
  }

// Destruct the given statement/ transaction. This will destruct the SQLite
// statement and free up it's transaction slot. Regardless of returned
// status, the statement id will be freed up.
int KEEPALIVE finalize(int entry_id, int stmt_id) {
  GUARD_STMT(entry_id, stmt_id);
  last_status = sqlite3_finalize(stmt);
  del_reg_entry_stmt(entry_id, stmt_id);
  debug_printf("finalized statement (status %i)\n", last_status);
  return last_status;
}

// Wrappers for bind statements, these return the status directly
int KEEPALIVE bind_int(int entry_id, int stmt_id, int idx, double value) {
  GUARD_STMT(entry_id, stmt_id);
  // we use double to pass in the value, as JS does not support 64 bit integers,
  // but handles floats and we can contain a 32 bit in in a 64 bit float, so there
  // should be no loss.
  last_status = sqlite3_bind_int64(stmt, idx, (sqlite3_int64)value);
  debug_printf("binding int %lli (status %i)\n", (sqlite3_int64)value, last_status);
  return last_status;
}

int KEEPALIVE bind_double(int entry_id, int stmt_id, int idx, double value) {
  GUARD_STMT(entry_id, stmt_id);
  last_status = sqlite3_bind_double(stmt, idx, value);
  debug_printf("binding double %f (status %i)\n", value, last_status);
  return last_status;
}

int KEEPALIVE bind_text(int entry_id, int stmt_id, int idx, const char* value) {
  GUARD_STMT(entry_id, stmt_id);
  // SQLite retrains the string until we execute the statement, but any strings
  // passed in from JS are freed when the function returns. Thus we need to mark
  // is as transient.
  last_status = sqlite3_bind_text(stmt, idx, value, -1, SQLITE_TRANSIENT);
  debug_printf("binding text '%s' (status %i)\n", value, last_status);
  return last_status;
}

int KEEPALIVE bind_blob(int entry_id, int stmt_id, int idx, void* value, int size) {
  GUARD_STMT(entry_id, stmt_id);
  // SQLite retrains the pointer until we execute the statement, but any pointers
  // passed in from JS are freed when the function returns. Thus we need to mark
  // is as transient.
  last_status = sqlite3_bind_blob(stmt, idx, value, size, SQLITE_TRANSIENT);
  debug_printf("binding blob '%s' (status %i)\n", value, last_status);
  return last_status;
}

int KEEPALIVE bind_null(int entry_id, int stmt_id, int idx) {
  GUARD_STMT(entry_id, stmt_id);
  last_status = sqlite3_bind_null(stmt, idx);
  debug_printf("binding null (status %i)\n", last_status);
  return last_status;
}

// Determine parameter index for named parameters
int KEEPALIVE bind_parameter_index(int entry_id, int stmt_id, const char* name) {
  // Can't use guard as we don't return a status
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("statement for parameter does not exist\n");
    return ERROR_VAL;
  }
  int index = sqlite3_bind_parameter_index(stmt, name);
  if (index == 0) {
    debug_printf("parameter '%s' does not exist", name);
    // Normalize SQLite returning 0 for not found to ERROR_VAL
    return ERROR_VAL;
  }
  debug_printf("obtained parameter index (param '%s', index %i)\n", name, index);
  return index;
}

// Wraps running statements, this returns the status directly
int KEEPALIVE step(int entry_id, int stmt_id) {
  GUARD_STMT(entry_id, stmt_id);
  last_status = sqlite3_step(stmt);
  debug_printf("stepping statement (entry %i, stmt %i, status %i)\n", entry_id, stmt_id, last_status);
  return last_status;
}

// Count columns returned by statement. If the statement does not
// exist, 0 is returned.
int KEEPALIVE column_count(int entry_id, int stmt_id) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_count failed silently\n");
    return 0;
  }
  return sqlite3_column_count(stmt);
}

// Determine type of column. Returns SQLITE column types and SQLITE_NULL
// if the column does not exist.
int KEEPALIVE column_type(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_type failed silently\n");
    return SQLITE_NULL;
  }
  return sqlite3_column_type(stmt, col);
}

// Wrap result returning functions. These fail silently.
double KEEPALIVE column_int(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_int failed silently\n");
    return 0;
  }
  return (double)sqlite3_column_int64(stmt, col);
}

double KEEPALIVE column_double(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_double failed silently\n");
    return 0;
  }
  return sqlite3_column_double(stmt, col);
}

const char* KEEPALIVE column_text(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_text failed silently\n");
    return "";
  }
  return (const char*)sqlite3_column_text(stmt, col);
}

const void* KEEPALIVE column_blob(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_blob failed silently\n");
    return NULL;
  }
  return sqlite3_column_blob(stmt, col);
}

int KEEPALIVE column_bytes(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_bytes failed silently\n");
    return 0;
  }
  return sqlite3_column_bytes(stmt, col);
}

const char* KEEPALIVE column_name(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_name failed silently\n");
    return "";
  }
  return sqlite3_column_name(stmt, col);
}

const char* KEEPALIVE column_origin_name(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_origin_name failed silently\n");
    return "";
  }
  return sqlite3_column_origin_name(stmt, col);
}

const char* KEEPALIVE column_table_name(int entry_id, int stmt_id, int col) {
  sqlite3_stmt* stmt = get_reg_entry_stmt(entry_id, stmt_id);
  if (stmt == NULL) {
    debug_printf("column_table_name failed silently\n");
    return "";
  }
  return sqlite3_column_table_name(stmt, col);
}
