import babel from "@babel/core"
import typescriptPreset from "@babel/preset-typescript"
import solidPreset from "babel-preset-solid"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

// opencode only applies its Solid JSX transform to files OUTSIDE node_modules,
// so a published plugin must ship JSX already compiled to the @opentui/solid
// universal runtime. Shipping raw .tsx works locally and breaks once installed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = path.join(root, "src", "tui.tsx")
const outDir = path.join(root, "dist")

const result = await babel.transformAsync(await readFile(source, "utf8"), {
  filename: source,
  configFile: false,
  babelrc: false,
  presets: [
    [solidPreset, { moduleName: "@opentui/solid", generate: "universal" }],
    [typescriptPreset],
  ],
})

if (!result?.code) throw new Error("babel produced no output for src/tui.tsx")

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, "tui.js"), `${result.code}\n`)
