## Why

LiveSD Pet Builder는 브라우저에서 검증된 Codex Pet v2 ZIP을 만들 수 있지만, 사용자가 결과물을 로컬 Codex home에 직접 풀어야 한다. 또한 웹에서 만든 결정을 복사해 `npx` 한 줄로 설치하려면 큰 PNG/ZIP bytes를 shell command에 넣는 대신, 캐릭터 source와 mapping 같은 결정값(recipe)을 CLI가 다시 실행할 수 있어야 한다.

## What Changes

- publish 가능한 구조의 Node.js CLI package `@chibi-to-codex-pet/cli`를 추가하되 npm registry에는 올리지 않고, 첫 설치 명령을 repo root에서 실행하는 `npm_config_cache=.npm-cache npx --yes --package ./packages/cli -- chibi-to-codex-pet install --recipe <recipe>`로 정의한다.
- recipe는 Pet bytes가 아니라 `renderer`, 원격 source provider, `characterId`, framing scale, metadata, 상태별 animation mapping과 mirror 결정을 담는다.
- CLI는 recipe를 strict parse하고, 허용된 원격 LiveSD 리소스를 받아 headless browser renderer에서 기존 브라우저 sampler/exporter/validator 계약을 재사용해 Codex Pet v2 payload를 생성한다.
- 생성된 `pet.json`과 `spritesheet.png`는 `${CODEX_HOME:-$HOME/.codex}/pets/<pet-id>`에 같은 filesystem의 staging directory를 거쳐 설치한다. 기존 설치는 `--force` 없이는 보존한다.
- 웹 UI는 원격 source로 생성한 Pet에 대해 다운로드 ZIP과 함께 복붙 가능한 `npx ... install --recipe ...` 명령을 제공한다. 로컬 파일 source는 bytes 없이 복구할 수 없으므로 recipe 명령을 제공하지 않는다.
- CLI package는 install-time lifecycle script를 두지 않고, raw PRSK asset이나 생성된 Pet bytes를 package 산출물에 포함하지 않는다. runtime network는 recipe가 가리키는 allowlisted HTTPS resource fetch에만 사용한다.

## Capabilities

### New Capabilities

- `npx-pet-installation`: recipe parsing, remote rendering, Codex home 해석, dry-run, 충돌 처리, transactional local install과 CLI 결과 계약
- `npm-pet-bundle`: local npx로 실행 가능한 CLI package 경계, headless renderer asset 포함, raw/generated Pet asset 비포함, browser requirement와 package 검증 계약

### Modified Capabilities

없음. 기존 `codex-pet-package-export` ZIP 산출물과 브라우저 v2 검증 계약은 renderer에서 재사용한다.

## Impact

- `packages/cli/`: CLI entrypoint, recipe loader, headless renderer launcher, filesystem installer
- `src/features/codex-pet/recipe.ts`: browser와 CLI가 공유하는 recipe schema, encode/decode, command formatter
- `src/features/codex-pet/recipeRenderer.ts`: headless browser에서 recipe를 v2 Pet payload로 렌더링하는 bridge
- `src/App.tsx`, `CodexPetBuilder`: 원격 source descriptor 전달 및 npx recipe command 표시
- workspace/build/test 설정: private 웹 앱과 publish 가능한 CLI workspace를 함께 검증
