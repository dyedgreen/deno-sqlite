import * as esbuild from 'https://deno.land/x/esbuild@v0.20.1/mod.js'
import { denoPlugins } from 'jsr:@luca/esbuild-deno-loader@0.9'

esbuild.build({
  plugins: [
    ...denoPlugins({
      configPath: await Deno.realPath('./browser/deno.browser.json'),
    }),
  ],
  entryPoints: [await Deno.realPath('./browser/mod.ts')],
  outdir: await Deno.realPath('./'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'esnext',
  minify: true,
  sourcemap: true,
  treeShaking: true,
})
await esbuild.stop()
