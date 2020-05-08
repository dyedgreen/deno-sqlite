// Quick and dirty documentation generator

function collect(src) {
  // Collect raw comments
  const regexp =
    /(\/\*\*(?:.|\n)+?\*\/)\n *((async )?(static |get ){0,2}(function )?[a-zA-Z]+\([^)]*\))?/;
  const raw = [];
  while (regexp.test(src)) {
    const [, body, declaration] = regexp.exec(src);
    raw.push({ body, declaration });
    src = src.replace(regexp, "");
  }
  // Parse out decorations
  return raw.map((item) => {
    item.body = item.body
      .replace(/\/\*\* *\n/, "")
      .replace(/\n *\*\//, "")
      .split("\n")
      .map((line) => line.replace(/^ *\*( |$)/, ""))
      .join("\n");
    if (item.declaration) {
      item.declaration = item.declaration.replace(/\??: [a-zA-Z<>]+/g, "");
    }
    return item;
  });
}

function parse(comments) {
  // Build document tree
  const root = {};
  for (const comment of comments) {
    const path = comment.body.split("\n")[0].split(".");
    const body = comment.body.split("\n").slice(2).join("\n");
    for (let i = 0, obj = root; i < path.length; i++) {
      if (i + 1 === path.length) {
        obj[path[i]] = { body, declaration: comment.declaration };
        break;
      }
      if (!obj[path[i]]) {
        obj[path[i]] = {};
      }
      obj = obj[path[i]];
    }
  }
  return root;
}

function heading(text, level) {
  text = " " + text;
  for (let i = 0; i < level; i++) {
    text = "#" + text;
  }
  for (let i = 5; i > level; i--) {
    text = "\n" + text;
  }
  return text;
}

function keys(obj) {
  return Object.keys(obj).filter((key) =>
    obj.hasOwnProperty(key) && ["body", "declaration"].indexOf(key) === -1
  );
}

function generate(root, md, path = []) {
  // Generate markdown output
  const topcis = keys(root);
  if (path.length > 1) {
    topcis.sort();
  }
  for (const topic of topcis) {
    path.push(topic);
    md += heading(path.join("."), path.length + 1);
    if (root[topic].declaration) {
      let declaration = root[topic].declaration;
      if (declaration.indexOf("constructor") !== -1) {
        declaration = declaration.replace("constructor", `new ${path[0]}`);
      }
      md += `\n\`\`\`javascript\n${declaration}\n\`\`\``;
    } else {
      md += "\n";
    }
    md += `\n${root[topic].body}`;
    md = generate(root[topic], md, path);
    path.pop();
  }
  return md;
}

if (Deno.args.length < 4) {
  console.log("use as:");
  console.log(
    "deno run --allow-read --allow-write docs/generate.js docs/api.md mod.ts src/**",
  );
  Deno.exit(1);
}

// Output file
const out = Deno.args[0];

// Collect comments from input source files
const comments = [];
const stats = {};
for (const file of Deno.args.slice(1)) {
  const c = collect(new TextDecoder().decode(await Deno.readFile(file)));
  stats[file] = c.length;
  comments.push(...c);
}
const root = parse(comments);

// Collect exports from mod
const modExports = /export {([^}]+)}/.exec(
  new TextDecoder().decode(await Deno.readFile(Deno.args[1])),
)[1];

// Preamble
const title = `
# SQLite for Deno API Documentation

This file documents all of the public interfaces for [deno-sqlite](https://github.com/dyedgreen/deno-sqlite).
The documentation is generated automatically using the \`docs/generate.js\` script. If you want to
clarify any of the notes in this file, edit the corresponding comment in the source file and
rerun the generator, to avoid loosing the changes.


## How to import
\`\`\`javascript
import {${modExports}} from "https://deno.land/x/sqlite/mod.ts"
\`\`\`
The above statement lists all the available imports.
`.replace(/(^\n)|(\n$)/g, "");

const markdown = generate(root, title) + "\n";
await Deno.writeFile(out, new TextEncoder().encode(markdown));

// Message
console.log("Generated documentation for:");
for (const [file, num] of Object.entries(stats)) {
  console.log(`${file} (${num})`);
}
console.log("Parsed exports from: ".concat(Deno.args[1]));
