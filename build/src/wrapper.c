#include <stdlib.h>
#include <sqlite3.h>
#include "buffer.h"
#include "debug.h"

#define KEEPALIVE __attribute__((used)) __attribute__ ((visibility ("default")))

#define MAX_TRANSACTIONS 32
#define ERROR_VAL        -1

// Custom/ wrapper status codes
#define STATUS_TRANSACTION_LIMIT 1000
#define STATUS_NO_TRANSACTION    1001
#define STATUS_NO_DB             1002

#define GUARD_TRANSACTION(idx)   if (transactions[idx] == NULL) {          \
                                 debug_printf("transaction guard failed\n"); \
                                 last_status = STATUS_NO_TRANSACTION;      \
                                 return STATUS_NO_TRANSACTION; }

// Module state
sqlite3* db;
char* db_id = "_";

// Open transactions
sqlite3_stmt** transactions;
int open_transactions; // how many used
int last_transaction;  // last used entry

// Status returned by last instruction
int last_status;

int main() {
  debug_printf("transaction limit: %i\n", MAX_TRANSACTIONS);
}

// Read file buffer for given database id
char* KEEPALIVE get_db_file(int db_id) {
  buffer* b = get_reg_buffer(db_id);
  if (b == NULL) {
    last_status = STATUS_NO_DB;
    return NULL;
  }
  return b->bytes;
}
int KEEPALIVE get_db_file_size(int db_id) {
  buffer* b = get_reg_buffer(db_id);
  if (b == NULL) {
    last_status = STATUS_NO_DB;
    return 0;
  }
  return b->size;
}

// Grow buffer for database file. This can be used to write to
// the buffer.
int KEEPALIVE grow_db_file(int db_id, int size) {
  buffer* b = get_reg_buffer(db_id);
  if (b == NULL) {
    last_status = STATUS_NO_DB;
    return last_status;
  }
  last_status = grow_buffer(b, size) ? SQLITE_OK : SQLITE_NOMEM;
  return last_status;
}

// Initialize this module instance
int KEEPALIVE init() {
  // Allocate transaction list
  transactions = malloc(sizeof(sqlite3_stmt*) * MAX_TRANSACTIONS);
  for (int i = 0; i < MAX_TRANSACTIONS; i ++)
    transactions[i] = NULL;
  open_transactions = 0;
  last_transaction  = 0;

  // Initialize SQLite
  db_id[0] = 1;
  last_status = sqlite3_open(db_id, &db);
  debug_printf("initialized db, status: %i\n", last_status);
  return last_status;
}

// Return last status encountered. This combines
// SQLite status codes and wrapper error codes.
int KEEPALIVE get_status() {
  return last_status;
}

// Return most recent SQLite error as a string
const char* KEEPALIVE get_sqlite_error_str() {
  return sqlite3_errmsg(db);
}

// Wraps sqlite3_prepare
int KEEPALIVE prepare(const char* sql) {
  if (open_transactions >= MAX_TRANSACTIONS) {
    debug_printf("transaction limit exceeded\n");
    last_status = STATUS_TRANSACTION_LIMIT;
    return ERROR_VAL;
  }

  // Find next available transaction (this may fail)
  int guard = (last_transaction - 1 + MAX_TRANSACTIONS) % MAX_TRANSACTIONS;
  while (transactions[last_transaction] != NULL && last_transaction != guard)
    last_transaction = (last_transaction + 1) % MAX_TRANSACTIONS;
  // Check if the transaction is free to be used, this should always succeed
  if (transactions[last_transaction] != NULL) {
    debug_printf("no null transaction found, this should not happen, open_transactions value faulty\n");
    last_status = STATUS_TRANSACTION_LIMIT;
    return ERROR_VAL;
  }

  // last_transaction is now an empty slot

  last_status = sqlite3_prepare_v2(db, sql, -1, &transactions[last_transaction], NULL);
  if (last_status != SQLITE_OK) {
    debug_printf("sqlite3_prepare_v2 failed with status %i (%i open transactions)\n", last_status, open_transactions);
    transactions[last_transaction] = NULL;
    return ERROR_VAL;
  }

  open_transactions ++;
  debug_printf("prepared statement (%i open transactions)\n", open_transactions);
  return last_transaction;
}

// Destruct the given statement/ transaction. This will destruct the SQLite
// statement and free up it's transaction slot.
int KEEPALIVE finalize(int trans) {
  if (transactions[trans] == NULL)
    return SQLITE_OK;

  last_status = sqlite3_finalize(transactions[trans]);
  transactions[trans] = NULL;
  open_transactions --;
  debug_printf("finalized statement (status %i, %i open transactions)\n", last_status, open_transactions);
  return last_status;
}

// Finalize all statements
void KEEPALIVE finalize_all() {
  for (int trans = 0; trans < MAX_TRANSACTIONS; trans ++)
    finalize(trans);
}

// Wrappers for bind statements, these return the status directly
int KEEPALIVE bind_int(int trans, int idx, double value) {
  GUARD_TRANSACTION(trans);
  // we use double to pass in the value, as JS does not support 64 bit integers,
  // but handles floats and we can contain a 32 bit in in a 64 bit float, so there
  // should be no loss.
  last_status = sqlite3_bind_int64(transactions[trans], idx, (sqlite3_int64)value);
  debug_printf("binding int %lli (status %i)\n", (sqlite3_int64)value, last_status);
  return last_status;
}

int KEEPALIVE bind_double(int trans, int idx, double value) {
  GUARD_TRANSACTION(trans);
  last_status = sqlite3_bind_double(transactions[trans], idx, value);
  debug_printf("binding double %f (status %i)\n", value, last_status);
  return last_status;
}

int KEEPALIVE bind_text(int trans, int idx, const char* value) {
  GUARD_TRANSACTION(trans);
  // SQLite retrains the string until we execute the statement, but emscripten
  // frees any strings passed in when the function returns. Thus we need to mark
  // is as transient.
  last_status = sqlite3_bind_text(transactions[trans], idx, value, -1, SQLITE_TRANSIENT);
  debug_printf("binding text '%s' (status %i)\n", value, last_status);
  return last_status;
}

int KEEPALIVE bind_blob(int trans, int idx, void* value, int size) {
  GUARD_TRANSACTION(trans);
  // SQLite retrains the array until we execute the statement, but emscripten
  // frees any arrays passed in when the function returns. Thus we need to mark
  // is as transient.
  last_status = sqlite3_bind_blob(transactions[trans], idx, value, size, SQLITE_TRANSIENT);
  debug_printf("binding blob '%s' (status %i)\n", value, last_status);
  return last_status;
}

int KEEPALIVE bind_null(int trans, int idx) {
  GUARD_TRANSACTION(trans);
  last_status = sqlite3_bind_null(transactions[trans], idx);
  debug_printf("binding null (status %i)\n", last_status);
  return last_status;
}

// Wraps running statements, this returns the status directly
int KEEPALIVE step(int trans) {
  GUARD_TRANSACTION(trans);
  last_status = sqlite3_step(transactions[trans]);
  debug_printf("stepping transaction %i (status %i)\n", trans, last_status);
  return last_status;
}

// Count columns returned by statement. If the statement does not
// exist, ERROR_VAL is returned.
int KEEPALIVE column_count(int trans) {
  if (transactions[trans] == NULL) {
    debug_printf("column_count failed silently\n");
    return ERROR_VAL;
  }
  return sqlite3_column_count(transactions[trans]);
}

// Determine type of column. Returns SQLITE column types and SQLITE_NULL
// if the column does not exist.
int KEEPALIVE column_type(int trans, int col) {
  if (transactions[trans] == NULL) {
    debug_printf("column_type failed silently\n");
    return SQLITE_NULL;
  }
  return sqlite3_column_type(transactions[trans], col);
}

// Wrap result returning functions. These fail silently.
double KEEPALIVE column_int(int trans, int col) {
  if (transactions[trans] == NULL) {
    debug_printf("column_int failed silently\n");
    return 0.0;
  }
  return (double)sqlite3_column_int64(transactions[trans], col);
}

double KEEPALIVE column_double(int trans, int col) {
  if (transactions[trans] == NULL) {
    debug_printf("column_double failed silently\n");
    return 0.0;
  }
  return sqlite3_column_double(transactions[trans], col);
}

const char* KEEPALIVE column_text(int trans, int col) {
  if (transactions[trans] == NULL) {
    debug_printf("column_text failed silently\n");
    return "";
  }
  return (const char*)sqlite3_column_text(transactions[trans], col);
}

const void* KEEPALIVE column_blob(int trans, int col) {
  if (transactions[trans] == NULL) {
    debug_printf("column_blob failed silently\n");
    return NULL;
  }
  return sqlite3_column_blob(transactions[trans], col);
}

int KEEPALIVE column_bytes(int trans, int col) {
  if (transactions[trans] == NULL) {
    debug_printf("column_bytes failed silently\n");
    return 0;
  }
  return sqlite3_column_bytes(transactions[trans], col);
}
