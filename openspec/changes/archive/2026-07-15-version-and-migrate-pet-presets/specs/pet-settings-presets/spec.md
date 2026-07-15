## MODIFIED Requirements

### Requirement: versioned Pet 설정 preset 저장소
웹 앱은 same-origin `localStorage`에 PRSK용 `chibi-to-codex-pet.pet-presets.prsk.v2`, STRR용 `chibi-to-codex-pet.pet-presets.strr.v2`, Garupa용 `chibi-to-codex-pet.pet-presets.garupa.v2` key를 각각 사용해 catalog schema version `2`인 Pet 설정 document를 저장해야 한다(MUST). 각 runtime의 catalog, `activePresetName`과 최대 20개 제한은 다른 runtime과 독립적이어야 한다(MUST). Document의 허용 field는 정확히 `version`, `activePresetName`, `presets`이고(MUST), 각 current preset의 허용 field는 `schemaVersion`, `description`, `displayName`, `framingOffset`, `framingScale`, `globalMirrorX`, `lookMovementScale`, `mappings`, `source`, `updatedAt`으로 제한해야 하며(MUST), `schemaVersion`은 `2`여야 한다(MUST). `source`는 `null`, `{ provider: "prsk-chibi-viewer", characterId }`, `{ provider: "custom", assetBaseUrl, characterId }`, `{ provider: "strr-res-pak", characterId, editionId }`, `{ provider: "garupa-pinned", sdAssetBundleName }` 중 하나여야 하며(MUST), non-null source provider는 저장 key의 runtime과 일치해야 한다(MUST). Preset key는 trim된 Pet 표시 이름과 정확히 같아야 하며(MUST), JavaScript UTF-16 `length` 기준 표시 이름은 1–80, 설명은 0–280, 각 animation 이름은 trim 후 1–512 범위여야 한다(MUST). `updatedAt`은 0 이상 `Number.MAX_SAFE_INTEGER` 이하의 정수 millisecond 값이어야 한다(MUST). Package byte·blob URL과 local upload 파일 내용·이름·경로는 session memory에서만 다뤄야 한다(MUST).

```json
{
  "version": 2,
  "activePresetName": "Pet name or null",
  "presets": {
    "Pet name": {
      "schemaVersion": 2,
      "displayName": "Pet name",
      "description": "",
      "framingScale": 1,
      "framingOffset": { "x": 0, "y": 0 },
      "lookMovementScale": 1,
      "globalMirrorX": false,
      "source": {
        "provider": "prsk-chibi-viewer",
        "characterId": "sd_21miku_normal"
      },
      "mappings": {
        "idle": { "animationName": "pose_default", "mirrorX": false },
        "running-right": { "animationName": "walk", "mirrorX": true },
        "running-left": { "animationName": "walk", "mirrorX": false },
        "waving": { "animationName": "wave", "mirrorX": false },
        "jumping": { "animationName": "jump", "mirrorX": false },
        "failed": { "animationName": "sad", "mirrorX": false },
        "waiting": { "animationName": "wait", "mirrorX": false },
        "running": { "animationName": "work", "mirrorX": false },
        "review": { "animationName": "review", "mirrorX": false }
      },
      "updatedAt": 0
    }
  }
}
```

`mappings`에는 표준 9개 상태가 모두 정확히 한 번 존재해야 하고(MUST), 각 상태 object는 `animationName`, `mirrorX`만 포함해야 한다(MUST). Framing과 look 값은 각 capability의 정수·범위 계약을 그대로 따라야 한다(MUST). 알 수 없는 field가 document envelope에 있으면 전체 저장 document를 손상된 값으로 처리해야 한다(MUST). Preset entry에 알 수 없는 field, 지원하지 않는 `schemaVersion`, unsafe source, 누락 상태 또는 범위 오류가 있으면 그 entry 전체를 current catalog와 selector에서 제외해야 하며(MUST), 같은 document의 다른 유효 entry까지 제외해서는 안 된다(MUST NOT).

#### Scenario: 원격 source preset 저장
- **WHEN** provided 또는 custom 원격 캐릭터를 사용한 Pet build가 성공한다
- **THEN** 저장 document에는 current catalog·preset version, 현재 설정, 갱신 시각과 검증된 provider·character 식별자가 기록되어야 한다
- **AND** custom provider일 때만 정규화된 asset base URL을 함께 기록해야 한다
- **AND** model byte, package blob 또는 download URL이 포함되어서는 안 된다

#### Scenario: STRR 에디션 source preset 저장
- **WHEN** STRR 고정 provider의 캐릭터와 에디션으로 Pet build가 성공한다
- **THEN** `source`에는 `provider: "strr-res-pak"`과 검증된 numeric `characterId`, 그 캐릭터에 속한 numeric `editionId`가 기록되어야 한다
- **AND** 고정 mirror URL, catalog 또는 model byte를 preset에 기록해서는 안 된다

#### Scenario: Garupa pinned source preset 저장
- **WHEN** Garupa 고정 provider의 검증된 model로 Pet build가 성공한다
- **THEN** `source`에는 `provider: "garupa-pinned"`과 안전한 단일 segment `sdAssetBundleName`이 기록되어야 한다
- **AND** provider URL, manifest, catalog 또는 model byte를 preset에 기록해서는 안 된다

#### Scenario: local upload preset 저장
- **WHEN** local upload 파일을 사용한 Pet build가 성공한다
- **THEN** `source`는 `null`이어야 한다
- **AND** file 내용·이름·경로를 저장해서는 안 된다

#### Scenario: strict preset entry 격리
- **WHEN** 한 저장 preset에 허용하지 않은 source field, 안전하지 않은 character ID, 알 수 없는 상태, 누락된 상태, 지원하지 않는 preset version 또는 허용 범위를 벗어난 값이 있고 같은 catalog에 다른 유효 preset이 있다
- **THEN** 시스템은 잘못된 preset을 부분 적용하거나 selector에 표시하지 않아야 한다
- **AND** 유효한 다른 preset과 그 설정은 current catalog에 보존해야 한다

#### Scenario: 같은 이름 덮어쓰기
- **WHEN** 이미 preset이 있는 trim된 Pet 이름으로 다른 유효 설정의 build가 성공한다
- **THEN** 시스템은 같은 key의 preset을 최신 current schema 설정으로 교체해야 한다
- **AND** selector에 같은 이름을 중복 추가해서는 안 된다

#### Scenario: bounded catalog
- **WHEN** 20개 preset이 있는 저장소에 새 이름의 성공 build를 저장한다
- **THEN** 시스템은 가장 오래 갱신된 preset을 제거하고 새 preset을 저장해야 한다
- **AND** document는 20개를 초과해서는 안 된다

#### Scenario: 저장 catalog 정렬
- **WHEN** 저장 document를 읽거나 새 preset을 추가한다
- **THEN** 시스템은 유효한 preset을 `updatedAt` 내림차순으로 정렬하고 앞의 20개만 유지해야 한다

### Requirement: runtime별 preset catalog 격리와 legacy 이관
PRSK, STRR와 Garupa integration은 자기 current runtime `.v2` key만 operational preset repository로 읽고 써야 한다(MUST). 한 runtime에서 preset을 저장·선택하거나 `새 세션`으로 전환해도 다른 runtime의 catalog와 active 선택을 변경해서는 안 된다(MUST NOT). Current runtime key가 없을 때만 같은 runtime의 `.v1` key를 첫 번째 read-only migration source로 사용하고(MUST), runtime `.v1`도 없을 때만 이전 공용 `chibi-to-codex-pet.pet-presets.v1` document를 두 번째 read-only migration source로 사용해야 한다(MUST). Version 1 entry는 기존 exact schema와 값 범위를 항목별로 통과한 경우에만 `schemaVersion: 2` preset으로 승격해야 하며(MUST), source가 누락된 version 1 entry는 `null`로 정규화해야 한다(MUST). Runtime `.v1` entry는 그 runtime에 속한 source 또는 `source: null`일 때 해당 runtime으로 이관해야 한다(MUST). 공용 `.v1` entry는 `prsk-chibi-viewer`·`custom`이면 PRSK, `strr-res-pak`이면 STRR, `garupa-pinned`이면 Garupa로 분리하고(MUST), source가 없는 entry는 PRSK로만 이관해야 한다(MUST). Migration 결과는 비어 있어도 current `.v2` key에 한 번 기록해야 하며(MUST), legacy key를 삭제·수정하거나 이후 save·active 선택을 legacy key에 쓰면 안 된다(MUST NOT). Current key가 존재하면 손상 또는 미지원 catalog여도 legacy source로 fallback해서는 안 된다(MUST NOT).

#### Scenario: 게임 탭 전환 시 preset 격리
- **WHEN** PRSK, STRR와 Garupa에 서로 다른 active preset이 저장된 상태에서 사용자가 게임 탭을 전환한다
- **THEN** 각 dropdown에는 현재 runtime의 유효한 current preset만 표시되어야 한다
- **AND** 이전 runtime의 preset 이름, source, 전체 반전과 active 선택을 새 runtime에 재사용해서는 안 된다

#### Scenario: 한 runtime에서 새 세션 선택
- **WHEN** 사용자가 Garupa preset dropdown에서 `새 세션`을 선택한다
- **THEN** Garupa active preset만 `null`이 되어야 한다
- **AND** PRSK와 STRR의 catalog와 active preset은 그대로 유지되어야 한다

#### Scenario: runtime version 1 catalog 이관
- **WHEN** current runtime `.v2` key는 없고 같은 runtime `.v1` catalog에 유효 entry와 이관할 수 없는 entry가 함께 있다
- **THEN** 시스템은 유효 entry만 `schemaVersion: 2`로 승격해 current `.v2` key와 dropdown에 기록해야 한다
- **AND** 이관할 수 없는 entry는 표시·적용하지 않고 legacy `.v1` key는 변경하지 않아야 한다

#### Scenario: 공용 legacy catalog 분리 이관
- **WHEN** current와 runtime별 legacy key가 없고 이전 공용 catalog에 PRSK, STRR, Garupa provider preset이 함께 있다
- **THEN** 각 integration은 유효한 자기 provider preset만 current runtime key로 이관해야 한다
- **AND** 이관 뒤 어느 runtime dropdown에도 다른 runtime source 또는 이관 불가능한 preset이 나타나서는 안 된다

#### Scenario: current key 우선
- **WHEN** current `.v2` key가 이미 존재하고 legacy `.v1` key에도 과거 preset이 남아 있다
- **THEN** 시스템은 current key만 operational source로 사용해야 한다
- **AND** current에서 삭제되었거나 숨겨진 preset을 legacy key에서 다시 표시해서는 안 된다

### Requirement: 저장소 오류 복구
지원하지 않는 catalog version, 손상된 JSON, 알 수 없는 document field 또는 유효하지 않은 catalog envelope는 적용되어서는 안 된다(MUST NOT). Current key의 envelope 읽기 또는 parse 실패는 해당 current runtime key를 제거하려고 시도한 뒤 `{ version: 2, activePresetName: null, presets: {} }`로 교체해 복구해야 하며(MUST), legacy key로 fallback해서는 안 된다(MUST NOT). Envelope가 유효하면 유효하지 않거나 지원하지 않는 preset entry만 parsed catalog에서 제외하고 다른 유효 entry를 유지해야 한다(MUST). Document가 유효하지만 `activePresetName`이 제외됐거나 catalog에 없으면 preset은 보존하고 active 선택만 `null`로 정규화해야 한다(MUST). 유효한 current catalog의 단순 read는 storage write를 시작해서는 안 된다(MUST NOT). Storage read·write·remove가 예외를 발생시켜도 앱 mount, 현재 preview와 build session은 계속 동작해야 한다(MUST).

#### Scenario: 손상된 current document
- **WHEN** current preset storage가 JSON이 아니거나 지원하지 않는 catalog version을 가진다
- **THEN** 시스템은 이를 빈 version 2 catalog로 취급하고 가능한 경우 손상된 current runtime key를 빈 version 2 document로 교체해야 한다
- **AND** legacy preset을 되살리지 않고 앱은 기본 새 세션으로 계속 동작해야 한다

#### Scenario: 지원하지 않는 preset entry
- **WHEN** version 2 envelope 안에 current preset과 지원하지 않는 `schemaVersion` preset이 함께 있다
- **THEN** current preset만 dropdown과 적용 경로에 제공해야 한다
- **AND** 지원하지 않는 preset을 추측해 적용하거나 유효 preset을 제거해서는 안 된다

#### Scenario: 존재하지 않는 active preset
- **WHEN** document schema와 일부 preset은 유효하지만 `activePresetName`이 제외됐거나 `presets`에 존재하지 않는다
- **THEN** 유효한 preset catalog를 유지하고 active 선택만 `null`인 새 세션으로 복원해야 한다

#### Scenario: 유효 current catalog read
- **WHEN** current catalog와 active preset이 모두 유효한 상태로 integration이 mount한다
- **THEN** dropdown 대기 선택을 복원하되 storage write, network, file access와 preview 생성은 0건이어야 한다

#### Scenario: storage 쓰기 차단
- **WHEN** migration 또는 성공 build 뒤 `localStorage.setItem`이 보안 또는 quota 오류를 발생시킨다
- **THEN** 생성된 package, current builder 설정과 in-memory parsed catalog는 유지되어야 한다
- **AND** 오류가 preview 또는 download 결과를 무효화해서는 안 된다
