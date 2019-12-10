"use strict";
// Patch the emscripten build

// TODO: Deliver .wasm file in-lined somewhere so this  is portable (and avoids read permissions)

// patches (applied consecutively!)
const patches = [
  // fill in file-loading functions
  {regexp: /^/g, replace: "const read = Deno.readFileSync, readAsync = Deno.readFile;\n"},
  // fix some Deno-specific problems with the provided runtime
  {regexp: /var UTF16Decoder ?=[^;]+;/g, replace: "var UTF16Decoder = undefined;"},
  {regexp: /if ?\(.+\) ?throw new Error\('not compiled for this environment[^;]+\);/g, replace: ""},
];

const file = Deno.args[1];
let data = new TextDecoder("utf-8").decode(Deno.readFileSync(file));
data = patches.reduce((acc, {regexp, replace}) => acc.replace(regexp, replace), data);

Deno.writeFileSync(file, new TextEncoder().encode(data));
