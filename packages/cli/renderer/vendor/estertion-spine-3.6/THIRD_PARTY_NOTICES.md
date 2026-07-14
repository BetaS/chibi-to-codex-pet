# Third-Party Notices

## Spine WebGL Runtime 3.6 fork

- **Upstream:** Esoteric Software `spine-runtimes`
- **Fork:** [esterTion/spine-runtimes](https://github.com/esterTion/spine-runtimes)
- **Pinned commit:** [`8d79291441394b3a279d5d36f054d563dbc15e16`](https://github.com/esterTion/spine-runtimes/tree/8d79291441394b3a279d5d36f054d563dbc15e16/spine-ts)
- **Purpose:** LiveSD (Spine 3.6) binary `.skel` loading and WebGL rendering
- **License:** [`third_party/estertion-spine-3.6/LICENSE`](third_party/estertion-spine-3.6/LICENSE)
- **Current license information:** [Spine Runtimes License Agreement](https://en.esotericsoftware.com/spine-runtimes-license)

The original license text and copyright notices are distributed with the runtime. This notice records source provenance and does not replace the original license text.

### Included files

| File | SHA-256 |
|---|---|
| `third_party/estertion-spine-3.6/spine-webgl.js` | `28dd3ecde3325395fb77d3f87e869308f9e710f16e3d5a79e549ae404c478eb4` |
| `third_party/estertion-spine-3.6/spine-webgl.d.ts` | `ea1439dd2e8fc83d3d26bd6890e706c6e5f0356dae8d9e4d112166170090232b` |
| `third_party/estertion-spine-3.6/LICENSE` | `d2af98ecac7e4bb6e4c4491fc734db7762b94626b18bcc87c7eac6febd86e1b5` |

These files are vendored byte-for-byte from the pinned commit. The application loads the JavaScript build as a classic script and confines access to the resulting global `spine` API behind its runtime-loader and `LiveSD36Adapter` boundary.

## Spine WebGL Runtime 4.0.31 — branch distribution approved, release blocked

- **Upstream:** [Esoteric Software `spine-runtimes`](https://github.com/EsotericSoftware/spine-runtimes)
- **Package:** `@esotericsoftware/spine-webgl@4.0.31`
- **Exact dependency:** `@esotericsoftware/spine-core@4.0.31`
- **Release commit:** [`425ce416bb218b28caeec47b317aa57cd7140375`](https://github.com/EsotericSoftware/spine-runtimes/commit/425ce416bb218b28caeec47b317aa57cd7140375)
- **Purpose:** version-isolated Spine 4.0 compatibility and production integration work
- **Original package license:** [`third_party/esotericsoftware-spine-4.0.31/LICENSE`](third_party/esotericsoftware-spine-4.0.31/LICENSE)
- **Current license information:** [Spine Runtimes License Agreement](https://esotericsoftware.com/spine-runtimes-license) and [Spine Editor License Agreement](https://esotericsoftware.com/spine-editor-license)
- **Provenance record:** [`qa/garupa/runtime-provenance/esotericsoftware-spine-webgl-4.0.31.json`](qa/garupa/runtime-provenance/esotericsoftware-spine-webgl-4.0.31.json)

Copyright (c) 2013-2019, Esoteric Software LLC. The package license text and copyright notice are preserved verbatim; the tracked text file adds only its repository newline. This notice is not a license grant. The project owner attested that the integrating project holds an applicable valid Spine Editor license. Public preview and production artifact inclusion are approved on the current feature branch; the runtime JavaScript is connected through a lazy application entrypoint. Release and push remain blocked until a separate user instruction.

### Evaluated package files

| File | SHA-256 |
|---|---|
| `@esotericsoftware/spine-webgl/LICENSE` | `6142ee6cc2c03d3a918793e4750ae772bd3755c534d4a35e559e301acf51ec39` |
| `@esotericsoftware/spine-webgl/dist/index.js` | `8e13939caf2656702877c228e98a8f5bae1a61aeda7dcb62c45e0629a10a3211` |
| `@esotericsoftware/spine-webgl/dist/iife/spine-webgl.js` | `d82e2c32d2fbe2d47d461da5b8dd3b9daac1fbfeda74e6476114d5d70619185a` |
| `@esotericsoftware/spine-webgl/dist/iife/spine-webgl.min.js` | `db31d4ff4d604ca9971f817427277607185b233158cbb4744409288c004a6d2b` |
| `@esotericsoftware/spine-core/LICENSE` | `6142ee6cc2c03d3a918793e4750ae772bd3755c534d4a35e559e301acf51ec39` |
| `@esotericsoftware/spine-core/dist/index.js` | `85795ebb7ba6acfb936c9ce466916efaf7619a0892cf47ab733677437e19de91` |
| `@esotericsoftware/spine-core/dist/iife/spine-core.js` | `c703fc90e26fc58dd84635655de2b6643f25cc8e5ca9f65c18869274a395b93f` |
| `@esotericsoftware/spine-core/dist/iife/spine-core.min.js` | `f1fd613f34df505e2ce37d23350917ca5d43995d66d5de4da963f143b78a2c8d` |

## User-provided model assets

PRSK and other LiveSD model files are not distributed with this repository or its production bundle. Users provide model resources locally and are responsible for confirming their rights to use those resources.
