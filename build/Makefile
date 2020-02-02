DENO ?= deno
EMCC ?= emcc
WASI ?=
CC    = $(WASI)/bin/clang

ifeq ($(WASI),)
$(warning To build release target you need to specify a WASI root)
endif

OUT_JS = "debug.js"
OUT_WA = "sqlite.wasm"

SQLITE_DLD = "https://sqlite.org/2020/sqlite-src-3310100.zip"
SQLITE_DIR = "sqlite-src-3310100"

CSRC  = ""
CSRC += $(shell find ./src  -name "*.c")
CSRC += $(shell find ./lib  -name "*.c")
CSRC += $(shell find ./hask -name "*.c")
FLGS  = -Wall
RFLG  = -Os
DFLG  = -DDEBUG_BUILD
JSFLG = -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=shell -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall']" -s FILESYSTEM=0
WAFLG = --target=wasm32-unknown-wasi -Wl,--no-entry -nostartfiles --sysroot $(WASI)/share/wasi-sysroot\
        -DWASI_BUILD -Wl,--export,malloc -Wl,--export,free
INCS  = -Ilib

# Configure sqlite for out use-case
SQLFLG = -DSQLITE_DQS=0 -DSQLITE_THREADSAFE=0 -DSQLITE_LIKE_DOESNT_MATCH_BLOBS\
         -DSQLITE_DEFAULT_FOREIGN_KEYS=1 -DSQLITE_TEMP_STORE=3 -DSQLITE_DISABLE_LFS\
         -DSQLITE_OMIT_DEPRECATED -DSQLITE_OMIT_UTF16 -DSQLITE_OMIT_SHARED_CACHE\
         -DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_OMIT_PROGRESS_CALLBACK -DSQLITE_OMIT_TRACE\
         -DSQLITE_OS_OTHER=1 -DSQLITE_OMIT_COMPLETE -DSQLITE_OMIT_WAL -DSQLITE_OMIT_ATTACH\
         -DNDEBUG=1 -DSQLITE_ENABLE_COLUMN_METADATA
# Rational:
# SQLITE_DQS -> we do not need to have backwards comp
# SQLITE_THREADSAFE -> we run single-threaded
# SQLITE_LIKE_DOESNT_MATCH_BLOBS -> faster (is recommended if no backwards comp)
# SQLITE_DEFAULT_FOREIGN_KEYS -> this should be the default
# SQLITE_TEMP_STORE -> fs is in-memory, no need for extra indirection
# SQLITE_DISABLE_LFS -> all our files are in memory anyways
# SQLITE_OMIT_DEPRECATED -> we do not need to have backwards comp
# SQLITE_OMIT_UTF16 -> we only support utf-8 encoded strings
# SQLITE_OMIT_SHARED_CACHE -> we only ever open one connection
# SQLITE_OMIT_LOAD_EXTENSION -> we don't use it
# SQLITE_OMIT_PROGRESS_CALLBACK -> we don't use it
# SQLITE_OMIT_TRACE -> we make no use of these
# SQLITE_OS_OTHER -> we provide our own vfs
# SQLITE_OMIT_COMPLETE -> we don't need these
# SQLITE_OMIT_WAL -> we don't use it
# SQLITE_OMIT_ATTACH -> attach to file will not work as expected with provided VFS
# DNDEBUG -> "use for maximum speed"
# SQLITE_ENABLE_COLUMN_METADATA -> we depend on column metadata interfaces (`sqlite3_column_table_name` and `sqlite3_column_origin_name`)

all: release

build:
	$(CC) $(WAFLG) $(FLGS) $(INCS) $(CSRC) $(SQLFLG) -o $(OUT_WA)
	$(DENO) --allow-read --allow-write hack/patch.js $(OUT_WA)

emscripten:
	$(EMCC) $(JSFLG) $(FLGS) $(INCS) $(CSRC) $(SQLFLG) -o $(OUT_JS)
	$(DENO) --allow-read --allow-write hack/patch.js $(OUT_JS)

debug: FLGS += $(DFLG)
debug: emscripten

release: FLGS += $(RFLG)
release: build

# Helpers for generating new amalgamation files
# if needed (i.e. if build flags for SQLite change)
download:
	curl "$(SQLITE_DLD)" -o "sqlite_dl.zip"
	shasum -c ".checksums"
	rm -rf "sqlite-src"
	unzip "sqlite_dl.zip"
	mv $(SQLITE_DIR) "sqlite-src"
	cp "Makefile.sqlite" "sqlite-src/Makefile"
	rm "sqlite_dl.zip"

amalgamation:
	make -C sqlite-src clean
	make -C sqlite-src sqlite3.c SQLFLG="$(SQLFLG)"
	mv sqlite-src/sqlite3.c lib/sqlite3.c
	mv sqlite-src/sqlite3.h lib/sqlite3.h

.PHONY: build amalgamation download
