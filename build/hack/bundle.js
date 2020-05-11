const [src, dest] = Deno.args;

const wasm = await Deno.readFile(src);

function encode(bytes) {
  let binary = "";
  let len = bytes.length;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\n/g, "");
}

await Deno.writeFile(
  dest,
  new TextEncoder().encode(
    `const wasm =
  "${encode(wasm)}";

function decode(base64) {
  const bytesStr = window.atob(base64);
  const bytes = new Uint8Array(bytesStr.length);
  for (let i = 0, c = bytesStr.length; i < c; i++) {
    bytes[i] = bytesStr.charCodeAt(i);
  }
  return bytes;
}

const { instance } = await WebAssembly.instantiate(decode(wasm));
export default instance.exports;
`,
  ),
);
