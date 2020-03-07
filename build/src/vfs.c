#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <sqlite3.h>
#include <pcg.h>
#include "buffer.h"
#include "registry.h"
#include "debug.h"

// SQLite VFS component.
// Based on demoVFS from SQLlite.

// File-names simply index into the open_files array
// TODO: Can I disable journaling? (and will it be a problem?)
//       (problem: journal wants file-length+8 available ...)
//       (see: sqlite.c line 55809)
#define MAXPATHNAME (1+8)

#define TEMP_PATH -1
#define ID_FROM_PATH(path) buffer_reg_id_from_path(path)

// Global variable that contains current time
// this can be passed in by queries to enable time
// apis to work correctly.
// This should not be used once WASI makes it obsolete.
double global_wasi_current_time = 0;

// Determine buffer registry id from file path. We store files
// like follows: id=0 -> DB, id=1 -> journal for DB1, ...
int buffer_reg_id_from_path(const char* path) {
  int entry_id = id_for_reg_entry_path(path);
  int id = buffer_for_reg_entry_id(entry_id);
  // Check if this is a journal file
  if (path[1] != '\0')
    id += 1;
  return id;
}

/*
** When using this VFS, the sqlite3_file* handles that SQLite uses are
** actually pointers to instances of type WasiFile.
*/
typedef struct WasiFile WasiFile;
struct WasiFile {
  sqlite3_file base;
  int id;
  buffer* buf;
};

// For permanent files, this is a no-op. For temp
// files this deallocates the buffer.
static int wasiClose(sqlite3_file *pFile) {
  WasiFile* p = (WasiFile*)pFile;
  if (p->id == TEMP_PATH)
    destroy_buffer(p->buf);
  debug_printf("closed buffer with file id: %i\n", (int)p->id);
  return SQLITE_OK;
}

// Read data from a file.
static int wasiRead(sqlite3_file *pFile, void *zBuf, int iAmt, sqlite_int64 iOfst) {
  WasiFile *p = (WasiFile*)pFile;

  // Read bytes from buffer
  int read_bytes = read_buffer(p->buf, (char* )zBuf, (int)iOfst, iAmt);
  debug_printf("attempt to read from file (id: %i, amount: %i, offset: %i, bytes: %i)\n",
    p->id, iAmt, (int)iOfst, read_bytes);

  // Zero memory if read was short
  if (read_bytes < iAmt)
    memset(&((char*)zBuf)[iOfst+read_bytes], 0, iAmt-read_bytes);

  return read_bytes < iAmt ? SQLITE_IOERR_SHORT_READ : SQLITE_OK;
}

// Write data to a file.
static int wasiWrite(sqlite3_file *pFile, const void *zBuf, int iAmt, sqlite_int64 iOfst) {
  WasiFile *p = (WasiFile*)pFile;

  // Write bytes to buffer
  int write_bytes = write_buffer(p->buf, (char* )zBuf, (int)iOfst, iAmt);
  debug_printf("attempt to write to file (id: %i, amount: %i, offset: %i, bytes: %i)\n",
    p->id, iAmt, (int)iOfst, write_bytes);

  return write_bytes == iAmt ? SQLITE_OK : SQLITE_IOERR_WRITE;
}

// We do not implement this. TODO: Should we?
static int wasiTruncate(sqlite3_file *pFile, sqlite_int64 size) {
  return SQLITE_OK;
}

// We are completely in-memory.
static int wasiSync(sqlite3_file *pFile, int flags) {
  return SQLITE_OK;
}

// Write the size of the file in bytes to *pSize.
static int wasiFileSize(sqlite3_file *pFile, sqlite_int64 *pSize) {
  WasiFile *p = (WasiFile*)pFile;
  *pSize = (sqlite_int64)p->buf->size;
  debug_printf("read file size: %i (id: %i)\n", p->buf->size, p->id);
  return SQLITE_OK;
}

// We do not support nor need files locks.
static int wasiLock(sqlite3_file *pFile, int eLock) {
  return SQLITE_OK;
}
static int wasiUnlock(sqlite3_file *pFile, int eLock) {
  return SQLITE_OK;
}
static int wasiCheckReservedLock(sqlite3_file *pFile, int *pResOut) {
  *pResOut = 0;
  return SQLITE_OK;
}

// No xFileControl() verbs are implemented by this VFS.
static int wasiFileControl(sqlite3_file *pFile, int op, void *pArg) {
  return SQLITE_NOTFOUND;
}

// We are in-memory.
static int wasiSectorSize(sqlite3_file *pFile) {
  return 0;
}
static int wasiDeviceCharacteristics(sqlite3_file *pFile) {
  return 0;
}

// Open a file handle.
static int wasiOpen(
  sqlite3_vfs *pVfs,              /* VFS */
  const char *zName,              /* File to open, or 0 for a temp file */
  sqlite3_file *pFile,            /* Pointer to WasiFile struct to populate */
  int flags,                      /* Input SQLITE_OPEN_XXX flags */
  int *pOutFlags                  /* Output SQLITE_OPEN_XXX flags (or NULL) */
) {
  static const sqlite3_io_methods wasiio = {
    1,                            /* iVersion */
    wasiClose,                    /* xClose */
    wasiRead,                     /* xRead */
    wasiWrite,                    /* xWrite */
    wasiTruncate,                 /* xTruncate */
    wasiSync,                     /* xSync */
    wasiFileSize,                 /* xFileSize */
    wasiLock,                     /* xLock */
    wasiUnlock,                   /* xUnlock */
    wasiCheckReservedLock,        /* xCheckReservedLock */
    wasiFileControl,              /* xFileControl */
    wasiSectorSize,               /* xSectorSize */
    wasiDeviceCharacteristics     /* xDeviceCharacteristics */
  };

  WasiFile *p = (WasiFile*)pFile;
  p->base.pMethods = &wasiio;

  if (zName == NULL) {
    p->id = TEMP_PATH;
    p->buf = new_buffer();
  } else {
    p->id = ID_FROM_PATH(zName);
    p->buf = get_reg_buffer(ID_FROM_PATH(zName));
  }

  debug_printf("opening buffer with file id: %i\n", p->id);
  debug_printf("file path name: '%s'\n", zName);
  debug_printf("buffer address: %p\n", p->buf);
  return p->buf != NULL ? SQLITE_OK : SQLITE_CANTOPEN;
}

// Delete the file at the path.
static int wasiDelete(sqlite3_vfs *pVfs, const char *zPath, int dirSync) {
  delete_reg_buffer(ID_FROM_PATH(zPath));
  return SQLITE_OK;
}

// All valid id files are accessible.
static int wasiAccess(sqlite3_vfs *pVfs, const char *zPath, int flags, int *pResOut) {
  switch (flags) {
    case SQLITE_ACCESS_EXISTS:
      *pResOut = in_use_reg_buffer_id(ID_FROM_PATH(zPath));
      break;
    default:
      *pResOut = valid_reg_buffer_id(ID_FROM_PATH(zPath));
      break;
  }
  debug_printf("determining file access (id: %i, access %i)\n", ID_FROM_PATH(zPath), *pResOut);
  return SQLITE_OK;
}

// This just copies the data, as file names are all one character long.
static int wasiFullPathname(sqlite3_vfs *pVfs, const char *zPath, int nPathOut, char *zPathOut) {
  if (nPathOut >= 3) {
    zPathOut[0] = zPath[0];
    zPathOut[1] = zPath[1]; // To preserve journal file flag
    zPathOut[2] = '\0';
    debug_printf("converted '%s' to full path '%s' (id: %i)\n", zPath, zPathOut, ID_FROM_PATH(zPath));
    return SQLITE_OK;
  }
  return SQLITE_CANTOPEN;
}

/*
** The following four VFS methods:
**
**   xDlOpen
**   xDlError
**   xDlSym
**   xDlClose
**
** are supposed to implement the functionality needed by SQLite to load
** extensions compiled as shared objects. This simple VFS does not support
** this functionality, so the following functions are no-ops.
*/
static void *wasiDlOpen(sqlite3_vfs *pVfs, const char *zPath) {
  return 0;
}
static void wasiDlError(sqlite3_vfs *pVfs, int nByte, char *zErrMsg) {
  sqlite3_snprintf(nByte, zErrMsg, "Loadable extensions are not supported");
  zErrMsg[nByte-1] = '\0';
}
static void (*wasiDlSym(sqlite3_vfs *pVfs, void *pH, const char *z))(void) {
  return 0;
}
static void wasiDlClose(sqlite3_vfs *pVfs, void *pHandle) {
  return;
}

// Generate pseudo-random data
static int wasiRandomness(sqlite3_vfs *pVfs, int nByte, char *zByte) {
  pcg_bytes(zByte, nByte);
  return SQLITE_OK;
}

// TODO: Can anything be done here? Possibly if we get proper WASI support?
static int wasiSleep(sqlite3_vfs *pVfs, int nMicro) {
  return 0;
}

// TODO: This should be done properly once WASI is more mature.
static int wasiCurrentTime(sqlite3_vfs *pVfs, double *pTime) {
  *pTime = global_wasi_current_time;
  return SQLITE_OK;
}

// This function returns a pointer to the VFS implemented in this file.
sqlite3_vfs *sqlite3_wasivfs(void) {
  static sqlite3_vfs wasivfs = {
    3,                            /* iVersion */
    sizeof(WasiFile),             /* szOsFile */
    MAXPATHNAME,                  /* mxPathname */
    0,                            /* pNext */
    "wasi",                       /* zName */
    0,                            /* pAppData */
    wasiOpen,                     /* xOpen */
    wasiDelete,                   /* xDelete */
    wasiAccess,                   /* xAccess */
    wasiFullPathname,             /* xFullPathname */
    wasiDlOpen,                   /* xDlOpen */
    wasiDlError,                  /* xDlError */
    wasiDlSym,                    /* xDlSym */
    wasiDlClose,                  /* xDlClose */
    wasiRandomness,               /* xRandomness */
    wasiSleep,                    /* xSleep */
    wasiCurrentTime,              /* xCurrentTime */
    0,                            /* xGetLastError */
    0                   ,         /* xCurrentTimeInt64 */
    0,                            /* xSetSystemCall */
    0,                            /* xGetSystemCall */
    0,                            /* xNextSystemCall */
  };
  return &wasivfs;
}

int sqlite3_os_init(void) {
  debug_printf("running sqlite3_os_init\n");
  // Register VFS
  return sqlite3_vfs_register(sqlite3_wasivfs(), 1);
}

int sqlite3_os_end(void) {
  return SQLITE_OK;
}
