## MODIFIED Requirements

### Requirement: strict Codex Pet recipe schema
Recipe는 `schemaVersion: 1`, `kind: "livesd-recipe"`, `renderer: "livesd36-codex-pet@1"`, remote `source`, `pet` metadata, framing과 look 설정, 전체 수평 반전 설정, 그리고 모든 표준 Codex Pet 상태의 animation mapping을 포함해야 한다(MUST). Version 1의 renderer 값은 source별 runtime profile을 선택하는 기존 protocol token으로 유지되어야 한다(MUST). Top level, source, pet와 각 mapping은 정의된 field 외의 key를 거부해야 하며(MUST), `package`, `packageBase64`, `spritesheet`, `spritesheetBase64`, `zip`, `zipBase64`와 local path 또는 binary payload를 허용하지 않아야 한다(MUST). JavaScript UTF-16 `length` 기준 trim된 `displayName`은 1–80, `description`은 0–280, 각 animation 이름은 1–128, remote source ID는 안전한 1–128 단일 segment, custom asset base URL 문자열은 최대 2048여야 한다(MUST). STRR source는 `provider: "strr-res-pak"`, 1–8자리 numeric `characterId`와 그 character ID로 시작하는 1–16자리 numeric `editionId`만 허용해야 한다(MUST). Garupa source는 `provider: "garupa-pinned"`와 safe single-segment `sdAssetBundleName`만 허용해야 한다(MUST).

Version 1 parser는 누락된 `globalMirrorX`와 각 mapping의 `mirrorX`를 `false`, `framingScale`과 `lookMovementScale`을 `1.00`, X/Y offset을 각각 `0`으로 정규화해야 한다(MUST). Scale 값은 범위를 검사한 뒤 소수점 둘째 자리까지 반올림해야 하며(MUST), 새로 생성하는 recipe는 모든 canonical boolean과 framing·look 값을 명시해야 한다(MUST).

#### Scenario: 유효한 prsk-chibi-viewer recipe
- **WHEN** recipe source가 `provider: "prsk-chibi-viewer"`, safe `characterId`, 유효한 scale·offset과 전체 수평 반전 값을 가진다
- **THEN** CLI는 canonical prsk-chibi-viewer catalog와 pjsek.ai area_sd asset base를 사용해 모델 리소스를 찾는다
- **AND** headless renderer는 recipe의 scale, offset, 전체 반전과 상태별 반전을 웹 exporter와 동일하게 적용한다

#### Scenario: 유효한 custom provider recipe
- **WHEN** recipe source가 `provider: "custom"`, canonical HTTPS `assetBaseUrl`, safe `characterId`와 유효한 framing 값을 가진다
- **THEN** CLI는 해당 asset base의 `catalog.json`과 모델 리소스만 요청 대상으로 사용한다

#### Scenario: 유효한 STRR 고정 mirror recipe
- **WHEN** recipe source가 `provider: "strr-res-pak"`, 유효한 numeric `characterId`와 그 캐릭터에 속한 numeric `editionId`를 가진다
- **THEN** CLI renderer는 web integration과 같은 exact-commit STRR catalog를 읽고 해당 캐릭터 skeleton과 에디션 atlas·PNG만 요청해야 한다
- **AND** 전체·상태별 반전과 framing을 웹 exporter와 동일하게 적용하고 유효한 eye rig가 없으면 정적 look fallback으로 73-frame package를 생성해야 한다

#### Scenario: 유효한 Garupa pinned recipe
- **WHEN** recipe source가 `provider: "garupa-pinned"`와 safe `sdAssetBundleName`을 가진다
- **THEN** CLI renderer는 web integration과 같은 frozen provider manifest에서 해당 bundle의 shared skeleton과 costume atlas·PNG graph를 materialize해야 한다
- **AND** 전체·상태별 반전, framing과 dual-eye look 설정을 LiveSD (Spine 4.0) web exporter와 동일하게 적용해야 한다

#### Scenario: 잘못된 STRR source 관계
- **WHEN** STRR recipe의 ID가 숫자가 아니거나 `editionId`가 `characterId`로 시작하지 않는다
- **THEN** CLI는 remote request 전에 `RECIPE_INVALID`와 exit `2`로 거부해야 한다

#### Scenario: 잘못된 Garupa bundle ID
- **WHEN** Garupa recipe의 `sdAssetBundleName`이 비어 있거나 path separator, traversal 또는 128자를 초과하는 값을 포함한다
- **THEN** CLI는 remote request 전에 `RECIPE_INVALID`와 exit `2`로 거부해야 한다

#### Scenario: Optional framing 기본값
- **WHEN** 유효한 schema version 1 recipe에 전체·상태별 수평 반전, scale 또는 X/Y offset key가 없다
- **THEN** parser는 전체·누락 상태 반전을 `false`, framing과 look scale을 `1.00`, offset을 `0,0`으로 정규화한다
- **AND** 명시된 상태별 `mirrorX`와 유효한 framing 값은 보존한다

#### Scenario: Scale 정규화
- **WHEN** recipe가 범위 안의 `framingScale: 1.234` 또는 `lookMovementScale: 1.256`을 포함한다
- **THEN** parser는 각각 `1.23`, `1.26`으로 정규화해야 한다

#### Scenario: 잘못된 recipe offset
- **WHEN** recipe에 범위 밖, 비정수 또는 유한하지 않은 X/Y offset이 있다
- **THEN** CLI는 `RECIPE_INVALID`와 exit `2`를 반환하고 renderer를 시작하지 않는다

#### Scenario: binary inline recipe 거부
- **WHEN** recipe에 `spritesheet`, `spritesheetBase64`, `zip`, `zipBase64`, local path 또는 unknown top-level key가 있다
- **THEN** CLI는 `RECIPE_INVALID`와 exit `2`를 반환한다

### Requirement: recipe render and validation

CLI는 recipe를 `127.0.0.1`의 임의 port에서 제공되는 package-internal headless browser renderer에 전달해야 하며(MUST), renderer는 web app과 공유하는 remote resource loader, source runtime profile에 맞는 LiveSD frame sampler, Codex Pet exporter와 package validator를 사용해야 한다(MUST). PRSK·custom·STRR source는 LiveSD 3.6 경로를, Garupa pinned source는 official LiveSD (Spine 4.0) 경로를 사용해야 한다(MUST). Headless page의 default timeout과 navigation timeout은 180초로 설정해야 한다(MUST). Renderer가 반환한 payload는 설치 전에 `pet.json`과 `spritesheet.png` 두 파일이어야 하며(MUST), manifest ID와 spritesheet v2 계약을 통과해야 한다(MUST).

#### Scenario: recipe를 v2 Pet payload로 렌더링
- **WHEN** recipe source와 mappings가 유효하고 remote resources가 공유 browser validator를 통과한다
- **THEN** renderer는 `pet.json`과 `spritesheet.png` bytes를 반환하고 CLI는 해당 manifest ID를 destination ID로 사용한다

#### Scenario: Garupa runtime routing
- **WHEN** headless renderer가 `garupa-pinned` recipe를 받는다
- **THEN** renderer는 Garupa frozen materializer와 LiveSD (Spine 4.0) sampler를 정확히 한 번 사용한다
- **AND** LiveSD 3.6 sampler로 해당 source를 처리해서는 안 된다

#### Scenario: renderer browser 없음
- **WHEN** CLI가 usable Chromium/Chrome executable을 찾지 못한다
- **THEN** CLI는 `RENDER_BROWSER_MISSING`과 exit `3`을 반환하고 filesystem을 변경하지 않는다

#### Scenario: remote 또는 rendering failure
- **WHEN** catalog fetch, model fetch, WebGL rendering, PNG encoding 또는 v2 validation이 실패한다
- **THEN** CLI는 stable error code와 exit `3`을 반환하고 Codex home을 변경하지 않는다

## ADDED Requirements

### Requirement: Available provider CLI recipe parity

Game source registry의 모든 available provider는 하나 이상의 canonical CLI recipe provider ID를 선언해야 하며(MUST), 선언한 ID는 shared recipe parser가 지원해야 한다(MUST). 재현 가능한 remote source의 package validation이 성공하면 공통 builder는 provider와 관계없이 npx 설치 명령과 복사 action을 표시해야 하며(MUST), local-only source에는 실행 불가능한 명령을 표시해서는 안 된다(MUST NOT). Development harness는 available provider의 선언 누락과 unsupported provider ID를 자동으로 실패시켜야 한다(MUST).

#### Scenario: Available provider registry 검증
- **WHEN** development harness가 현재 game source registry를 검사한다
- **THEN** PRSK는 `prsk-chibi-viewer`와 `custom`, STRR는 `strr-res-pak`, Garupa는 `garupa-pinned` recipe provider를 선언해야 한다
- **AND** 각 선언은 shared parser의 canonical provider 집합에 포함되어야 한다

#### Scenario: Garupa pinned Pet 생성 완료
- **WHEN** 사용자가 pinned Garupa source로 package validation을 완료한다
- **THEN** ZIP download와 함께 `garupa-pinned` source를 담은 npx 설치 명령과 locale별 복사 action이 표시되어야 한다

#### Scenario: Garupa local ZIP Pet 생성 완료
- **WHEN** 사용자가 local Garupa ZIP source로 package validation을 완료한다
- **THEN** ZIP download는 표시되지만 remote source를 가장한 npx 설치 명령과 복사 action은 표시되어서는 안 된다
