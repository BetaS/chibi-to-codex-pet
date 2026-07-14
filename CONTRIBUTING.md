# LiveSD Pet Builder에 기여하기

버그 보고, 문서 개선, 테스트와 기능 기여를 환영합니다. 이 프로젝트는 사용자 모델 asset, 외부 provider, WebGL renderer와 Codex 설치 경로를 함께 다루므로 제품 계약과 검증 절차를 코드 변경과 함께 관리합니다.

## 1. 시작하기

Node.js `22.13.0` 이상과 pnpm `11`을 준비한 뒤 저장소를 설치합니다.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

작업 전에 관련 issue와 `openspec/specs/`의 현재 계약을 확인하세요. 큰 기능, 공개 API, recipe·manifest·파일 형식, network·보안 경계 또는 dependency major version 변경은 issue에서 범위를 먼저 합의합니다.

## 2. 변경 유형과 OpenSpec

다음 변경은 `openspec/changes/<change-name>/`에 proposal, design, delta spec과 tasks를 작성합니다.

- 사용자에게 보이는 동작이나 workflow
- 공개 type, provider 계약, recipe 또는 package 형식
- persistence, network, filesystem 또는 보안 경계
- 여러 capability에 걸친 구조 변경

오탈자, 설명 보강, 기존 계약을 그대로 구현하는 작은 버그 수정은 별도 change 없이 진행할 수 있습니다. 동작 계약이 달라지면 구현과 함께 main spec을 동기화하고, 검증이 끝난 change는 archive합니다.

```bash
openspec validate <change-name> --strict
openspec validate --specs --strict
```

### 명세 작성 원칙

- `openspec/specs/`는 사용자가 지금 기대할 수 있는 동작만 설명합니다.
- `openspec/changes/archive/`는 제안, 대안, 결정 과정과 완료된 migration 이력을 보관합니다.
- Purpose에는 capability의 사용자 가치, 입력과 결과를 짧게 설명합니다.
- Requirement에는 검증 가능한 현재 계약을 `MUST`, `SHOULD`, `MAY`로 작성합니다.
- Scenario에는 특정 입력과 관찰 가능한 결과를 `WHEN`/`THEN`으로 작성합니다.
- Main spec에서는 회의 기록, 사람 이름, 선택되지 않은 대안과 과거 선택을 비교하는 설명을 생략합니다.
- 보안·개인정보·파일 형식 제한은 허용 범위와 실패 결과가 드러나는 규범 문장으로 유지합니다.
- 캐릭터별 bug fixture는 일반 제품 계약으로 표현하고, 구체적인 회귀 데이터는 test 또는 archived change에 둡니다.

처음 명세를 작성한다면 [OpenSpec 안내](openspec/README.md)의 용어와 capability map을 먼저 확인하세요.

## 3. Branch와 commit

Branch 이름은 `feat/`, `fix/`, `docs/`, `test/`, `refactor/` 중 하나와 짧은 kebab-case 설명을 사용합니다.

Commit은 한 가지 검토 목적을 담고 다음 prefix 중 하나로 시작합니다.

```text
feat: fix: docs: test: refactor: chore:
```

기능, dependency update와 관련 없는 refactor는 각각 독립된 PR로 제출해 주세요. Review가 시작된 뒤에는 변경 내용을 새 commit으로 추가하면 reviewer가 수정 범위를 추적하기 쉽습니다.

## 4. 코드와 구조 경계

- PRSK 전용 구현은 `src/features/livesd/prsk/`가 소유합니다.
- 공통 LiveSD adapter, sampler와 Codex Pet exporter는 게임 integration에 독립적으로 유지합니다.
- Browser preview와 headless recipe renderer는 projection, sampler와 package validator를 공유합니다.
- 사용자에게 보이는 문자열과 ARIA 이름은 `ko`, `en`, `ja`, `zh-CN` catalog에 같은 key로 추가합니다.
- Stable error code는 영문 상수로 유지하고 UI에는 locale별 설명과 해결 방법을 제공합니다.
- 새 network 동작에는 사용자 trigger, 허용 origin, timeout, size limit, abort, credential과 referrer 정책을 함께 명세하고 테스트합니다.
- 코드 주석은 불변식, 좌표 계약, 보안 이유처럼 코드만으로 드러나지 않는 사실을 설명합니다.

### Provider integration development harness

이 항목은 제품 기능을 정의하는 OpenSpec이 아니라, provider 구현이 서로 다른 방향으로 drift하지 않도록 막는 development merge gate입니다. `available`로 등록하는 모든 provider는 provider별 catalog 정규화, asset materialization, runtime adapter, 오류 변환과 기본값만 소유하고 아래 공통 capability surface는 공유 모듈을 조합해 제공해야 합니다.

- preset 복원
- 사용자가 명시적으로 실행하는 catalog load
- catalog load 뒤 활성화되는 캐릭터 → 모델 순서의 검색 선택
- 공통 framing, animation 선택과 state shortcut
- preview canvas와 Codex Pet builder
- mount 또는 remount만으로 network/resource load를 시작하지 않는 idle lifecycle

공통 capability의 UI 또는 상태 계약을 바꿀 때는 먼저 `src/features/`의 공유 component·hook·contract를 수정하고 모든 provider에 동시에 적용합니다. Provider 내부에 공유 control을 복사해 별도 동작으로 발전시키거나 provider별 예외 allowlist로 검사를 우회하지 않습니다. Runtime 또는 source lifecycle 차이 때문에 orchestration을 공유할 수 없는 부분은 provider 경계에 남길 수 있지만, 위 capability surface와 사용자 관찰 순서는 유지합니다.

새 provider를 `GAME_SOURCES`에 `available`로 추가하면 `src/features/providerIntegrationHarness.test.tsx`가 별도 case 등록 없이 해당 integration을 자동 검사합니다. 다음 명령은 capability 누락·중복, 초기 disabled 순서와 암묵적 network 요청을 검사하며 production build에도 포함된 필수 gate입니다.

```bash
pnpm verify:provider-harness
```

Provider가 추가될 때 repository·package·CI 경계도 자동으로 적용됩니다. Provider API response body와 실제 model/archive byte는 추적하지 않으며, acquisition·backup·변환·실자산 검증 script는 `*.local.mjs` 또는 `*.local.py`, 실제 provider smoke는 `*.local.spec.ts`로만 보존합니다. 이 파일들은 `.gitignore` 대상이고 root package script나 CI workflow에서 직접 호출하지 않습니다.

```bash
pnpm verify:repository-boundary
```

기본 `pnpm test:e2e`는 `*.local.spec.ts`를 제외합니다. 개발자가 적법하게 준비한 private fixture와 ignored local spec이 있는 경우에만 `pnpm test:e2e:local`을 명시적으로 실행합니다. Synthetic/intercepted response로 같은 contract를 검증할 수 있는 테스트는 CI-safe suite에 유지합니다.

## 5. Asset, 개인정보와 supply chain

Commit에 포함할 수 있는 파일은 기여자가 배포 권리를 보유하고 공개 저장소에 적합한 자료로 제한됩니다.

- `.env`, token, cookie, credential, 개인 hostname, tunnel URL, Sites project ID와 실제 Codex home path는 local 설정으로 관리합니다.
- `.skel`, atlas, PNG, ZIP과 생성 Pet은 재배포 권리가 명시된 test fixture만 사용할 수 있습니다.
- Provider API의 캡처 응답, Karth snapshot, character catalog dump와 PRSK·STRR·Garupa 원본 model pack은 source, test fixture, QA evidence 또는 package로 commit하지 않습니다.
- Provider repository·immutable commit·URL·web viewer 연결, schema, digest, byte 수와 license 같은 provenance metadata는 실제 응답·asset byte를 포함하지 않는 범위에서 추적할 수 있습니다.
- Provider 자료를 fetch, backup, decrypt, convert, install 또는 실제 byte로 inspect하는 도구와 결과는 ignored local 파일 또는 repository 밖에 둡니다.
- Production source와 bundle의 resource 목록은 runtime provider 계약을 따르며 사용자 URL이나 character 선택을 고정 데이터로 포함하지 않습니다.
- Remote document는 data로 검증하며 `eval`, `Function`, script injection과 dynamic import 실행 경로에 연결하지 않습니다.
- Size, path, origin, alpha, geometry와 package validator는 외부 입력에 동일하게 적용합니다.
- `third_party/` 변경에는 upstream commit, file hash, 원문 license와 `THIRD_PARTY_NOTICES.md` 갱신을 포함합니다.

Generated `dist/`, test result, screenshot, local cache, 개인 IDE 설정과 local hosting 설정은 commit 범위에서 제외합니다.

## 6. 검증

모든 PR은 다음 검사를 통과해야 합니다.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm verify:repository-boundary
pnpm build
openspec validate --specs --strict
```

변경 범위에 따라 다음 검사를 추가합니다.

| 변경 범위 | 추가 검사 |
|---|---|
| UI, WebGL, resource loading, download, install | `pnpm test:e2e` |
| CLI package 또는 recipe renderer | `pnpm --filter chibi-to-codex-pet verify:pack` |
| Vendored runtime | `pnpm verify:runtime` |
| OpenSpec change | `openspec validate <change-name> --strict` |

권리 제한 fixture가 필요한 `*.local.spec.ts`는 PR과 CI 범위에 넣지 않습니다. Local에서 실행하지 못한 실제 provider 검증이 있다면 PR에 test 목적과 이유를 기록하되 파일·경로·asset metadata는 첨부하지 않습니다. 테스트 수정은 새 동작 계약을 명확히 표현해야 하며 검증 범위를 약화시키지 않아야 합니다.

## 7. Pull request checklist

PR 설명에 다음 정보를 포함해 주세요.

- 해결하는 문제와 사용자 영향
- 구현 방식과 변경 범위
- 관련 issue와 OpenSpec change
- 실행한 검증 명령과 결과
- UI 변경의 screenshot 또는 짧은 영상
- Network, 개인정보, filesystem, asset과 license 영향
- 남아 있는 위험과 실행하지 못한 검증

작고 독립적으로 검토할 수 있는 PR이 가장 빠르게 review됩니다. Review comment에는 반영한 commit이나 판단 근거를 연결해 주세요.

## 8. 기여 라이선스

기여자는 제출하는 코드, 문서와 fixture를 제공할 권리를 보유해야 합니다. PR을 제출하면 해당 기여를 저장소의 [MIT License](LICENSE)로 배포하는 데 동의하는 것으로 간주합니다. Third-party code나 asset이 필요하면 관련 issue에서 provenance와 license를 먼저 공유해 주세요.
