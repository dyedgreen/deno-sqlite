# A web / browser compatible VFS

This is an experimental VFS to support using `deno-sqlite` in a web-browser with `deno bundle`.

Generate a bundle by running the following command in the main directory:

```bash
$ deno bundle --import-map browser/import_map.json browser/mod.ts [output_bundle_path]
```
