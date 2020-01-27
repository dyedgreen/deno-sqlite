"use strict";

// Patch builds

function hexEncode(bytes) {
  const fragments = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i ++)
    fragments[i] = bytes[i].toString(16).padStart(2, "0");
  return fragments.join("");
}
function b64Encode(bytes) {
  let binary = "";
  let len = bytes.length;
  for (var i = 0; i < len; i++)
    binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary).replace(/\n/g, "");
}

// Patch emscripten builds for use with deno
async function mainEmscripten(file) {
  const wasm = await Deno.readFile(file.replace(".js", ".wasm"));

  // Patches (applied consecutively!)
  const patches = [
    // write WASM hex
    {regexp: /const wasmHex = "[^"]+";/, replace: `const wasmHex = "${hexEncode(wasm)}";`},
    // fill in file-loading functions
    {regexp: /^/g, replace: `function read() {var d="${hexEncode(wasm)}";var b=new Uint8Array(d.length/2);for(var i=0;i<d.length;i+=2){b[i/2]=parseInt(d.substr(i,2),16);}return b;}\n`},
    // fix some Deno-specific problems with the provided runtime
    {regexp: /var UTF16Decoder ?=[^;]+;/g, replace: "var UTF16Decoder = undefined;"},
    {regexp: /if ?\(.+\) ?throw new Error\('not compiled for this environment[^;]+\);/g, replace: ""},
  ];

  let data = new TextDecoder().decode(await Deno.readFile(file));
  data = patches.reduce((acc, {regexp, replace}) => acc.replace(regexp, replace), data);

  await Deno.writeFile(file, new TextEncoder().encode(data));
  await Deno.remove(file.replace(".js", ".wasm"));
}

// Bundle sqlite.wasm into sqlite.js
async function mainBundle(file) {
  const wasm = await Deno.readFile(file);
  const jsFile = file.replace(".wasm", ".js");

  let data = new TextDecoder().decode(await Deno.readFile(jsFile));
  data = data.replace(/const wasmBase64 = ".+";/, `const wasmBase64 = "${b64Encode(wasm)}";`);
  await Deno.writeFile(jsFile, new TextEncoder().encode(data));
}

// Run appropriate patches
const file = Deno.args[0];
if (file.indexOf("debug") !== -1) {
  await mainEmscripten(file);
} else {
  await mainBundle(file);
}
