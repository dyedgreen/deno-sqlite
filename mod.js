// // First test ...
// // ../emsdk/upstream/emscripten/emcc -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=shell -s EXPORT_ALL=1 test.c
// // keep that handy :)

// // shell stuff:
// const read = Deno.readFileSync;
// const readAsync = Deno.readFile;
// // replace:
// // var UTF16Decoder ?=[^;]+;
// // var UTF16Decoder = undefined;
// // remove (if present):
// // if ?\(.+\) ?throw new Error\('not compiled for this environment[^;]+\);

import Module from "./sqlite.js";

Module().then(mod => {
  console.log("init 2");
  console.log(mod);
  console.log("init_status:", mod._init());
  const statement = mod.ccall("prepare", "number", ["string"], ["SELECT * FROM users;"]);
  console.log("statement:", statement);
  console.log("last_status:", mod._get_status());
  if (mod._get_status() !== 0) {
    console.log("error:", mod.ccall("get_sqlite_error_str", "string", [], []));
  }
});

// const wasmImports = {
//   imports: {
//     wasi_unstable: {},
//   },
// };

// const inst = await WebAssembly.instantiate(await Deno.readFile("test.wasm"), wasmImports);
// console.log(inst);
