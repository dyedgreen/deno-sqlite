#ifndef IMPORTS_H
#define IMPORTS_H

// WASM imports specified in vfs.syms

extern void   js_print(const char* text);
extern int    js_open(const char* path, int mode, int flags);
extern void   js_close(int rid);
extern void   js_delete(const char* path);
extern int    js_read(int rid, const char* buffer, double offset, int amount);
extern int    js_write(int rid, const char* buffer, double offset, int amount);
extern void   js_truncate(int rid, double size);
extern void   js_sync(int rid);
extern double js_size(int rid);
extern void   js_lock(int rid, int exclusive);
extern void   js_unlock(int rid);
extern double js_time();
extern int    js_timezone();
extern int    js_exists(const char* path);
extern int    js_access(const char* path);
extern void   js_call_user_func(int func, int argc);

#endif // DEBUG_H
