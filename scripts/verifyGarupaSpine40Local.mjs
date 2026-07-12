import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { chromium } from '@playwright/test'

const repositoryRoot = resolve(import.meta.dirname, '..')
const providerManifestPath = resolve(
  repositoryRoot,
  'src/features/livesd/garupa/remote/provider-manifest.v1.json',
)
const sourceProvenancePath = resolve(
  repositoryRoot,
  'qa/garupa/source-provenance/panxuc-bangdream-live2d-15b3e023.json',
)
const runtimeProvenancePath = resolve(
  repositoryRoot,
  'qa/garupa/runtime-provenance/esotericsoftware-spine-webgl-4.0.31.json',
)
const rootPackagePath = resolve(repositoryRoot, 'package.json')
const lockfilePath = resolve(repositoryRoot, 'pnpm-lock.yaml')
const require = createRequire(import.meta.url)
const compatibilityMapping = Object.freeze({
  idle: { animationName: 'Idle', mirrorX: false },
  'running-right': { animationName: 'mob_walk_0', mirrorX: false },
  'running-left': { animationName: 'mob_walk_0', mirrorX: true },
  waving: { animationName: 'passion_talk_1', mirrorX: false },
  jumping: { animationName: 'passion_dance_1', mirrorX: false },
  failed: { animationName: 'pure_sad_0', mirrorX: false },
  waiting: { animationName: 'cool_idle1_0', mirrorX: false },
  running: { animationName: 'normal_pc_1', mirrorX: false },
  review: { animationName: 'cool_book_1', mirrorX: false },
})
const compatibilityStates = Object.freeze([
  { id: 'idle', row: 0, frameCount: 6 },
  { id: 'running-right', row: 1, frameCount: 8 },
  { id: 'running-left', row: 2, frameCount: 8 },
  { id: 'waving', row: 3, frameCount: 4 },
  { id: 'jumping', row: 4, frameCount: 5 },
  { id: 'failed', row: 5, frameCount: 8 },
  { id: 'waiting', row: 6, frameCount: 6 },
  { id: 'running', row: 7, frameCount: 6 },
  { id: 'review', row: 8, frameCount: 6 },
])

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function isInside(parent, candidate) {
  const childPath = relative(parent, candidate)
  return (
    childPath === '' ||
    (!childPath.startsWith(`..${sep}`) &&
      childPath !== '..' &&
      !isAbsolute(childPath))
  )
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function assertRegularFile(path, root) {
  const metadata = await lstat(path)
  assert(
    metadata.isFile() && !metadata.isSymbolicLink(),
    'Private Garupa fixture entries must be regular files.',
  )
  const [actualRoot, actualPath] = await Promise.all([
    realpath(root),
    realpath(path),
  ])
  assert(
    isInside(actualRoot, actualPath),
    'Private Garupa fixture entry resolved outside its canonical root.',
  )
}

async function verifyRuntimeInstall(runtimeProvenance) {
  const rootPackage = await readJson(rootPackagePath)
  const lockfile = await readFile(lockfilePath, 'utf8')
  const expectedPackage = runtimeProvenance.package
  const expectedCore = runtimeProvenance.transitivePackages.find(
    (candidate) => candidate.name === '@esotericsoftware/spine-core',
  )

  assert(
    runtimeProvenance.status ===
      'branch-integration-and-distribution-approved-release-blocked' &&
      runtimeProvenance.releaseGate?.productionIntegration === 'allowed' &&
      runtimeProvenance.releaseGate?.publicDistribution === 'allowed' &&
      runtimeProvenance.releaseGate?.release === 'blocked',
    'Spine 4.0 provenance must allow branch integration and public preview while keeping release blocked.',
  )
  assert(
    rootPackage.dependencies?.[expectedPackage.name] ===
      expectedPackage.version &&
      rootPackage.devDependencies?.[expectedPackage.name] === undefined,
    'Spine 4.0 must remain an exact production dependency for branch builds.',
  )
  for (const scriptName of ['build', 'test']) {
    assert(
      !rootPackage.scripts?.[scriptName]?.includes('garupa-spine40-local'),
      `The local Spine 4.0 probe must not run from pnpm ${scriptName}.`,
    )
  }
  assert(
    lockfile.includes(`'${expectedPackage.name}@${expectedPackage.version}':`) &&
      lockfile.includes(`integrity: ${expectedPackage.integrity}`),
    'pnpm lockfile does not pin the approved Spine WebGL package integrity.',
  )
  assert(
    expectedCore &&
      lockfile.includes(`'${expectedCore.name}@${expectedCore.version}':`) &&
      lockfile.includes(`integrity: ${expectedCore.integrity}`),
    'pnpm lockfile does not pin the approved Spine core package integrity.',
  )

  const webglPackagePath = require.resolve(
    '@esotericsoftware/spine-webgl/package.json',
  )
  const webglRoot = dirname(webglPackagePath)
  const corePackagePath = require.resolve(
    '@esotericsoftware/spine-core/package.json',
    { paths: [webglRoot] },
  )
  const coreRoot = dirname(corePackagePath)
  const webglPackage = await readJson(webglPackagePath)
  const corePackage = await readJson(corePackagePath)
  assert(
    webglPackage.name === expectedPackage.name &&
      webglPackage.version === expectedPackage.version &&
      webglPackage.license === 'LicenseRef-LICENSE' &&
      webglPackage.dependencies?.[expectedCore.name] === expectedCore.version,
    'Installed Spine WebGL package metadata does not match the approved pin.',
  )
  assert(
    corePackage.name === expectedCore.name &&
      corePackage.version === expectedCore.version &&
      corePackage.license === 'LicenseRef-LICENSE',
    'Installed Spine core package metadata does not match the approved pin.',
  )

  const installedFiles = runtimeProvenance.installedFiles
  const files = {
    webglLicense: resolve(webglRoot, 'LICENSE'),
    webglIife: resolve(webglRoot, 'dist/iife/spine-webgl.js'),
    webglMinifiedIife: resolve(
      webglRoot,
      'dist/iife/spine-webgl.min.js',
    ),
    coreLicense: resolve(coreRoot, 'LICENSE'),
    coreIife: resolve(coreRoot, 'dist/iife/spine-core.js'),
    coreMinifiedIife: resolve(coreRoot, 'dist/iife/spine-core.min.js'),
  }
  for (const [key, path] of Object.entries(files)) {
    const expectedHash = installedFiles[`${key}Sha256`]
    assert(
      expectedHash && sha256(await readFile(path)) === expectedHash,
      `Installed Spine runtime file hash mismatch: ${key}`,
    )
  }

  return {
    runtimeText: await readFile(files.webglIife, 'utf8'),
    runtimeVersion: webglPackage.version,
  }
}

async function loadRepresentativeFixture(
  providerManifest,
  sourceProvenance,
  runtimeProvenance,
) {
  const configuredRoot = process.env.CHIBI_PRIVATE_FIXTURE_ROOT?.trim()
  const privateRoot = configuredRoot
    ? resolve(configuredRoot)
    : process.platform === 'darwin'
      ? resolve(
          homedir(),
          'Library',
          'Application Support',
          'chibi-to-codex-pet',
          'private-fixtures',
        )
      : resolve(
          homedir(),
          '.local',
          'share',
          'chibi-to-codex-pet',
          'private-fixtures',
        )
  const [actualRepositoryRoot, actualPrivateRoot] = await Promise.all([
    realpath(repositoryRoot),
    realpath(privateRoot),
  ])
  assert(
    !isInside(actualRepositoryRoot, actualPrivateRoot),
    'CHIBI_PRIVATE_FIXTURE_ROOT must stay outside the repository.',
  )
  const privateRootMetadata = await lstat(actualPrivateRoot)
  assert(
    privateRootMetadata.isDirectory() &&
      !privateRootMetadata.isSymbolicLink() &&
      (privateRootMetadata.mode & 0o077) === 0,
    'CHIBI_PRIVATE_FIXTURE_ROOT must be a real owner-only directory.',
  )

  const fixture = providerManifest.debugFixture
  const expectedSource = sourceProvenance.representativeFixture
  const expectedRuntimeFixture = runtimeProvenance.representativeFixture
  assert(
    providerManifest.repository?.sourceRevision ===
      runtimeProvenance.representativeFixture.sourceRevision &&
      sourceProvenance.sourceRevision ===
        runtimeProvenance.representativeFixture.sourceRevision &&
      fixture?.id === expectedSource?.id &&
      fixture.id === expectedRuntimeFixture?.id,
    'Garupa representative fixture provenance does not agree.',
  )

  const snapshotRoot = resolve(
    actualPrivateRoot,
    'garupa',
    'bangdream-live2d',
    providerManifest.repository.sourceRevision,
  )
  const canonicalRoot = resolve(snapshotRoot, 'canonical', fixture.id)
  const fileByRole = new Map()
  for (const descriptor of fixture.files) {
    if (!descriptor.canonicalPath) continue
    const path = resolve(canonicalRoot, descriptor.canonicalPath)
    await assertRegularFile(path, canonicalRoot)
    const bytes = await readFile(path)
    assert(
      bytes.byteLength === descriptor.bytes &&
        sha256(bytes) === descriptor.sha256 &&
        expectedSource.canonicalFiles?.[descriptor.canonicalPath] ===
          descriptor.sha256,
      `Private Garupa fixture hash mismatch for ${descriptor.role}.`,
    )
    const entries = fileByRole.get(descriptor.role) ?? []
    entries.push({
      atlasName: basename(descriptor.canonicalPath),
      bytes,
    })
    fileByRole.set(descriptor.role, entries)
  }

  const skeletons = fileByRole.get('skeleton') ?? []
  const atlases = fileByRole.get('atlas') ?? []
  const pages = fileByRole.get('png') ?? []
  assert(
    skeletons.length === 1 && atlases.length === 1 && pages.length === 1,
    'The approved local rendering probe requires one skeleton, atlas, and PNG page.',
  )
  return {
    atlasText: new TextDecoder('utf-8', { fatal: true }).decode(
      atlases[0].bytes,
    ),
    page: pages[0],
    skeleton: skeletons[0].bytes,
  }
}

async function renderFirstFrame(
  runtimeText,
  fixture,
  { fullCompatibility = false, includeAnimationNames = false } = {},
) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  })
  try {
    const page = await browser.newPage()
    const externalRequests = []
    page.on('request', (request) => {
      if (/^https?:/u.test(request.url())) {
        externalRequests.push(request.url())
      }
    })
    await page.setContent(
      '<!doctype html><canvas id="stage" width="512" height="512"></canvas>',
    )
    await page.addScriptTag({ content: runtimeText })
    const result = await page.evaluate(
      async ({ atlasText, compatibilityMapping, compatibilityStates, fullCompatibility, includeAnimationNames, pageName, pngBase64, skeletonBase64 }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${pngBase64}`
        await image.decode()
        const canvas = document.querySelector('#stage')
        const gl = canvas.getContext('webgl', {
          alpha: true,
          antialias: false,
          depth: false,
          premultipliedAlpha: false,
          stencil: false,
        })
        if (!gl) throw new Error('WebGL is unavailable.')
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
        const managed = new spine.ManagedWebGLRenderingContext(gl)
        let atlas
        let batcher
        let shader
        try {
          atlas = new spine.TextureAtlas(atlasText)
          if (atlas.pages.length !== 1 || atlas.pages[0].name !== pageName) {
            throw new Error('The approved atlas page does not match the fixture.')
          }
          atlas.pages[0].setTexture(new spine.GLTexture(managed, image))
          const binary = Uint8Array.from(
            atob(skeletonBase64),
            (character) => character.charCodeAt(0),
          )
          const skeletonData = new spine.SkeletonBinary(
            new spine.AtlasAttachmentLoader(atlas),
          ).readSkeletonData(binary)
          const idle = skeletonData.findAnimation('Idle')
          if (!idle) throw new Error('Idle animation is missing.')

          const skeleton = new spine.Skeleton(skeletonData)
          skeleton.setToSetupPose()
          const animationState = new spine.AnimationState(
            new spine.AnimationStateData(skeletonData),
          )
          animationState.setAnimation(0, 'Idle', true)
          animationState.update(0)
          animationState.apply(skeleton)
          skeleton.updateWorldTransform()
          const bounds = skeleton.getBoundsRect()
          const targetAspect = canvas.width / canvas.height
          const centerX = bounds.x + bounds.width / 2
          const centerY = bounds.y + bounds.height / 2
          let projectionWidth = bounds.width * 1.2
          let projectionHeight = bounds.height * 1.2
          if (projectionWidth / projectionHeight < targetAspect) {
            projectionWidth = projectionHeight * targetAspect
          } else {
            projectionHeight = projectionWidth / targetAspect
          }
          const matrix = new spine.Matrix4().ortho2d(
            centerX - projectionWidth / 2,
            centerY - projectionHeight / 2,
            projectionWidth,
            projectionHeight,
          )
          shader = spine.Shader.newTwoColoredTextured(managed)
          batcher = new spine.PolygonBatcher(managed, true)
          const renderer = new spine.SkeletonRenderer(managed, true)
          renderer.premultipliedAlpha = false

          gl.viewport(0, 0, canvas.width, canvas.height)
          gl.disable(gl.DEPTH_TEST)
          gl.depthMask(false)
          gl.disable(gl.CULL_FACE)
          gl.disable(gl.SCISSOR_TEST)
          gl.disable(gl.STENCIL_TEST)
          gl.disable(gl.POLYGON_OFFSET_FILL)
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT)
          gl.enable(gl.BLEND)
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
          shader.bind()
          shader.setUniformi(spine.Shader.SAMPLER, 0)
          shader.setUniform4x4f(spine.Shader.MVP_MATRIX, matrix.values)
          batcher.begin(shader)
          renderer.draw(batcher, skeleton)
          batcher.end()
          shader.unbind()

          const pixels = new Uint8Array(canvas.width * canvas.height * 4)
          gl.readPixels(
            0,
            0,
            canvas.width,
            canvas.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels,
          )
          let visiblePixels = 0
          let minX = canvas.width
          let minY = canvas.height
          let maxX = -1
          let maxY = -1
          let rgbaFnv1a32 = 2166136261
          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
              const offset = (y * canvas.width + x) * 4
              for (let channel = 0; channel < 4; channel += 1) {
                rgbaFnv1a32 ^= pixels[offset + channel]
                rgbaFnv1a32 = Math.imul(rgbaFnv1a32, 16777619) >>> 0
              }
              if (pixels[offset + 3] > 0) {
                visiblePixels += 1
                minX = Math.min(minX, x)
                minY = Math.min(minY, y)
                maxX = Math.max(maxX, x)
                maxY = Math.max(maxY, y)
              }
            }
          }
          let compatibility
          if (fullCompatibility) {
            const cellWidth = 192
            const cellHeight = 208
            const atlasColumns = 8
            const atlasRows = 11
            const animationByName = new Map(
              skeletonData.animations.map((animation) => [
                animation.name,
                animation,
              ]),
            )
            for (const mapping of Object.values(compatibilityMapping)) {
              if (!animationByName.has(mapping.animationName)) {
                throw new Error(
                  `Compatibility mapping animation is missing: ${mapping.animationName}`,
                )
              }
            }

            const sourceCanvas = document.createElement('canvas')
            sourceCanvas.width = image.naturalWidth
            sourceCanvas.height = image.naturalHeight
            const sourceContext = sourceCanvas.getContext('2d', {
              willReadFrequently: true,
            })
            if (!sourceContext) throw new Error('2D source canvas is unavailable.')
            sourceContext.drawImage(image, 0, 0)
            const sourceRgba = sourceContext.getImageData(
              0,
              0,
              sourceCanvas.width,
              sourceCanvas.height,
            ).data
            let sourceTranslucentPixels = 0
            let sourceStraightRgbEvidencePixels = 0
            for (let offset = 0; offset < sourceRgba.length; offset += 4) {
              const alpha = sourceRgba[offset + 3]
              if (alpha > 0 && alpha < 255) {
                sourceTranslucentPixels += 1
                if (
                  sourceRgba[offset] > alpha ||
                  sourceRgba[offset + 1] > alpha ||
                  sourceRgba[offset + 2] > alpha
                ) {
                  sourceStraightRgbEvidencePixels += 1
                }
              }
            }

            const applyAnimationAt = (animationName, time) => {
              skeleton.setToSetupPose()
              animationState.clearTracks()
              const entry = animationState.setAnimation(0, animationName, true)
              entry.trackTime = time
              animationState.apply(skeleton)
              skeleton.updateWorldTransform()
            }
            const standardFrames = []
            let unionLeft = Number.POSITIVE_INFINITY
            let unionBottom = Number.POSITIVE_INFINITY
            let unionRight = Number.NEGATIVE_INFINITY
            let unionTop = Number.NEGATIVE_INFINITY
            for (const state of compatibilityStates) {
              const mapping = compatibilityMapping[state.id]
              const animation = animationByName.get(mapping.animationName)
              for (
                let frameIndex = 0;
                frameIndex < state.frameCount;
                frameIndex += 1
              ) {
                const sampleTime =
                  (animation.duration * frameIndex) / state.frameCount
                applyAnimationAt(mapping.animationName, sampleTime)
                const frameBounds = skeleton.getBoundsRect()
                if (
                  !Number.isFinite(frameBounds.x) ||
                  !Number.isFinite(frameBounds.y) ||
                  !Number.isFinite(frameBounds.width) ||
                  !Number.isFinite(frameBounds.height) ||
                  frameBounds.width <= 0 ||
                  frameBounds.height <= 0
                ) {
                  throw new Error('Compatibility frame has invalid bounds.')
                }
                unionLeft = Math.min(unionLeft, frameBounds.x)
                unionBottom = Math.min(unionBottom, frameBounds.y)
                unionRight = Math.max(
                  unionRight,
                  frameBounds.x + frameBounds.width,
                )
                unionTop = Math.max(
                  unionTop,
                  frameBounds.y + frameBounds.height,
                )
                standardFrames.push({
                  animationName: mapping.animationName,
                  column: frameIndex,
                  lookDirectionIndex: null,
                  mirrorX: mapping.mirrorX,
                  row: state.row,
                  sampleTime,
                  stateId: state.id,
                })
              }
            }
            if (standardFrames.length !== 57) {
              throw new Error('Compatibility standard frame plan is not 57 frames.')
            }

            const unionWidth = unionRight - unionLeft
            const unionHeight = unionTop - unionBottom
            const unionCenterX = unionLeft + unionWidth / 2
            const unionCenterY = unionBottom + unionHeight / 2
            const cellAspect = cellWidth / cellHeight
            let cellProjectionWidth = unionWidth * 1.2
            let cellProjectionHeight = unionHeight * 1.2
            if (cellProjectionWidth / cellProjectionHeight < cellAspect) {
              cellProjectionWidth = cellProjectionHeight * cellAspect
            } else {
              cellProjectionHeight = cellProjectionWidth / cellAspect
            }
            const cellProjection = {
              x: unionCenterX - cellProjectionWidth / 2,
              y: unionCenterY - cellProjectionHeight / 2,
              width: cellProjectionWidth,
              height: cellProjectionHeight,
            }
            const lookFrames = Array.from({ length: 16 }, (_, index) => ({
              animationName: compatibilityMapping.idle.animationName,
              column: index % atlasColumns,
              lookDirectionIndex: index,
              mirrorX: false,
              row: 9 + Math.floor(index / atlasColumns),
              sampleTime: 0,
              stateId: 'idle',
            }))
            const framePlan = [...standardFrames, ...lookFrames]
            if (framePlan.length !== 73) {
              throw new Error('Compatibility frame plan is not 73 frames.')
            }

            const leftEye = skeleton.findBone('F_eyeL')
            const rightEye = skeleton.findBone('F_eyeR')
            if (!leftEye?.parent || !rightEye?.parent) {
              throw new Error('Compatibility paired-eye bones are unavailable.')
            }
            const descendsFrom = (bone, ancestor) => {
              for (let current = bone; current; current = current.parent) {
                if (current === ancestor) return true
              }
              return false
            }
            applyAnimationAt(compatibilityMapping.idle.animationName, 0)
            const visibleEyeAttachments = skeleton.slots.filter((slot) => {
              const attachment = slot.getAttachment()
              const name = attachment?.name?.toLowerCase() ?? ''
              return (
                attachment &&
                (descendsFrom(slot.bone, leftEye) ||
                  descendsFrom(slot.bone, rightEye)) &&
                name.includes('eye') &&
                !name.includes('eyebrow') &&
                slot.color.a > 0 &&
                (attachment.width ?? 0) > 1 &&
                (attachment.height ?? 0) > 1
              )
            })

            const applyLook = (directionIndex) => {
              applyAnimationAt(compatibilityMapping.idle.animationName, 0)
              const eyes = [leftEye, rightEye]
              const before = eyes.map((bone) => ({
                x: bone.worldX,
                y: bone.worldY,
              }))
              const radians = (directionIndex * 22.5 * Math.PI) / 180
              const worldDeltaX =
                Math.sin(radians) * (cellProjection.width / cellWidth) * 6
              const worldDeltaY =
                Math.cos(radians) * (cellProjection.height / cellHeight) * 6
              for (const bone of eyes) {
                const parent = bone.parent
                const determinant = parent.a * parent.d - parent.b * parent.c
                if (Math.abs(determinant) < 1e-8) {
                  throw new Error('Compatibility eye parent is singular.')
                }
                bone.x +=
                  (parent.d * worldDeltaX - parent.b * worldDeltaY) /
                  determinant
                bone.y +=
                  (-parent.c * worldDeltaX + parent.a * worldDeltaY) /
                  determinant
              }
              skeleton.updateWorldTransform()
              return eyes.reduce(
                (delta, bone, index) => ({
                  x: delta.x + (bone.worldX - before[index].x) / eyes.length,
                  y: delta.y + (bone.worldY - before[index].y) / eyes.length,
                }),
                { x: 0, y: 0 },
              )
            }

            const renderFrame = (frame) => {
              applyAnimationAt(frame.animationName, frame.sampleTime)
              let lookDelta = null
              if (frame.lookDirectionIndex !== null) {
                lookDelta = applyLook(frame.lookDirectionIndex)
              }
              matrix.ortho2d(
                frame.mirrorX
                  ? cellProjection.x + cellProjection.width
                  : cellProjection.x,
                cellProjection.y,
                frame.mirrorX
                  ? -cellProjection.width
                  : cellProjection.width,
                cellProjection.height,
              )
              gl.viewport(0, 0, cellWidth, cellHeight)
              gl.disable(gl.DEPTH_TEST)
              gl.depthMask(false)
              gl.disable(gl.CULL_FACE)
              gl.disable(gl.SCISSOR_TEST)
              gl.disable(gl.STENCIL_TEST)
              gl.disable(gl.POLYGON_OFFSET_FILL)
              gl.clearColor(0, 0, 0, 0)
              gl.clear(gl.COLOR_BUFFER_BIT)
              gl.enable(gl.BLEND)
              gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
              shader.bind()
              shader.setUniformi(spine.Shader.SAMPLER, 0)
              shader.setUniform4x4f(spine.Shader.MVP_MATRIX, matrix.values)
              batcher.begin(shader)
              renderer.draw(batcher, skeleton)
              batcher.end()
              shader.unbind()

              const raw = new Uint8Array(cellWidth * cellHeight * 4)
              gl.readPixels(
                0,
                0,
                cellWidth,
                cellHeight,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                raw,
              )
              const straight = new Uint8ClampedArray(raw.length)
              let frameVisiblePixels = 0
              let frameTranslucentPixels = 0
              let frameHash = 2166136261
              for (let y = 0; y < cellHeight; y += 1) {
                for (let x = 0; x < cellWidth; x += 1) {
                  const sourceOffset = (y * cellWidth + x) * 4
                  const targetOffset =
                    ((cellHeight - 1 - y) * cellWidth + x) * 4
                  const alpha = raw[sourceOffset + 3]
                  for (let channel = 0; channel < 3; channel += 1) {
                    straight[targetOffset + channel] =
                      alpha === 0
                        ? 0
                        : Math.min(
                            255,
                            Math.round(
                              (raw[sourceOffset + channel] * 255) / alpha,
                            ),
                          )
                  }
                  straight[targetOffset + 3] = alpha
                  if (alpha > 0) frameVisiblePixels += 1
                  if (alpha > 0 && alpha < 255) {
                    frameTranslucentPixels += 1
                  }
                }
              }
              for (const byte of straight) {
                frameHash ^= byte
                frameHash = Math.imul(frameHash, 16777619) >>> 0
              }
              return {
                hash: frameHash.toString(16).padStart(8, '0'),
                lookDelta,
                rgba: straight,
                translucentPixels: frameTranslucentPixels,
                visiblePixels: frameVisiblePixels,
              }
            }

            const diagnosticHash = (bytes) => {
              let hash = 2166136261
              for (const byte of new Uint8Array(bytes)) {
                hash ^= byte
                hash = Math.imul(hash, 16777619) >>> 0
              }
              return hash.toString(16).padStart(8, '0')
            }
            const encodeAtlas = async (atlasCanvas) =>
              new Promise((accept, reject) =>
                atlasCanvas.toBlob(
                  (blob) =>
                    blob
                      ? accept(blob)
                      : reject(new Error('Compatibility PNG encode failed.')),
                  'image/png',
                ),
              )
            const renderAtlas = async () => {
              const atlasCanvas = document.createElement('canvas')
              atlasCanvas.width = cellWidth * atlasColumns
              atlasCanvas.height = cellHeight * atlasRows
              const atlasContext = atlasCanvas.getContext('2d', {
                willReadFrequently: true,
              })
              if (!atlasContext) {
                throw new Error('Compatibility atlas canvas is unavailable.')
              }
              atlasContext.clearRect(
                0,
                0,
                atlasCanvas.width,
                atlasCanvas.height,
              )
              const cellHashes = []
              const cardinalDeltas = {}
              let readbackTranslucentPixels = 0
              for (const frame of framePlan) {
                const rendered = renderFrame(frame)
                if (rendered.visiblePixels === 0) {
                  throw new Error(
                    `Compatibility frame is transparent: ${frame.row}/${frame.column}`,
                  )
                }
                atlasContext.putImageData(
                  new ImageData(rendered.rgba, cellWidth, cellHeight),
                  frame.column * cellWidth,
                  frame.row * cellHeight,
                )
                cellHashes.push(rendered.hash)
                readbackTranslucentPixels += rendered.translucentPixels
                if (
                  rendered.lookDelta &&
                  [0, 4, 8, 12].includes(frame.lookDirectionIndex)
                ) {
                  cardinalDeltas[frame.lookDirectionIndex] = rendered.lookDelta
                }
              }
              const png = await encodeAtlas(atlasCanvas)
              const pngBytes = await png.arrayBuffer()

              const decoded = await createImageBitmap(png)
              const validatorCanvas = document.createElement('canvas')
              validatorCanvas.width = decoded.width
              validatorCanvas.height = decoded.height
              const validatorContext = validatorCanvas.getContext('2d', {
                willReadFrequently: true,
              })
              if (!validatorContext) {
                decoded.close()
                throw new Error('Compatibility validator canvas is unavailable.')
              }
              validatorContext.drawImage(decoded, 0, 0)
              decoded.close()
              const decodedRgba = validatorContext.getImageData(
                0,
                0,
                validatorCanvas.width,
                validatorCanvas.height,
              ).data
              const usedCells = new Set(
                framePlan.map((frame) => `${frame.row}:${frame.column}`),
              )
              let usedVisibleCells = 0
              let unusedVisibleCells = 0
              for (let row = 0; row < atlasRows; row += 1) {
                for (let column = 0; column < atlasColumns; column += 1) {
                  let hasAlpha = false
                  for (let y = 0; y < cellHeight && !hasAlpha; y += 1) {
                    for (let x = 0; x < cellWidth; x += 1) {
                      const pixelX = column * cellWidth + x
                      const pixelY = row * cellHeight + y
                      const offset =
                        (pixelY * validatorCanvas.width + pixelX) * 4
                      if (decodedRgba[offset + 3] > 0) {
                        hasAlpha = true
                        break
                      }
                    }
                  }
                  if (hasAlpha) {
                    if (usedCells.has(`${row}:${column}`)) {
                      usedVisibleCells += 1
                    } else {
                      unusedVisibleCells += 1
                    }
                  }
                }
              }
              return {
                cardinalDeltas,
                cellHashes,
                pngByteArray: new Uint8Array(pngBytes),
                pngBytes: png.size,
                pngFnv1a32: diagnosticHash(pngBytes),
                readbackTranslucentPixels,
                unusedVisibleCells,
                usedVisibleCells,
              }
            }

            const firstAtlas = await renderAtlas()
            const secondAtlas = await renderAtlas()
            if (
              firstAtlas.pngFnv1a32 !== secondAtlas.pngFnv1a32 ||
              firstAtlas.pngBytes !== secondAtlas.pngBytes ||
              firstAtlas.cellHashes.join(',') !==
                secondAtlas.cellHashes.join(',') ||
              firstAtlas.pngByteArray.length !==
                secondAtlas.pngByteArray.length ||
              firstAtlas.pngByteArray.some(
                (byte, index) => byte !== secondAtlas.pngByteArray[index],
              )
            ) {
              throw new Error('Compatibility atlas output is not deterministic.')
            }
            const cardinal = firstAtlas.cardinalDeltas
            if (
              cardinal[0]?.y <= 0 ||
              cardinal[4]?.x <= 0 ||
              cardinal[8]?.y >= 0 ||
              cardinal[12]?.x >= 0
            ) {
              throw new Error('Compatibility cardinal look semantics are invalid.')
            }
            if (
              firstAtlas.usedVisibleCells !== 73 ||
              firstAtlas.unusedVisibleCells !== 0
            ) {
              throw new Error('Compatibility package validator rejected cell usage.')
            }
            const lookCellHashes = firstAtlas.cellHashes.slice(57)
            compatibility = {
              mapping: compatibilityMapping,
              mappingStates: Object.keys(compatibilityMapping).length,
              frameCount: framePlan.length,
              standardFrames: standardFrames.length,
              lookFrames: lookFrames.length,
              visibleEyeAttachments: visibleEyeAttachments.length,
              lookUniqueCellHashes: new Set(lookCellHashes).size,
              cardinalDeltas: cardinal,
              sourceTranslucentPixels,
              sourceStraightRgbEvidencePixels,
              readbackTranslucentPixels:
                firstAtlas.readbackTranslucentPixels,
              pngBytes: firstAtlas.pngBytes,
              pngFnv1a32: firstAtlas.pngFnv1a32,
              deterministicRuns: 2,
              validator: {
                width: cellWidth * atlasColumns,
                height: cellHeight * atlasRows,
                usedVisibleCells: firstAtlas.usedVisibleCells,
                unusedVisibleCells: firstAtlas.unusedVisibleCells,
                installedPreviewDecoded: true,
              },
              projection: cellProjection,
            }
          }
          return {
            version: skeletonData.version,
            bones: skeletonData.bones.length,
            slots: skeletonData.slots.length,
            animations: skeletonData.animations.length,
            animationNames: includeAnimationNames
              ? skeletonData.animations.map((animation) => animation.name)
              : undefined,
            atlasPages: atlas.pages.length,
            atlasRegions: atlas.regions.length,
            defaultAnimation: idle.name,
            idleDuration: idle.duration,
            pairedEyes: Boolean(
              skeleton.findBone('F_eyeL') && skeleton.findBone('F_eyeR'),
            ),
            visiblePixels,
            alphaBounds:
              visiblePixels > 0
                ? { left: minX, bottom: minY, right: maxX, top: maxY }
                : null,
            rgbaFnv1a32: rgbaFnv1a32.toString(16).padStart(8, '0'),
            glError: gl.getError(),
            compatibility,
          }
        } finally {
          batcher?.dispose()
          shader?.dispose()
          atlas?.dispose()
          image.removeAttribute('src')
        }
      },
      {
        atlasText: fixture.atlasText,
        compatibilityMapping,
        compatibilityStates,
        fullCompatibility,
        includeAnimationNames,
        pageName: fixture.page.atlasName,
        pngBase64: fixture.page.bytes.toString('base64'),
        skeletonBase64: fixture.skeleton.toString('base64'),
      },
    )
    assert(
      externalRequests.length === 0,
      'The local Spine 4.0 probe attempted an external network request.',
    )
    return result
  } finally {
    await browser.close()
  }
}

const [providerManifest, sourceProvenance, runtimeProvenance] =
  await Promise.all([
    readJson(providerManifestPath),
    readJson(sourceProvenancePath),
    readJson(runtimeProvenancePath),
  ])
const runtime = await verifyRuntimeInstall(runtimeProvenance)
const fixture = await loadRepresentativeFixture(
  providerManifest,
  sourceProvenance,
  runtimeProvenance,
)
const result = await renderFirstFrame(runtime.runtimeText, fixture, {
  fullCompatibility: process.env.GARUPA_PROBE_FULL === '1',
  includeAnimationNames: process.env.GARUPA_PROBE_ANIMATIONS === '1',
})
const expected = runtimeProvenance.representativeFixture.expected
for (const key of [
  'version',
  'bones',
  'slots',
  'animations',
  'atlasPages',
  'atlasRegions',
  'defaultAnimation',
  'pairedEyes',
]) {
  assert(
    result[key] === expected[key],
    `Garupa Spine 4.0 local probe mismatch: ${key}`,
  )
}
assert(
  result.visiblePixels > 0 && result.alphaBounds && result.glError === 0,
  'Garupa Spine 4.0 did not produce a valid first visible WebGL frame.',
)

console.log(
  JSON.stringify(
    {
      status: 'passed',
      scope: runtimeProvenance.scope,
      releaseGate: runtimeProvenance.releaseGate,
      networkRequests: 0,
      runtimeVersion: runtime.runtimeVersion,
      ...result,
    },
    null,
    2,
  ),
)
