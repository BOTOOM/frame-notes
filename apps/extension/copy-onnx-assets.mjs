import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const transformersRequire = createRequire(require.resolve("@huggingface/transformers"));
const onnxDist = dirname(transformersRequire.resolve("onnxruntime-web"));
const target = resolve(dirname(fileURLToPath(import.meta.url)), "public/onnx");

await mkdir(target, { recursive: true });
for (const file of [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
]) {
  await copyFile(join(onnxDist, file), join(target, file));
}
