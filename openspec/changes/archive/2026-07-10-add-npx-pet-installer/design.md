## Context

사용자는 웹에서 만든 Codex Pet을 다운로드하거나, 복붙 가능한 `npx` 명령으로 설치하고 싶다. ZIP/PNG bytes를 command argument에 inline으로 넣는 방식은 크기, shell limit, clipboard 안정성과 히스토리 노출 때문에 부적합하다. 따라서 첫 버전의 핵심 계약은 "artifact 전달"이 아니라 "결정값(recipe) 전달 후 CLI 재생성"이다.

기존 renderer는 브라우저 DOM, WebGL, Canvas, Spine 3.6 runtime에 의존한다. Node 단독으로 같은 pixel 결과를 재구현하면 검증 표면이 커지므로, CLI는 headless browser를 열어 같은 browser sampler/exporter/validator code path를 실행한다.

## Goals / Non-Goals

**Goals:**

- `npm_config_cache=.npm-cache npx --yes --package ./packages/cli -- chibi-to-codex-pet install --recipe <base64url-json-or-url>` 한 줄로 원격 LiveSD recipe를 로컬 Codex home에 설치한다.
- recipe에는 PNG/ZIP bytes가 아니라 source provider, character ID, framing scale, metadata와 animation mapping만 담는다.
- 웹 UI는 remote source로 생성한 Pet에 대해 ZIP 다운로드와 recipe install command를 함께 제공한다.
- CLI는 생성된 Codex Pet v2 payload를 쓰기 전에 브라우저 validator로 검증하고, local install은 transactional하게 수행한다.
- npm tarball에는 CLI code와 renderer assets만 포함하고 raw source asset, generated Pet bytes, local credential을 포함하지 않는다.

**Non-Goals:**

- 로컬 ZIP/파일 source를 bytes 없이 recipe로 복구하지 않는다.
- Node native Canvas/WebGL renderer를 새로 구현하지 않는다.
- Codex desktop 설정, 선택 Pet 또는 실행 중인 desktop process를 자동 변경하지 않는다.
- npm publish, npm scope 생성, CI secret 설정을 자동화하거나 요구하지 않는다.
- 첫 버전에서 recipe registry backend, short token 저장소, remove/update command를 제공하지 않는다.

## Decisions

### 1. CLI surface는 recipe-first로 둔다

첫 공개 설치 surface는 다음 형태다.

```bash
npm_config_cache=.npm-cache npx --yes --package ./packages/cli -- chibi-to-codex-pet install --recipe <recipe>
```

`<recipe>`는 base64url encoded JSON, raw JSON 또는 HTTPS recipe URL을 허용한다. `install <pet-id>` catalog install은 이번 변경의 기본 흐름이 아니며, 공식 curated Pet이 필요해지면 별도 capability로 추가한다.

이 명령은 repo root에서 실행하는 local package spec을 사용하므로 npm registry publish가 필요 없다. 다른 PC에서는 `gh repo clone` 또는 `gh` 기반 pull 후 `pnpm verify:local-npx`가 dependency install, build, pack 검증, local npx version, recipe dry-run/install/reinstall smoke를 수행한다.

### 2. Recipe는 bytes가 아니라 재생성 결정값이다

schema version 1 recipe는 다음 정보를 가진다.

```json
{
  "schemaVersion": 1,
  "kind": "livesd-recipe",
  "renderer": "livesd36-codex-pet@1",
  "source": {
    "provider": "prsk-chibi-viewer",
    "characterId": "sd_mob003"
  },
  "pet": {
    "displayName": "Airi SD",
    "description": "",
    "framingScale": 0.9
  },
  "mappings": {
    "idle": { "animationName": "pose_default", "mirrorX": false },
    "running-left": { "animationName": "walk", "mirrorX": true }
  }
}
```

Custom provider는 `source.provider: "custom"`과 canonical HTTPS `assetBaseUrl`을 함께 가진다. Recipe는 catalog index만 단독으로 저장하지 않는다. Index가 필요해지는 경우에는 catalog snapshot hash와 함께 별도 schema revision으로 추가한다.

### 3. Headless browser renderer가 기존 browser exporter를 재사용한다

CLI는 package-internal renderer HTML을 loopback HTTP server로 제공하고 Playwright-compatible Chromium을 headless로 실행한다. Renderer page는 recipe를 받아 기존 remote loader, frame sampler, ZIP exporter와 package validator를 실행하고 `pet.json` 문자열과 `spritesheet.png` bytes를 CLI에 반환한다.

이 선택은 `playwright-core`와 사용 가능한 Chromium/Chrome을 runtime prerequisite로 만든다. CLI는 `CHIBI_TO_CODEX_PET_CHROMIUM` executable path, Playwright cache path, system Chrome/Chromium 후보 순서로 browser를 찾고, 찾지 못하면 실행 가능한 오류를 출력한다. npm install lifecycle script로 browser를 자동 다운로드하지 않는다.

### 4. Runtime network는 recipe resource fetch로 제한한다

Self-contained bundle 금지 대신, recipe mode는 원격 resource fetch가 본질이다. CLI/renderer는 다음만 fetch한다.

- recipe URL이 주어진 경우 해당 HTTPS JSON
- `prsk-chibi-viewer` catalog snapshot HTML/bundle과 `pjsek.ai` area_sd asset
- custom provider의 canonical HTTPS `assetBaseUrl` 아래 `catalog.json`, skeleton, atlas, PNG pages
- package-internal renderer가 제공하는 local loopback static files

Redirect, credentials, local/private host, query/fragment가 있는 asset base URL은 기존 remote validator와 같은 정책으로 거부한다.

### 5. Local install은 생성 bytes 기준으로 transactional하게 수행한다

Codex home 우선순위는 `--codex-home <absolute-path>`, 비어 있지 않은 absolute `CODEX_HOME`, `path.join(os.homedir(), ".codex")` 순서다. 목적지는 `<codex-home>/pets/<pet-id>`이고, pet ID는 생성된 manifest ID에서 온다.

설치 순서는 `parse recipe -> render and validate payload -> resolve home -> inspect destination -> dry-run or lock -> stage -> validate staged bytes -> commit -> unlock`이다. `--dry-run`은 render/validation과 destination 충돌 판정까지 수행하지만 filesystem을 변경하지 않는다. 동일한 두 파일은 idempotent success, 다른 기존 directory는 `--force` 없이는 보존한다.

### 6. Web command는 remote source에서만 제공한다

브라우저 app의 local source는 사용자의 local archive와 skeleton bytes에 의존하므로 command에 작은 recipe만 넣어 복구할 수 없다. 따라서 local source에서는 ZIP 다운로드만 제공한다. Remote source에서는 `source + mappings + metadata + framingScale`이 모두 recipe에 담기므로 ZIP 다운로드와 npx command를 함께 제공한다.

## Risks / Trade-offs

- [headless browser prerequisite] -> Node native renderer 재구현보다 pixel drift가 적다. browser 미설치 시 명확한 `RENDER_BROWSER_MISSING` 오류와 환경 변수 안내를 제공한다.
- [remote asset drift] -> recipe는 exact source ID를 저장하되 원격 provider bytes가 바뀌면 결과가 달라질 수 있다. Snapshot hash는 후속 schema revision 후보로 남긴다.
- [npx 실행 중 network 필요] -> recipe mode의 본질로 문서화하고, fetch 대상과 SSRF 방지 정책을 strict하게 제한한다.
- [large PNG가 Playwright protocol을 통과함] -> command에는 bytes를 넣지 않지만 renderer에서 CLI로는 내부 base64 transfer가 필요하다. Codex Pet v2 최대 PNG 크기 이내로 제한한다.

## Migration Plan

1. 기존 self-contained catalog OpenSpec을 recipe-first 계약으로 교체한다.
2. 공유 recipe schema와 web command formatter를 추가한다.
3. `packages/cli` workspace, CLI parser, headless renderer launcher와 installer를 구현한다.
4. Web remote source에서 recipe command를 표시한다.
5. CLI unit/integration test와 web test를 추가하고 typecheck/build/test를 실행한다.
