# Contribute to SQLite for Deno

?> This is a draft.

Thank you for considering to contribute to the SQLite for Deno module! Below are a few guidelines
on how to contribute.

## Prerequisites

To work on the JavaScript/ TypeScript wrapper module, all you need is a [deno](https://deno.land)
runtime.

To change the compiled SQLite WASM binary, you will require to download the [WASI SDK][wasi-sdk]. This
process should function fully automatically for most users.

**To install build dependencies** go to the `build` folder (`cd build`), then run `make setup`.

**To compile the binary** run `make release` (or `make debug` for a debug build). If you changed any
build flags of SQLite, also run `make amalgamation`, before building.

If you are interested in more details regarding the compilation setup, also see
[this blog post][compile-wasm-blog].


## Code Style and Review

This project uses the `deno fmt` code style.


## Documentation

Any user-facing interfaces should be documented. To document such interfaces, include a
**documenting comment**, which must be formatted as follows:

```javascript
/**
 * ClassName.functionName
 *
 * A short but complete description, formatted
 * as markdown.
 */
functionName(arg1, arg2) {
  // ...
}
```

Comments with this format will be automatically parsed by a CI script and added to the documentation
at [`api.md`](./api.md). The first line of the comment identifies the class and function, which helps
the script format the comment correctly.

These comments should not include examples unless they are essential to illustrating an important
point. Examples (cook-book style code snippets) should be added to [`examples.md`](./examples.md).


## Tests and Benchmarks

Any important functionality should be tested. Tests are in the `test.ts` file. Changes will not be
merged unless all tests are passed.

Benchmarks are in the `bench.ts` file.


## License

By making contributions, you agree that anything you submit will be distributed under the projects
license (see `LICENSE`).


[wasi-sdk]: https://github.com/CraneStation/wasi-sdk/releases
[compile-wasm-blog]: https://tilman.xyz/blog/2019/12/building-webassembly-for-deno/
