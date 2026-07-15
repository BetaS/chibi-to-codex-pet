## Context

`CodexPetBuilder`는 검증된 package 결과와 `recipeSource`가 함께 있을 때만 npx 설치 명령을 만든다. PRSK remote와 STRR pinned integration은 source identity를 전달하지만 Garupa integration은 이미 `garupa-pinned` preset identity를 보존하면서도 `recipeSource={null}`을 전달한다. Shared recipe parser와 CLI renderer도 PRSK·custom·STRR만 분기하므로 UI wiring만 바꾸면 실행 불가능한 명령이 생긴다.

GitHub Star 구현은 download link의 첫 클릭 뒤 modal을 여는 builder-local 기능이다. 이 때문에 검증된 Pet 생성이 끝나도 다운로드 전에는 contextual 안내가 보이지 않는다. App header에는 repository action이 없으며 기존 main spec도 modal만 설명한다. 이전 외부 tracking 점검 요구를 고려하면 상단 action은 외부 script나 mount-time API 호출 없이 동작해야 한다.

## Goals / Non-Goals

**Goals:**

- Garupa pinned source를 strict recipe로 직렬화하고 web과 CLI에서 같은 source graph·framing·mapping·LiveSD (Spine 4.0) sampling 결과를 사용한다.
- 모든 available provider가 재현 가능한 remote recipe capability를 registry에 선언하고 development harness가 누락을 발견하게 한다.
- 검증된 Garupa pinned Pet에서 공통 CLI 명령·복사 UX를 표시하고 local ZIP에서는 표시하지 않는다.
- App header에 항상 보이는 locale별 GitHub Star 링크를 제공하고, contextual modal은 검증된 Pet 생성 완료 직후 한 번 표시한다.
- CLI renderer package에 provider 원본 asset이나 captured response를 포함하지 않는다.

**Non-Goals:**

- Garupa local ZIP을 recipe에 inline하거나 local path를 CLI에 전달하지 않는다.
- Recipe schema version 또는 기존 `livesd36-codex-pet@1` protocol token을 변경하지 않는다.
- GitHub Star count 조회, GitHub API, iframe, 외부 badge/widget 또는 analytics event를 추가하지 않는다.
- Provider 실제 asset을 사용하는 CI smoke를 추가하지 않는다.

## Decisions

### `garupa-pinned`을 기존 recipe source union에 통합한다

Recipe source에 `{ provider: "garupa-pinned", sdAssetBundleName }` variant를 추가한다. Bundle name은 기존 preset과 같은 최대 128자의 safe single segment 규칙으로 parse하고 unknown field와 binary payload를 거부한다. Settings preset은 별도의 유사 source shape를 유지하는 대신 canonical recipe source type과 parser를 재사용한다.

Local ZIP을 base64 또는 path recipe로 만드는 대안은 recipe의 remote-only·binary 비포함 계약과 CLI의 다른 machine 재현성을 깨므로 채택하지 않는다.

### Stable protocol token은 유지하고 source가 runtime profile을 선택한다

Schema version 1의 `renderer: "livesd36-codex-pet@1"`은 기존 command 호환성을 위한 stable protocol token으로 유지한다. CLI composition root는 PRSK·custom·STRR에 기존 LiveSD 3.6 sampler를, `garupa-pinned`에는 public Garupa facade의 frozen materializer와 official LiveSD (Spine 4.0) sampler를 선택한다. 두 경로는 같은 package exporter와 validator로 합류한다.

Token을 즉시 rename하거나 schema version 2로 올리는 대안은 저장·공유된 기존 recipe를 불필요하게 깨므로 채택하지 않는다. Runtime 분기는 source discriminant와 unit test로 고정한다.

### Provider registry가 CLI recipe 지원 범위를 선언한다

Available game source definition에 non-empty `cliRecipeProviders`를 추가한다. PRSK는 `prsk-chibi-viewer`와 `custom`, STRR는 `strr-res-pak`, Garupa는 `garupa-pinned`을 선언한다. Development harness는 모든 available source의 목록이 canonical supported provider 집합의 부분집합인지 검사한다. Builder는 현재 `recipeSource` provider를 진단 가능한 data attribute로 노출하고 Garupa integration test가 pinned activation wiring을 검증한다.

Provider별 문자열을 test에만 중복하는 대안보다 registry metadata가 제품 activation과 capability audit를 한 위치에서 검토할 수 있어 drift를 더 일찍 발견한다. 실제 command 생성은 계속 공통 builder가 소유한다.

### Header Star는 shared repository URL을 사용하는 native anchor다

Repository URL을 provider와 무관한 shared constant로 옮기고 App header action에 native anchor를 렌더링한다. Visible label과 새 탭 동작을 알리는 accessible name은 locale catalog를 사용하며 `target="_blank"`, `rel="noreferrer"`를 적용한다. Link 자체에는 script, iframe, count fetch와 click handler를 두지 않는다.

GitHub badge script나 REST API count는 외부 code·요청·rate limit·privacy surface를 추가하므로 채택하지 않는다.

### Star modal은 첫 번째 성공한 Pet 생성 직후 연다

Package export와 독립 validation이 모두 성공해 builder result와 `ready` phase가 확정되는 시점에 Star modal을 연다. `starPromptShownRef`는 같은 builder 작업 세션의 첫 성공만 허용하며, modal을 닫은 뒤 재생성하거나 ZIP 링크를 반복 클릭해도 다시 열지 않는다. 다운로드 handler는 기존 Blob download와 `pet_zip_download` 분석 이벤트만 유지한다.

샘플링·packaging·validation 중이거나 취소·실패한 경우에는 결과물이 완성되지 않았으므로 modal을 열지 않는다. 자동으로 열린 modal을 닫으면 focus는 바로 사용할 수 있게 된 ZIP 다운로드 링크로 이동한다.

### Generated CLI renderer와 repository boundary를 함께 검증한다

Shared renderer source 변경 뒤 `packages/cli/renderer`만 재빌드해 hashed asset과 HTML을 갱신한다. Package dry-run 검증과 repository boundary harness로 provider asset byte, source map, test·source file이 package에 들어가지 않았는지 확인한다. 기존 staged CLI 0.2 executable 변경은 renderer rebuild와 분리한다.

## Risks / Trade-offs

- [Garupa runtime 추가로 CLI renderer bundle이 커짐] → runtime은 build asset으로 묶되 provider 원본 자료는 포함하지 않고 `verify:pack`과 production artifact 검사를 통과시킨다.
- [Legacy renderer token이 runtime 이름과 다름] → schema compatibility token으로 명시하고 source discriminant별 sampler routing test를 유지한다.
- [Registry 선언과 integration wiring이 따로 drift할 수 있음] → global harness의 선언 검사와 provider integration의 active recipe marker, builder command test를 함께 둔다.
- [Header와 생성 완료 modal의 Star action이 중복됨] → header는 항상 보이는 낮은 강조도의 진입점, modal은 첫 성공 직후 한 번만 표시되는 contextual action으로 역할을 분리한다.
- [완료 modal이 다음 동작을 가릴 수 있음] → 즉시 닫기·Escape를 지원하고 닫은 뒤 새 ZIP 다운로드 링크로 focus를 이동하며 같은 세션에서는 반복 노출하지 않는다.

## Migration Plan

Data migration은 없다. Parser는 기존 schema version 1 recipe를 그대로 수용하면서 새 source variant를 추가한다. Shared source·renderer·web wiring과 generated renderer bundle을 함께 배포한다. 문제가 있으면 Garupa recipe variant와 integration wiring만 제거해 기존 PRSK·STRR CLI와 Star modal을 유지할 수 있다.

## Open Questions

없음.
