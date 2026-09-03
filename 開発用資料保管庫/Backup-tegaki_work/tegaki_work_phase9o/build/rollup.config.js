// build/rollup.config.js
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser"; // ← デフォルトインポートでOK

const inputFile = "build_freehand.js";
const outputFile = "libs/perfect-freehand-1.2.0.min.js";

export default {
  input: inputFile,
  output: {
    file: outputFile,
    format: "umd",
    name: "PerfectFreehand",
    sourcemap: false,
  },
  plugins: [
    resolve(),
    commonjs(),
    terser() // ← そのまま terser() でOK
  ],
};
