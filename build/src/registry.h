#ifndef DB_REG_H
#define DB_REG_H

#include <sqlite3.h>
#include "buffer.h"

#define DB_REG_SIZE    (BUFFER_REG_SIZE/2)
#define MAX_OPEN_STMTS 32

typedef struct registry_entry {
  sqlite3*      sqlite;
  sqlite3_stmt* stmts[MAX_OPEN_STMTS];
  int           used; // how many statements are used
  int           last; // last used statements entry
} registry_entry;

// Obtain registry entries
registry_entry* get_reg_entry(int entry_id);
int             claim_reg_entry();
void            delete_reg_entry(int entry_id);

// Working with ids and how they relate to buffer files
int         valid_reg_entry_id(int entry_id);
int         buffer_for_reg_entry_id(int entry_id);
int         id_for_reg_entry_path(const char* entry_path);
const char* path_for_reg_entry_id(int entry_id);

// Work with transactions
sqlite3_stmt* get_reg_entry_stmt(int entry_id, int stmt_id);
int           add_reg_entry_stmt(int entry_id, sqlite3_stmt* stmt);
void          del_reg_entry_stmt(int entry_id, int stmt_id);

#endif // DB_REG_H
