const editor = CodeMirror(
  document.querySelector("#editor"),
  { lineWrapping: true, mode: "javascript" },
);
editor.setSize("100%", "100%");
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
    // Redirect prints to html console
    const console = {
      log: print,
      warn: print,
      error: (...args) => print(...args.map((a) => new Error(a))),
    };
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
        if (arg._done) {
          output.innerHTML += "<p><b>Empty Row</b></p>";
          continue;
        }
        // consume and display row
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
db.query("CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)");

const names = ["Peter Parker", "Clark Kent", "Bruce Wane"];

// Run a simple query
for (const name of names)
  db.query(
    "INSERT INTO people (name, email) VALUES (?, ?)",
    [name, \`\${name.replace(/\\s+/g, ".").toLowerCase()}@deno.land\`]
  );

// Query the results
let data = db.query("SELECT * FROM people");

// Note: The console supports directly displaying queried rows (consuming the row)
console.log("Results:", data);

// Close connection
db.close();`);

// Load code from url
window.onload = function () {
  const hash = location.hash.replace(/^#/, "");
  if (hash.length !== 0) {
    editor.setValue(atob(hash));
  }
};

// Store current editor content in hash if changed
editor.on("change", function () {
  const base = location.href.split("#")[0];
  history.replaceState(null, "", `${base}#${btoa(editor.getValue())}`);
});
