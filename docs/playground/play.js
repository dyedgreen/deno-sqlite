import sqlite from "./sqlite_browser.js";

const editor = CodeMirror(
  document.querySelector("#editor"),
  { lineWrapping: true, mode: "javascript" },
);
const output = document.querySelector("#output");
const btnRun = document.querySelector("#btn-run");
const btnClear = document.querySelector("#btn-clear");

btnClear.onclick = function () {
  output.innerHTML = "";
};

btnRun.onclick = function () {
  const script = editor.getValue();
  (async function () {
    // Create new sqlite module
    const { DB, Empty, Status } = await sqlite();
    console.log = print;
    console.warn = print;
    console.error = (...args) => print(...args.map((a) => new Error(a)));
    try {
      eval(script);
    } catch (err) {
      print(err instanceof Error ? err : new Error(err));
    }
  })();
};

function print(...args) {
  let allText = true;
  for (const arg of args) {
    if (typeof arg !== "string") {
      allText = false;
      break;
    }
  }

  if (allText) {
    // simply format the text
    output.innerHTML += `<p>${args.join(" ")}</p>`;
  } else {
    for (const arg of args) {
      if (arg instanceof Error) {
        // it's an error
        output.innerHTML +=
          `<p class="error"><b>${arg.name}:</b> ${arg.message}</p>`;
      } else if (typeof arg._id == "number" && arg._db) {
        // it's a row
        const title = arg.columns();
        const data = [...arg];
        output.innerHTML += `<table>
          <tr>${title.map((c) => `<th>${c.name}</th>`).join("")}</tr>
          ${
          data.map((row) =>
            `<tr>${row.map((e) => `<td>${e}</td>`).join("")}</tr>`
          ).join("")
        }
        </table>`;
      } else {
        output.innerHTML += `<p>${arg}</p>`;
      }
    }
  }
}

// Initial editor content
editor.setValue(`const db = new DB();
db.query("CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",);

const names = ["Peter Parker", "Clark Kent", "Bruce Wane"];

// Run a simple query
for (const name of names)
  db.query("INSERT INTO people (name) VALUES (?)", [name]);

// Display DB table
let data = db.query("SELECT * FROM people");
console.log("Results:", data);

// Close connection
db.close();`);
