DENO ?= deno
EMCC ?= emcc

OUT = "sqlite.js"

CSRC  = $(shell find . -name "*.c")
FLGS  = -Wall
RFLG  = -Os
DFLG  = -DDEBUG_BUILD
JSFLG = -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=shell -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall']" -s FILESYSTEM=0
INCS  = -Ilib

# Configure sqlite for out use-case
SQLFLG = -DSQLITE_DQS=0 -DSQLITE_THREADSAFE=0 -DSQLITE_LIKE_DOESNT_MATCH_BLOBS\
         -DSQLITE_DEFAULT_FOREIGN_KEYS=1 -DSQLITE_TEMP_STORE=3 -DSQLITE_DISABLE_LFS\
         -DSQLITE_OMIT_DEPRECATED -DSQLITE_OMIT_UTF16 -DSQLITE_OMIT_SHARED_CACHE\
         -DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_OMIT_PROGRESS_CALLBACK -DSQLITE_OMIT_TRACE\
         -DSQLITE_OS_OTHER=1 -DSQLITE_OMIT_COMPLETE -DSQLITE_OMIT_WAL
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

all: release

build:
	$(EMCC) $(JSFLG) $(FLGS) $(INCS) $(CSRC) $(SQLFLG) -o $(OUT)
	$(DENO) --allow-read --allow-write hack/patch.js $(OUT)

debug: FLGS += $(DFLG)
debug: build

release: FLGS += $(RFLG)
release: build

.PHONY: build
