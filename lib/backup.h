#ifndef BACKUP_H
#define BACKUP_H

#include <sqlite3.h>

// DB load and backup functions based on
// https://www.sqlite.org/backup.html.

// Used to handle DB loading and backups

int load_db(sqlite3* db, const char* file);
int save_db(sqlite3* db, const char* file);

// TODO:
// Currently, everything is on-threaded.
// maybe it makes sense to have two threads,
// one of which stores copies of the DB?
// Another alternatively, look into using the
// exposed emscripten file-system stuff.

#endif // DEBUG_H
