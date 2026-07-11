## 1. Recipe contract와 Web command

- [x] 1.1 공유 Codex Pet recipe schema, strict parser, base64url encode/decode와 `npx ... --recipe` command formatter를 추가한다.
- [x] 1.2 remote source activation에서 recipe source descriptor를 보존하고 local source에는 recipe command를 제공하지 않는다.
- [x] 1.3 CodexPetBuilder가 현재 metadata, framingScale, mappings와 remote source로 recipe command를 생성해 UI에 표시한다.
- [x] 1.4 recipe schema/parser/formatter와 remote-only UI behavior 테스트를 추가한다.

## 2. CLI workspace와 renderer package

- [x] 2.1 루트 `private: true`를 유지한 채 `packages/cli` pnpm workspace를 만들고 CLI package manifest, bin, files allowlist, lifecycle script 금지를 정의한다.
- [x] 2.2 CLI build entry, renderer Vite build entry, package-local typecheck/build/test script를 추가하고 root scripts에서 함께 실행한다.
- [x] 2.3 package-internal renderer가 기존 remote loader, frame sampler, exporter와 validator를 재사용해 recipe를 `pet.json`/`spritesheet.png` payload로 렌더링하게 한다.
- [x] 2.4 package renderer directory와 forbidden raw/generated asset 포함 여부를 검사하는 release check를 추가한다.

## 3. Recipe CLI command

- [x] 3.1 `install --recipe <base64url-json|json|https-url>`, `--help`, `--version`, `--codex-home`, `--dry-run`, `--force` parser를 구현한다.
- [x] 3.2 HTTPS recipe URL fetch와 strict recipe validation을 구현하고 unknown key, binary inline, local path와 unsupported provider를 거부한다.
- [x] 3.3 Playwright-compatible Chromium discovery, loopback static renderer server와 browser evaluate bridge를 구현한다.
- [x] 3.4 renderer/remote/WebGL/export/validation 실패를 stable CLI error code와 exit mapping으로 변환한다.

## 4. Transactional Codex home install

- [x] 4.1 `--codex-home` -> `CODEX_HOME` -> OS home 우선순위와 absolute path 검증을 구현한다.
- [x] 4.2 rendered payload의 manifest ID로 `<home>/pets/<id>` destination을 계산하고 dry-run 무변경 판정을 구현한다.
- [x] 4.3 동일 bytes no-op, conflict 보존, `--force` 교체, symlink/unexpected type 거부를 구현한다.
- [x] 4.4 same-filesystem lock, random stage, staged byte 재검증, atomic commit, backup rollback과 cleanup을 구현한다.
- [x] 4.5 CLI command, browser missing, dry-run, install/reinstall/conflict/force filesystem 테스트를 작성한다.

## 5. Documentation and verification

- [x] 5.1 README와 결정 기록에 recipe-first npx command, browser prerequisite, remote network boundary와 local-source limitation을 문서화한다.
- [x] 5.2 `pnpm install --frozen-lockfile`, typecheck, lint, unit/integration test, web build, CLI build와 release check를 실행해 결과를 기록한다.
- [x] 5.3 npm registry publish 없이 repo-local npx command를 생성하고, 다른 PC에서 pull 후 build/install/verify할 수 있는 `pnpm verify:local-npx` 스크립트를 추가한다.
