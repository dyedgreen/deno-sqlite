import { getStr } from "../src/wasm.ts";

const isWindows = Deno.build.os === "windows";

const OPEN_FILES = new Map();

function nextRid() {
  const rid = (nextRid?.LAST_RID ?? 0) + 1;
  nextRid.LAST_RID = rid;
  return rid;
}

function getOpenFile(rid) {
  if (!OPEN_FILES.has(rid)) {
    throw new Error(`Resource ID ${rid} does not exist.`);
  }
  return OPEN_FILES.get(rid);
}

// Closure to return an environment that links
// the current wasm context
export default function env(inst) {
  // Exported environment
  const env = {
    // Print a string pointer to console
    js_print: (str_ptr) => {
      const text = getStr(inst.exports, str_ptr);
      console.log(text[text.length - 1] === "\n" ? text.slice(0, -1) : text);
    },
    // Open the file at path, mode = 0 is open RW, mode = 1 is open TEMP
    js_open: (path_ptr, mode, flags) => {
      let path;
      switch (mode) {
        case 0:
          path = getStr(inst.exports, path_ptr);
          break;
        case 1:
          path = Deno.makeTempFileSync({ prefix: "deno_sqlite" });
          break;
      }

      const write = !!(flags & 0x00000002);
      const create = !!(flags & 0x00000004);
      const file = Deno.openSync(path, { read: true, write, create });
      const rid = nextRid();
      OPEN_FILES.set(rid, file);
      return rid;
    },
    // Close a file
    js_close: (rid) => {
      const file = getOpenFile(rid);
      file.close();
      OPEN_FILES.delete(rid);
    },
    // Delete file at path
    js_delete: (path_ptr) => {
      const path = getStr(inst.exports, path_ptr);
      Deno.removeSync(path);
    },
    // Read from a file to a buffer in the module
    js_read: (rid, buffer_ptr, offset, amount) => {
      const buffer = new Uint8Array(
        inst.exports.memory.buffer,
        buffer_ptr,
        amount,
      );
      const file = getOpenFile(rid);
      file.seekSync(offset, Deno.SeekMode.Start);
      return file.readSync(buffer);
    },
    // Write to a file from a buffer in the module
    js_write: (rid, buffer_ptr, offset, amount) => {
      const buffer = new Uint8Array(
        inst.exports.memory.buffer,
        buffer_ptr,
        amount,
      );
      const file = getOpenFile(rid);
      file.seekSync(offset, Deno.SeekMode.Start);
      return file.writeSync(buffer);
    },
    // Truncate the given file
    js_truncate: (rid, size) => {
      const file = getOpenFile(rid);
      file.truncateSync(size);
    },
    // Sync file data to disk
    js_sync: (rid) => {
      const file = getOpenFile(rid);
      if (typeof file.rid === "number") {
        // Uses deprecated Deno.FsFile.rid, which will be removed in Deno 2.0
        Deno.fdatasyncSync(file.rid);
      } else {
        // Support DENO_FUTURE, but requires --unstable-fs
        file.syncDataSync();
      }
    },
    // Retrieve the size of the given file
    js_size: (rid) => {
      const file = getOpenFile(rid);
      return file.statSync().size;
    },
    // Acquire a SHARED or EXCLUSIVE file lock
    js_lock: (rid, exclusive) => {
      // this is unstable and has issues on Windows ...
      if (Deno.flockSync && !isWindows) {
        getOpenFile(rid).lockSync(exclusive !== 0);
      }
    },
    // Release a file lock
    js_unlock: (rid) => {
      // this is unstable and has issues on Windows ...
      if (Deno.funlockSync && !isWindows) {
        getOpenFile(rid).unlockSync();
      }
    },
    // Return current time in ms since UNIX epoch
    js_time: () => {
      return Date.now();
    },
    // Return the timezone offset in minutes for
    // the current locale
    js_timezone: () => {
      return (new Date()).getTimezoneOffset();
    },
    // Determine if a path exists
    js_exists: (path_ptr) => {
      const path = getStr(inst.exports, path_ptr);
      try {
        Deno.statSync(path);
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
          return 0;
        }
      }
      return 1;
    },
    // Determine if a path is accessible i.e. if it has read/write permissions
    // TODO(dyedgreen): Properly determine if there are read permissions
    js_access: (path_ptr) => {
      const path = getStr(inst.exports, path_ptr);
      try {
        Deno.statSync(path);
      } catch (e) {
        if (e instanceof Deno.errors.PermissionDenied) {
          return 0;
        }
      }
      return 1;
    },
    // Call a user defined SQL function
    js_call_user_func: (func_idx, arg_count) => {
      inst.functions[func_idx](arg_count);
    },
  };

  return { env };
}
