# SQLite for Deno Design

?> This is a draft.

?> Also see: [Building WebAssembly for Deno](https://tilman.xyz/blog/2019/12/building-webassembly-for-deno/)

The SQLite for Deno module uses a version of SQLite compiled to WebAssembly (WASM). This version
of SQLite is specifically tuned for the environment provided by WASM.

This document is intended for people who want to understand the internals of this module or
want to contribute to it. If you want to simply use the API, reading the [API docs](api.md) makes
more sense.

## Limitations
Since we don't have direct access to the file system from WASM, this module always provides an
in memory database. That means that if the application crashes before data has been written to
a file, the data is lost. Further, any journal files are only held in memory and lost on crash.

To be able to import the WASM module directly, the module is also completely self-sufficient and
does not make any imports. This means, however, that the debug build (which uses printf)
must be compiled with a different tool-chain (EMSCRIPTEN). This process is currently rather
rough around the edges.

## SQLite Custom VFS
To run within WASM, we provide a custom VirtualFileSystem component to SQLite. This VFS stores
files completely in memory and only supports a limited number of files with very limited file
paths. See `build/src/vfs.c`.

This custom VFS is more performant than for example the POSIX compliant in-memory file system
provided by EMSCRIPTEN (as it is much simpler and completely tuned to this use case). It also
allows us to emit a WASM file that can be directly imported,
which is much more efficient than encoding the binary into a JavaScript file.

## Wrapper Interface
The center piece of the WASM module is `build/src/wrapper.c`. Any functionality exported from the
module is here.

The wrapper aims to expose an API that makes it impossible to leak memory (outside of using malloc/
free directly, which is necessary to pass in strings/ BLOBs). Database handles are referenced by
their `entry_id`, which allows -- in principle -- to query if databases exist and close databases
without knowledge of which ones are allocated already.

This also means that resources like databases or prepared statements, are limited by the size of
their respective registries. These limits are set to be generous enough for correct use (i.e.
assuming unused resources are closed from the JavaScript side).

!> These limits are intentionally not advertised anywhere. Consumers of this API **must not** depend on
the exact limits and handle failures gracefully. The only guarantee given is that the limits are
bigger than 1 per resource.
