#include <stdlib.h>
#include <stdbool.h>
#include "registry.h"

registry_entry** registry = NULL;

registry_entry* new_entry() {
  registry_entry* entry = malloc(sizeof(registry_entry));
  if (entry == NULL)
    return NULL;
  for (int i = 0; i < MAX_OPEN_STMTS; i ++)
    entry->stmts[i] = NULL;
  entry->used = 0;
  entry->last = 0;
  entry->sqlite = NULL;
  return entry;
}

#define VALID_REG_ID(id) (id >= 0 && id < DB_REG_SIZE)

// Obtain entry from registry at id. If the id is not
// in use or invalid, return NULL.
registry_entry* get_reg_entry(int entry_id) {
  if (!VALID_REG_ID(entry_id))
    return NULL;
  if (registry == NULL) {
    registry = malloc(sizeof(registry_entry*) * DB_REG_SIZE);
    if (registry == NULL)
      return NULL;
    for (int i = 0; i < DB_REG_SIZE; i ++)
      registry[i] = NULL;
  }
  return registry[entry_id];
}

// Claim an entry and return it's id. If no free
// entry exists or the entry can not be allocated,
// returns -1.
int claim_reg_entry() {
  // Search for empty registry id
  int entry_id;
  for (entry_id = 0; entry_id < DB_REG_SIZE; entry_id ++) {
    if (get_reg_entry(entry_id) == NULL) {
      registry[entry_id] = new_entry();
      return registry[entry_id] == NULL ? -1 : entry_id;
    }
  }
  return -1;
}

// Delete entry in registry.
void delete_reg_entry(int entry_id) {
  if (!VALID_REG_ID(entry_id))
    return;
  if (registry == NULL)
    return;
  if (registry[entry_id] != NULL) {
    free(registry[entry_id]);
    registry[entry_id] = NULL;
  }
}

// Working with ids and how they relate to buffer files
int valid_reg_entry_id(int entry_id) {
  return VALID_REG_ID(entry_id);
}
int buffer_for_reg_entry_id(int entry_id) {
  return entry_id * 2;
}
int id_for_reg_entry_path(const char* entry_path) {
  return entry_path[0] - 1; // add +1 to not use special char \0
}
char* path_bytes = "_";
const char* path_for_reg_entry_id(int entry_id) {
  path_bytes[0] = entry_id + 1;
  return path_bytes; // consecutive calls invalidate previously returned pointer
}

// Ensure id is within bounds
#define VALID_STMT_ID(id) (id >= 0 && id < MAX_OPEN_STMTS)

// Get statement stored in db registry.
sqlite3_stmt* get_reg_entry_stmt(int entry_id, int stmt_id) {
  if (!VALID_STMT_ID(stmt_id))
    return NULL;
  registry_entry* entry = get_reg_entry(entry_id);
  if (entry == NULL)
    return NULL;
  return entry->stmts[stmt_id];
}

// Store statement. If there is no space, -1 is returned,
// otherwise this returns the id assigned to the statement.
int add_reg_entry_stmt(int entry_id, sqlite3_stmt* stmt) {
  registry_entry* entry = get_reg_entry(entry_id);
  if (entry == NULL)
    return -1;

  // All statements are used
  if (entry->used == MAX_OPEN_STMTS)
    return -1;

  // Find next available statement slot (this may fail)
  int guard = (entry->last - 1 + MAX_OPEN_STMTS) % MAX_OPEN_STMTS;
  while (entry->stmts[entry->last] != NULL && entry->last != guard)
    entry->last = (entry->last + 1) % MAX_OPEN_STMTS;
  // Check if the transaction is free to be used *should* always succeed
  if (entry->stmts[entry->last] != NULL)
    return -1;

  // last_transaction is now an empty slot

  entry->stmts[entry->last] = stmt;
  entry->used ++;
  return entry->last;
}

// Release space taken by stmt at stmt_id.
void del_reg_entry_stmt(int entry_id, int stmt_id) {
  registry_entry* entry = get_reg_entry(entry_id);
  if (entry == NULL)
    return;

  // Delete statement pointer if in use
  if (entry->stmts[stmt_id] != NULL) {
    entry->stmts[stmt_id] = NULL;
    entry->used --;
    // TODO: Could set last here, to find empty stmt faster next time?
  }
}
