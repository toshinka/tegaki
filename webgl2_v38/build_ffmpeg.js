// build_ffmpeg.js
import { build } from "esbuild";

const version = "0.12.15";
const entry = "node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js";
const outfile = `libs/ffmpeg-wasm-${version}.min.js`;

await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  outfile,
  platform: "browser",
  target: "es2020",
  format: "iife", // ✅ UMD向けにIIFE出力
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  banner: {
    js: `// ffmpeg.wasm ${version} - bundled via esbuild\n`,
  },
});

console.log(`✅ Created ${outfile}`);
