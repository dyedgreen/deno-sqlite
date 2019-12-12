"use strict";
// Patch the emscripten build

// We need to deliver the WASM inline with the sqlite.js so it can be linked into the runtime without
// needing to be read from a file.

// FIXME: once WASM interfaces land and are supported by both emscripten and Deno, we probably don't
//        need to wrap things like this anymore.
const wasm = await Deno.readFile(Deno.args[1].replace(".js", ".wasm"));

// Patches (applied consecutively!)
const patches = [
  // fill in file-loading functions
  {regexp: /^/g, replace: `const read = () => new Uint8Array([${wasm.map(c => `${c}`).join(",")}]);\n`},
  // fix some Deno-specific problems with the provided runtime
  {regexp: /var UTF16Decoder ?=[^;]+;/g, replace: "var UTF16Decoder = undefined;"},
  {regexp: /if ?\(.+\) ?throw new Error\('not compiled for this environment[^;]+\);/g, replace: ""},
];

const file = Deno.args[1];
let data = new TextDecoder("utf-8").decode(Deno.readFileSync(file));
data = patches.reduce((acc, {regexp, replace}) => acc.replace(regexp, replace), data);

Deno.writeFileSync(file, new TextEncoder().encode(data));
Deno.remove(Deno.args[1].replace(".js", ".wasm"));
