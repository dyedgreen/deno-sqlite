#ifndef IMPORTS_H
#define IMPORTS_H

// WASM imports specified in vfs.syms

extern void   js_print(const char*);
extern int    js_open(const char*, int);
extern void   js_close(int);
extern void   js_delete(const char*);
extern int    js_read(int, const char*, int, int);
extern int    js_write(int, const char*, int, int);
extern void   js_truncate(int, int);
extern int    js_size(int);
extern double js_time();
extern int    js_exists(const char*);
extern int    js_access(const char*);

#endif // DEBUG_H
