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

## User-provided model assets

PRSK and other LiveSD model files are not distributed with this repository or its production bundle. Users provide model resources locally and are responsible for confirming their rights to use those resources.
