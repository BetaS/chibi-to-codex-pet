# STRR pinned mirror source 명세

## Purpose

검증한 full Git commit에 고정된 `res-pak` 정적 미러에서 STRR character·edition catalog와 선택한 Spine 3.6 model만 읽는 provider 계약을 정의한다. Runtime은 저장소 밖 로컬 백업이나 acquisition API를 사용하지 않는다.

## Requirements

### Requirement: immutable STRR asset root

기본 STRR provider의 asset root는 `https://raw.githubusercontent.com/clyerick/res-pak/866b72570450d6e38d0d441d387d0a230d2cb70e/strr`여야 한다(MUST). Production과 일반 development integration은 full commit SHA가 포함된 이 root를 사용해야 하고(MUST), branch·tag·`refs/heads/` 또는 환경 변수로 교체되는 asset root를 사용해서는 안 된다(MUST NOT). Provider request는 호출자가 전달한 `AbortSignal`을 사용하고 고정 root resource에는 browser `force-cache` 정책을 요청해야 한다(MUST).

#### Scenario: mutable branch가 이동함
- **WHEN** `19f03de2` branch head가 다른 commit으로 이동한다
- **THEN** STRR catalog와 model URL은 계속 commit `866b72570450d6e38d0d441d387d0a230d2cb70e`를 포함해야 한다
- **AND** production artifact에는 STRR `refs/heads/` URL이 없어야 한다

#### Scenario: catalog URL 생성
- **WHEN** 기본 provider가 catalog를 불러온다
- **THEN** 정확히 `<asset-root>/catalog.json`을 request해야 한다
- **AND** request에는 현재 operation의 `AbortSignal`과 `cache: "force-cache"`가 포함되어야 한다

### Requirement: 보존 catalog 입력 검증

Catalog body는 UTF-8 JSON이고 1 byte 이상 2 MiB 이하여야 한다(MUST). Root는 `version: 1`, `gameId: "strr"`와 1–100개의 `characters`를 가져야 한다(MUST). Character ID는 고유한 1–8자리 숫자이고 각 character는 하나 이상의 edition을 가져야 하며(MUST), 전체 edition 수는 1,000 이하여야 한다(MUST). Edition ID는 전체 catalog에서 고유한 1–16자리 숫자이고 소속 character ID로 시작해야 하며(MUST), `side: "right"`와 `metadataSource: "karth" | "local"`을 가져야 한다(MUST). Character와 edition label은 `en`, `ja`, `ko`, `zh_hant` 중 하나 이상을 제공하고(MUST), 각 제공 label은 control character가 없는 Unicode code point 1–128자의 문자열이어야 한다(MUST).

#### Scenario: 유효한 character→edition catalog
- **WHEN** catalog가 character `101`과 edition `1010001`, 허용된 localized label, `side: "right"`를 제공한다
- **THEN** provider는 immutable character와 edition entry로 정규화해야 한다

#### Scenario: 잘못된 catalog identity
- **WHEN** character ID가 중복되거나 edition ID가 소속 character ID로 시작하지 않거나 전체 catalog에서 중복된다
- **THEN** provider는 `STRR_CATALOG_INVALID`로 catalog 전체를 거부해야 한다
- **AND** 일부 option을 UI에 노출해서는 안 된다

#### Scenario: catalog 크기 제한
- **WHEN** `content-length` 또는 실제 catalog body가 2 MiB를 초과하거나 body가 비어 있다
- **THEN** provider는 `STRR_CATALOG_LOAD_FAILED`로 실패해야 한다

### Requirement: locale별 보존 label 선택

STRR label resolver는 현재 app locale에 따라 아래 우선순위에서 첫 번째 존재하는 label을 사용해야 한다(MUST). 모든 허용 label이 없을 때만 호출자가 준 ID fallback을 사용해야 한다(MUST).

| App locale | Label 우선순위 |
|---|---|
| `ko` | `ko`, `en`, `ja`, `zh_hant` |
| `en` | `en`, `ja`, `ko`, `zh_hant` |
| `ja` | `ja`, `en`, `ko`, `zh_hant` |
| `zh-CN` | `zh_hant`, `en`, `ja`, `ko` |

#### Scenario: 현재 locale label 부재
- **WHEN** app locale은 `en`이고 entry에는 `ja` label만 있다
- **THEN** resolver는 ID fallback보다 `ja` label을 우선해야 한다

#### Scenario: 중국어 UI label
- **WHEN** app locale은 `zh-CN`이고 entry에 `zh_hant`와 `en` label이 있다
- **THEN** resolver는 보존 catalog의 `zh_hant` label을 표시해야 한다

### Requirement: 선택 model graph만 materialize

Model loader는 `characterId`와 `editionId`가 현재 검증된 catalog에서 같은 character에 속하는지 먼저 확인해야 한다(MUST). 유효한 선택에 대해서만 `characters/<characterId>/model_right.skel`, `editions/<editionId>/model_right.atlas`와 그 atlas가 상대 경로로 참조하는 PNG page를 고정 root에서 읽어야 한다(MUST). Skeleton은 1 byte 이상 8 MiB 이하, atlas는 유효한 UTF-8로 1 byte 이상 1 MiB 이하, page 수는 1–8개, PNG 전체 합계는 1 byte 이상 16 MiB 이하여야 한다(MUST). Atlas page는 안전하게 정규화되는 상대 경로이고 `.png` 확장자와 PNG signature를 가져야 한다(MUST).

#### Scenario: catalog에 없는 선택
- **WHEN** edition ID가 현재 character의 catalog entry에 없다
- **THEN** provider는 asset request 전에 `STRR_SELECTION_INVALID`를 반환해야 한다

#### Scenario: 대표 model URL graph
- **WHEN** character `101`, edition `1010001`의 atlas가 `model_right.png`를 참조한다
- **THEN** provider는 고정 root 아래의 `characters/101/model_right.skel`, `editions/1010001/model_right.atlas`, `editions/1010001/model_right.png`만 요청해야 한다
- **AND** 반환한 atlas bundle의 `atlasPath`는 `model_right.atlas`, `sourceName`은 `101:1010001`이어야 한다

#### Scenario: unsafe atlas page
- **WHEN** atlas가 source root 밖으로 나가는 path traversal, absolute filesystem path, 9개 이상의 page 또는 PNG가 아닌 page를 참조한다
- **THEN** provider는 해당 unsafe page를 사용하지 않고 `STRR_MODEL_INVALID`로 model 전체를 거부해야 한다

#### Scenario: model byte 제한
- **WHEN** skeleton, atlas 또는 누적 PNG body가 각 제한을 초과하거나 비어 있다
- **THEN** provider는 `STRR_MODEL_LOAD_FAILED`로 실패하고 부분 atlas bundle을 반환해서는 안 된다

### Requirement: runtime acquisition dependency와 로컬 백업 격리

표시 이름은 고정 mirror의 `catalog.json`에서만 읽고(MUST), catalog·model load 중 `karth.top` 또는 종료된 공식 asset server에 request를 보내서는 안 된다(MUST NOT). 저장소 밖 STRR archive와 Karth API snapshot은 오프라인 백업으로만 취급해야 하며(MUST), app code가 이를 읽거나 Vite development server와 production artifact에서 정적 resource로 제공해서는 안 된다(MUST NOT). Development server의 base-relative `/assets/strr*` 요청은 `404`와 `Cache-Control: no-store`로 응답해야 한다(MUST).

#### Scenario: runtime catalog와 model load
- **WHEN** 사용자가 catalog를 불러오고 캐릭터·에디션을 선택한다
- **THEN** STRR catalog와 model request target은 exact-commit `raw.githubusercontent.com/clyerick/res-pak/.../strr` resource로 제한되어야 한다
- **AND** Karth, 공식 종료 server와 로컬 백업 request는 0건이어야 한다

#### Scenario: 로컬 백업 URL 시도
- **WHEN** development server가 base path 아래 `/assets/strr`, `/assets/strr-*`, `/assets/strr.*` 또는 `/assets/strr/*` 요청을 받는다
- **THEN** filesystem fallback 전에 `404`와 `Cache-Control: no-store`를 반환해야 한다

### Requirement: provider UI와 production artifact 경계

STRR source UI는 보존한 character·edition catalog를 명시적으로 불러온다는 설명과 외부 정적 resource provider가 IP 주소·User-Agent 같은 일반적인 network metadata를 받을 수 있다는 고지를 표시해야 한다(MUST). UI에는 exact mirror URL, commit, `res-pak` provider 이름 또는 Karth acquisition 설명을 표시해서는 안 된다(MUST NOT). Production web·CLI artifact는 exact mirror origin·commit과 provider code를 포함하되(MUST), STRR skeleton, atlas, PNG, catalog/Karth response 또는 로컬 backup byte를 포함해서는 안 된다(MUST NOT).

#### Scenario: STRR source panel
- **WHEN** STRR source UI가 idle 상태로 표시된다
- **THEN** 사용자는 보존 catalog 설명과 network metadata 고지를 볼 수 있어야 한다
- **AND** raw GitHub URL, commit, `STRR · 고정된 res-pak 미러`, 날짜가 고정된 Karth API 설명은 보이지 않아야 한다

#### Scenario: production artifact 검사
- **WHEN** production web과 CLI renderer artifact를 검사한다
- **THEN** exact STRR mirror origin과 commit은 존재하고 mutable branch와 승인되지 않은 raw GitHub asset endpoint는 없어야 한다
- **AND** 로컬 백업의 model·catalog·Karth response byte는 없어야 한다

### Requirement: stable STRR provider 오류 계약

STRR provider는 아래 code만 알려진 provider 오류로 사용해야 한다(MUST). HTTP·network·size 실패는 catalog 또는 model load code로, catalog schema 실패는 catalog invalid code로, atlas text·page 검증 실패는 model invalid code로, catalog에 없는 pair는 selection invalid code로 구분해야 한다(MUST).

```text
STRR_CATALOG_INVALID
STRR_CATALOG_LOAD_FAILED
STRR_MODEL_INVALID
STRR_MODEL_LOAD_FAILED
STRR_SELECTION_INVALID
```

#### Scenario: HTTP model 실패
- **WHEN** skeleton, atlas 또는 PNG request가 non-success HTTP status를 반환한다
- **THEN** provider는 `STRR_MODEL_LOAD_FAILED`와 status를 포함한 message로 실패해야 한다
- **AND** 부분 model input을 반환해서는 안 된다

#### Scenario: malformed atlas text
- **WHEN** atlas가 유효한 UTF-8이 아니거나 page 목록을 해석할 수 없다
- **THEN** provider는 `STRR_MODEL_INVALID`로 실패해야 한다
