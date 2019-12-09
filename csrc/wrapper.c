#include <stdlib.h>
#include <emscripten.h>
#include <sqlite3.h>
#include <debug.h>
#include <backup.h>

#define MAX_TRANSACTIONS 32
#define ERROR_VAL -1

// Custom status codes
#define STATUS_TRANSACTION_LIMIT 1000

// Module state
sqlite3* db;

// Open transactions
sqlite3_stmt** transactions;
int open_transactions; // how many used
int last_transaction; // last used entry

// Status returned by last instruction
int last_status;

int main() {
  debug_printf("transaction limit: %i\n", MAX_TRANSACTIONS);
}

// Initialize this module instance
int EMSCRIPTEN_KEEPALIVE init() {
  // Allocate transaction list
  transactions = malloc(sizeof(sqlite3_stmt*) * MAX_TRANSACTIONS);
  for (int i = 0; i < MAX_TRANSACTIONS; i ++)
    transactions[i] = NULL;
  open_transactions = 0;
  last_transaction  = 0;

  // Initialize SQLite
  last_status = sqlite3_open(":memory:", &db);
  debug_printf("initialized db, status: %i\n", last_status);
  return last_status;
}

// Return last status encountered. This combines
// SQLite status codes and wrapper error codes
int EMSCRIPTEN_KEEPALIVE get_status() {
  return last_status;
}

// Return most recent SQLite error as a string.
const char* EMSCRIPTEN_KEEPALIVE get_sqlite_error_str() {
  return sqlite3_errmsg(db);
}

// wraps sqlite3_prepare
int EMSCRIPTEN_KEEPALIVE prepare(const char* sql) {
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
  return last_transaction;
}
