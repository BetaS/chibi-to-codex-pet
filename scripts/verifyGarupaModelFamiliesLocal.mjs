import { createHash } from 'node:crypto'
import { readFile, readdir, lstat, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createContext, runInContext } from 'node:vm'

const repositoryRoot = resolve(import.meta.dirname, '..')
const providerManifest = JSON.parse(
  await readFile(
    resolve(
      repositoryRoot,
      'src/features/livesd/garupa/remote/provider-manifest.v1.json',
    ),
    'utf8',
  ),
)
const runtimeProvenance = JSON.parse(
  await readFile(
    resolve(
      repositoryRoot,
      'qa/garupa/runtime-provenance/esotericsoftware-spine-webgl-4.0.31.json',
    ),
    'utf8',
  ),
)
const revision = providerManifest.repository?.sourceRevision
if (!/^[0-9a-f]{40}$/u.test(revision)) {
  throw new Error('The approved Garupa revision is unavailable.')
}

function isInside(parent, candidate) {
  const child = relative(parent, candidate)
  return (
    child === '' ||
    (!child.startsWith(`..${sep}`) &&
      child !== '..' &&
      !isAbsolute(child))
  )
}

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
const privateMetadata = await lstat(actualPrivateRoot)
if (
  isInside(actualRepositoryRoot, actualPrivateRoot) ||
  !privateMetadata.isDirectory() ||
  privateMetadata.isSymbolicLink() ||
  (privateMetadata.mode & 0o077) !== 0
) {
  throw new Error('The Garupa fixture root must be private and outside the repository.')
}

const modelRoot = resolve(
  actualPrivateRoot,
  'garupa',
  'bangdream-live2d',
  revision,
  'repository',
  'sdchara',
  'model',
)
const snapshotIndex = JSON.parse(
  await readFile(resolve(modelRoot, '..', '_info.json'), 'utf8'),
)
const buildDataEntry = snapshotIndex.builddata
if (
  !buildDataEntry ||
  !Array.isArray(buildDataEntry.files) ||
  typeof buildDataEntry.assetPath !== 'string'
) {
  throw new Error('The private Garupa snapshot index is invalid.')
}
const repositoryRootForSnapshot = resolve(modelRoot, '..', '..')
const buildDataRoot = resolve(
  repositoryRootForSnapshot,
  buildDataEntry.assetPath,
)
const buildDataFileByLowercase = new Map(
  buildDataEntry.files.map((fileName) => [fileName.toLowerCase(), fileName]),
)
const costumeAtlasByModel = new Map()
for (const buildDataFile of buildDataEntry.files
  .filter((fileName) => fileName.endsWith('-builddata.asset'))
  .sort()) {
  let buildData
  try {
    buildData = JSON.parse(
      await readFile(resolve(buildDataRoot, buildDataFile), 'utf8'),
    )
  } catch {
    continue
  }
  const modelBundleName = buildData.Base?.model?.bundleName
  const textureFileName = buildData.Base?.textures?.[0]?.fileName
  if (
    typeof modelBundleName !== 'string' ||
    typeof textureFileName !== 'string' ||
    !textureFileName.endsWith('_Atlas.asset')
  ) {
    continue
  }
  const modelName = modelBundleName.split('/').at(-1)?.toLowerCase()
  if (!modelName || costumeAtlasByModel.has(modelName)) continue
  const atlasName = textureFileName.replace(/_Atlas\.asset$/u, '')
  const buildDataStem = buildDataFile.replace(/-builddata\.asset$/u, '')
  const atlasFile = buildDataFileByLowercase.get(
    `${buildDataStem}-${atlasName}.atlas.txt`.toLowerCase(),
  )
  if (!atlasFile) continue
  costumeAtlasByModel.set(
    modelName,
    await readFile(resolve(buildDataRoot, atlasFile), 'utf8'),
  )
}
const require = createRequire(import.meta.url)
const webglPackagePath = require.resolve(
  '@esotericsoftware/spine-webgl/package.json',
)
const runtimeText = await readFile(
  resolve(dirname(webglPackagePath), 'dist/iife/spine-webgl.js'),
  'utf8',
)
if (
  createHash('sha256').update(runtimeText).digest('hex') !==
  runtimeProvenance.installedFiles.webglIifeSha256
) {
  throw new Error('The installed Spine 4.0 runtime does not match provenance.')
}
const context = createContext({
  Array,
  ArrayBuffer,
  DataView,
  Float32Array,
  Int16Array,
  Int32Array,
  Map,
  Math,
  Object,
  Set,
  TextDecoder,
  Uint16Array,
  Uint32Array,
  Uint8Array,
  console,
})
runInContext(runtimeText, context, {
  filename: 'spine-webgl-4.0.31.js',
  timeout: 5_000,
})
const spine = context.spine
if (!spine?.SkeletonBinary || !spine?.TextureAtlas) {
  throw new Error('The isolated Spine 4.0 API shape is invalid.')
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function descendsFrom(bone, ancestor) {
  for (let current = bone; current; current = current.parent) {
    if (current === ancestor) return true
  }
  return false
}

function applyAnimationAt(skeleton, animation) {
  skeleton.setToSetupPose()
  if (animation) {
    animation.apply(
      skeleton,
      0,
      0,
      true,
      [],
      1,
      spine.MixBlend.setup,
      spine.MixDirection.mixIn,
    )
  }
  skeleton.updateWorldTransform()
}

function pairedEyeMatrix(skeleton, animation) {
  const left = skeleton.findBone('F_eyeL')
  const right = skeleton.findBone('F_eyeR')
  if (!left?.parent || !right?.parent) {
    return {
      cardinalDirections: 0,
      visibleAttachments: 0,
      exportSupport: 'preview-only',
      reason: 'paired-eye-bone-missing',
    }
  }
  applyAnimationAt(skeleton, animation)
  const visibleAttachments = skeleton.slots.filter((slot) => {
    const attachment = slot.getAttachment()
    const name = attachment?.name?.toLowerCase() ?? ''
    return (
      attachment &&
      (descendsFrom(slot.bone, left) || descendsFrom(slot.bone, right)) &&
      name.includes('eye') &&
      !name.includes('eyebrow') &&
      slot.color.a > 0 &&
      (attachment.width ?? 0) > 1 &&
      (attachment.height ?? 0) > 1
    )
  }).length
  let cardinalDirections = 0
  for (const directionIndex of [0, 4, 8, 12]) {
    applyAnimationAt(skeleton, animation)
    const eyes = [left, right]
    const before = eyes.map((eye) => ({ x: eye.worldX, y: eye.worldY }))
    const radians = (directionIndex * 22.5 * Math.PI) / 180
    const worldDeltaX = Math.sin(radians) * 8
    const worldDeltaY = Math.cos(radians) * 8
    let singular = false
    for (const eye of eyes) {
      const parent = eye.parent
      const determinant = parent.a * parent.d - parent.b * parent.c
      if (Math.abs(determinant) < 1e-8) {
        singular = true
        break
      }
      eye.x +=
        (parent.d * worldDeltaX - parent.b * worldDeltaY) / determinant
      eye.y +=
        (-parent.c * worldDeltaX + parent.a * worldDeltaY) / determinant
    }
    if (singular) continue
    skeleton.updateWorldTransform()
    const delta = eyes.reduce(
      (sum, eye, index) => ({
        x: sum.x + (eye.worldX - before[index].x) / eyes.length,
        y: sum.y + (eye.worldY - before[index].y) / eyes.length,
      }),
      { x: 0, y: 0 },
    )
    const valid =
      (directionIndex === 0 && delta.y > 0) ||
      (directionIndex === 4 && delta.x > 0) ||
      (directionIndex === 8 && delta.y < 0) ||
      (directionIndex === 12 && delta.x < 0)
    if (valid) cardinalDirections += 1
  }
  return {
    cardinalDirections,
    visibleAttachments,
    exportSupport:
      cardinalDirections === 4 && visibleAttachments >= 2
        ? 'supported'
        : 'preview-only',
    reason:
      cardinalDirections === 4 && visibleAttachments >= 2
        ? null
        : visibleAttachments < 2
          ? 'visible-eye-attachment-missing'
          : 'paired-eye-transform-invalid',
  }
}

const directoryEntries = await readdir(modelRoot, { withFileTypes: true })
const families = []
for (const directoryEntry of directoryEntries
  .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
  .sort((left, right) => left.name.localeCompare(right.name))) {
  const directory = resolve(modelRoot, directoryEntry.name)
  const files = await readdir(directory, { withFileTypes: true })
  const skeletonEntry = files.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.skel'),
  )
  const atlasEntry = files.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.atlas.txt'),
  )
  if (skeletonEntry.length !== 1 || atlasEntry.length !== 1) continue
  const modelName = skeletonEntry[0].name.replace(/\.skel$/iu, '')
  const fallbackAtlas = readFile(
    resolve(directory, atlasEntry[0].name),
    'utf8',
  )
  const [skeletonBytes, modelAtlasText] = await Promise.all([
    readFile(resolve(directory, skeletonEntry[0].name)),
    fallbackAtlas,
  ])
  const costumeAtlasText = costumeAtlasByModel.get(modelName.toLowerCase())
  const atlasText = costumeAtlasText ?? modelAtlasText
  let atlas
  try {
    atlas = new spine.TextureAtlas(atlasText)
    for (const page of atlas.pages) {
      page.setTexture({
        dispose() {},
        getImage() {
          return { height: page.height, width: page.width }
        },
        setFilters() {},
        setWraps() {},
      })
    }
    const skeletonData = new spine.SkeletonBinary(
      new spine.AtlasAttachmentLoader(atlas),
    ).readSkeletonData(Uint8Array.from(skeletonBytes))
    const skeleton = new spine.Skeleton(skeletonData)
    const animation =
      skeletonData.findAnimation('Idle') ?? skeletonData.animations[0] ?? null
    applyAnimationAt(skeleton, animation)
    const bounds = skeleton.getBoundsRect()
    const look = pairedEyeMatrix(skeleton, animation)
    families.push({
      family: directoryEntry.name.replace(/_rip$/u, ''),
      atlasSource: costumeAtlasText ? 'costume-builddata' : 'model-fallback',
      skeletonSha256: sha256(skeletonBytes),
      version: skeletonData.version,
      bones: skeletonData.bones.length,
      slots: skeletonData.slots.length,
      animations: skeletonData.animations.length,
      defaultAnimation: animation?.name ?? null,
      atlasPages: atlas.pages.length,
      boundsFinite:
        [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
        bounds.width > 0 &&
        bounds.height > 0,
      ...look,
    })
  } catch (error) {
    families.push({
      family: directoryEntry.name.replace(/_rip$/u, ''),
      atlasSource: costumeAtlasText ? 'costume-builddata' : 'model-fallback',
      skeletonSha256: sha256(skeletonBytes),
      parse: 'unsupported',
      reason:
        typeof error?.message === 'string'
          ? error.message.slice(0, 160)
          : 'runtime-parse-failed',
    })
  } finally {
    for (const page of atlas?.pages ?? []) {
      page.texture?.dispose?.()
    }
  }
}
if (families.length < 10) {
  throw new Error('The Garupa model-family fixture matrix is incomplete.')
}
const unsupportedFamilies = families.filter(
  (family) => family.parse === 'unsupported',
)

console.log(
  JSON.stringify(
    {
      status:
        unsupportedFamilies.length === 0
          ? 'passed'
          : 'passed-with-unsupported-families',
      scope: 'external-private-fixture-matrix',
      sourceRevision: revision,
      runtimeVersion: runtimeProvenance.package.version,
      networkRequests: 0,
      familyCount: families.length,
      supportedExportFamilies: families.filter(
        (family) => family.exportSupport === 'supported',
      ).length,
      previewOnlyFamilies: families.filter(
        (family) => family.exportSupport === 'preview-only',
      ).length,
      unsupportedFamilies: unsupportedFamilies.length,
      families,
    },
    null,
    2,
  ),
)
