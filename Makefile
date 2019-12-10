DENO ?= deno
EMCC ?= emcc

OUT = "sqlite.js"

CSRC  = $(shell find . -name "*.c")
FLGS  = -Wall
RFLG  = -Os
DFLG  = -DDEBUG_BUILD
JSFLG = -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=shell -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall']"
INCS  = -Ilib -Icsrc

# Configure sqlite for out use-case
SQLFLG = -DSQLITE_DQS=0 -DSQLITE_THREADSAFE=0 -DSQLITE_LIKE_DOESNT_MATCH_BLOBS\
         -DSQLITE_DEFAULT_FOREIGN_KEYS=1 -DSQLITE_TEMP_STORE=3
# Rational:
# SQLITE_DQS -> we do not need to have backwards comp
# SQLITE_THREADSAFE -> we run single-threaded
# SQLITE_LIKE_DOESNT_MATCH_BLOBS -> faster (is recommended if no backwards comp)
# SQLITE_DEFAULT_FOREIGN_KEYS -> this should be the default
# SQLITE_TEMP_STORE -> emscripten fs is in-memory, no need for extra indirection

all: build

build:
	$(EMCC) $(JSFLG) $(FLGS) $(INCS) $(CSRC) $(SQLFLG) -o $(OUT)
	$(DENO) --allow-read --allow-write hack/patch.js $(OUT)

debug: FLGS += $(DFLG)
debug: build

release: FLGS += $(RFLG)
release: build

.PHONY: build
