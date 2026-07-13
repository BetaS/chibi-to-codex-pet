# Pet 설정 preset 명세

## Purpose

사용자는 성공적으로 생성한 Pet의 렌더링 설정과 다시 불러올 수 있는 원격 캐릭터 식별자를 이름별 preset으로 저장하고 다음 browser session에서 명시적으로 복원할 수 있다. Local upload preset은 browser가 파일을 다시 읽을 권한이 없으므로 설정만 복원하고 파일 선택을 기다린다.

## Requirements

### Requirement: versioned Pet 설정 preset 저장소
웹 앱은 same-origin `localStorage`에 PRSK용 `chibi-to-codex-pet.pet-presets.prsk.v1`, STRR용 `chibi-to-codex-pet.pet-presets.strr.v1`, Garupa용 `chibi-to-codex-pet.pet-presets.garupa.v1` key를 각각 사용해 schema version `1`인 Pet 설정 document를 저장해야 한다(MUST). 각 runtime의 catalog, `activePresetName`과 최대 20개 제한은 다른 runtime과 독립적이어야 한다(MUST). Document의 허용 field는 정확히 `version`, `activePresetName`, `presets`이고(MUST), 각 preset의 허용 field는 `description`, `displayName`, `framingOffset`, `framingScale`, `globalMirrorX`, `lookMovementScale`, `mappings`, `source`, `updatedAt`으로 제한해야 한다(MUST). `source`는 `null`, `{ provider: "prsk-chibi-viewer", characterId }`, `{ provider: "custom", assetBaseUrl, characterId }`, `{ provider: "strr-res-pak", characterId, editionId }`, `{ provider: "garupa-pinned", sdAssetBundleName }` 중 하나여야 하며(MUST), non-null source provider는 저장 key의 runtime과 일치해야 한다(MUST). 기존 version 1 document에서 `source`가 없으면 `null`로 정규화해야 한다(MUST). Preset key는 trim된 Pet 표시 이름과 정확히 같아야 하며(MUST), JavaScript UTF-16 `length` 기준 표시 이름은 1–80, 설명은 0–280, 각 animation 이름은 trim 후 1–512 범위여야 한다(MUST). `updatedAt`은 0 이상 `Number.MAX_SAFE_INTEGER` 이하의 정수 millisecond 값이어야 한다(MUST). Package byte·blob URL과 local upload 파일 내용·이름·경로는 session memory에서만 다뤄야 한다(MUST).

```json
{
  "version": 1,
  "activePresetName": "Pet name or null",
  "presets": {
    "Pet name": {
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

`mappings`에는 표준 9개 상태가 모두 정확히 한 번 존재해야 하고(MUST), 각 상태 object는 `animationName`, `mirrorX`만 포함해야 한다(MUST). Framing과 look 값은 각 capability의 정수·범위 계약을 그대로 따라야 한다(MUST). 알 수 없는 field가 document, preset, framing offset 또는 mapping에 하나라도 있으면 전체 저장 document를 손상된 값으로 처리해야 한다(MUST).

#### Scenario: 원격 source preset 저장
- **WHEN** provided 또는 custom 원격 캐릭터를 사용한 Pet build가 성공한다
- **THEN** 저장 document에는 현재 설정, 갱신 시각과 검증된 provider·character 식별자가 기록되어야 한다
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

#### Scenario: strict preset schema
- **WHEN** 저장 preset에 허용하지 않은 source field, 안전하지 않은 character ID, 알 수 없는 상태, 누락된 상태 또는 허용 범위를 벗어난 값이 있다
- **THEN** 시스템은 일부 field만 골라 적용하지 않고 저장 document 전체를 빈 version 1 catalog로 복구해야 한다

#### Scenario: 같은 이름 덮어쓰기
- **WHEN** 이미 preset이 있는 trim된 Pet 이름으로 다른 유효 설정의 build가 성공한다
- **THEN** 시스템은 같은 key의 preset을 최신 설정으로 교체해야 한다
- **AND** selector에 같은 이름을 중복 추가해서는 안 된다

#### Scenario: bounded catalog
- **WHEN** 20개 preset이 있는 저장소에 새 이름의 성공 build를 저장한다
- **THEN** 시스템은 가장 오래 갱신된 preset을 제거하고 새 preset을 저장해야 한다
- **AND** document는 20개를 초과해서는 안 된다

#### Scenario: 저장 catalog 정렬
- **WHEN** 저장 document를 읽거나 새 preset을 추가한다
- **THEN** 시스템은 `updatedAt` 내림차순으로 preset을 정렬하고 앞의 20개만 유지해야 한다

### Requirement: runtime별 preset catalog 격리와 legacy 이관
PRSK, STRR와 Garupa integration은 자기 runtime key만 operational preset repository로 읽고 써야 한다(MUST). 한 runtime에서 preset을 저장·선택하거나 `새 세션`으로 전환해도 다른 runtime의 catalog와 active 선택을 변경해서는 안 된다(MUST NOT). Runtime key가 아직 없을 때만 이전 공용 `chibi-to-codex-pet.pet-presets.v1` document를 read-only migration source로 사용할 수 있다(MAY). Legacy preset은 `prsk-chibi-viewer`·`custom`이면 PRSK, `strr-res-pak`이면 STRR, `garupa-pinned`이면 Garupa로 한 번 분리해 새 key에 기록해야 하며(MUST), source가 없는 legacy preset은 판별 불가능하므로 PRSK로만 이관해야 한다(MUST). 이후의 save와 active 선택은 legacy key에 쓰면 안 된다(MUST NOT).

#### Scenario: 게임 탭 전환 시 preset 격리
- **WHEN** PRSK, STRR와 Garupa에 서로 다른 active preset이 저장된 상태에서 사용자가 게임 탭을 전환한다
- **THEN** 각 dropdown에는 현재 runtime catalog의 preset만 표시되어야 한다
- **AND** 이전 runtime의 preset 이름, source, 전체 반전과 active 선택을 새 runtime에 재사용해서는 안 된다

#### Scenario: 한 runtime에서 새 세션 선택
- **WHEN** 사용자가 Garupa preset dropdown에서 `새 세션`을 선택한다
- **THEN** Garupa active preset만 `null`이 되어야 한다
- **AND** PRSK와 STRR의 catalog와 active preset은 그대로 유지되어야 한다

#### Scenario: 공용 legacy catalog 분리 이관
- **WHEN** runtime별 key가 없고 이전 공용 catalog에 PRSK, STRR, Garupa provider preset이 함께 있다
- **THEN** 각 integration은 자기 provider preset만 자기 runtime key로 이관해야 한다
- **AND** 이관 뒤 어느 runtime dropdown에도 다른 runtime source preset이 나타나서는 안 된다

### Requirement: 검증된 build 완료 시 preset 활성화
시스템은 Codex Pet package build와 validation이 성공한 뒤에만 현재 설정을 preset으로 저장해야 한다(MUST). 저장한 preset은 즉시 active preset이 되어야 하며(MUST), 실패·취소되거나 validation을 통과하지 못한 build는 저장소와 active preset을 변경해서는 안 된다(MUST NOT).

#### Scenario: 성공 build 저장
- **WHEN** 사용자가 유효한 표시 이름으로 Pet을 build하고 package validation이 성공한다
- **THEN** 시스템은 그 이름으로 현재 설정 preset을 저장해야 한다
- **AND** 해당 preset을 selector의 현재 선택으로 표시해야 한다

#### Scenario: 실패 build 무변경
- **WHEN** package 생성 또는 validation이 실패하거나 사용자가 진행 중 build를 취소한다
- **THEN** 기존 preset catalog와 active preset은 변경되지 않아야 한다

### Requirement: 모든 game runtime의 명시적 preset loader
PRSK, STRR와 Garupa 화면은 같은 preset dropdown과 `새 세션` option을 input source·catalog·character control보다 먼저 표시하고(MUST), dropdown 바로 아래에 locale별 `프리셋 불러오기` action을 제공해야 한다(MUST). 같은 dropdown을 packaging header에 중복 표시해서는 안 된다(MUST NOT). 마지막으로 저장하거나 불러온 `activePresetName`은 다음 mount의 dropdown 대기 선택으로 복원하되(MUST), mount 또는 저장 preset option 선택만으로 설정 적용, storage write, catalog·model request, file access, preview 생성이나 source 교체를 시작해서는 안 된다(MUST NOT). `프리셋 불러오기`는 유효한 저장 preset이 대기 선택일 때만 활성화하고(MUST), catalog·model·import 작업과 충돌하는 동안에는 비활성화해야 한다(MUST).

#### Scenario: 다음 방문의 대기 선택
- **WHEN** `My Pet`이 마지막 active preset인 상태로 PRSK, STRR 또는 Garupa 화면을 mount한다
- **THEN** dropdown은 최초부터 `My Pet`을 표시하고 `프리셋 불러오기`를 활성화해야 한다
- **AND** 사용자가 그 action을 실행하기 전까지 설정 적용, storage write, catalog·model request와 preview 생성은 0건이어야 한다

#### Scenario: 저장 preset option만 변경
- **WHEN** ready source가 있거나 없는 상태에서 사용자가 dropdown의 다른 저장 preset을 선택한다
- **THEN** 대기 선택만 바뀌고 현재 적용 preset, metadata, mapping, preview, source와 저장 `activePresetName`은 유지되어야 한다
- **AND** 선택된 저장 preset 때문에 network 또는 file 작업을 시작해서는 안 된다

#### Scenario: 새 세션 선택
- **WHEN** 사용자가 preset dropdown에서 `새 세션`을 선택한다
- **THEN** 저장 catalog는 유지하되 active preset을 비우고 현재 source의 추천 mapping과 기본 metadata·framing·눈 이동량·반전으로 reset해야 한다
- **AND** `프리셋 불러오기`는 비활성화되고 다음 방문의 기본 선택은 `새 세션`이어야 한다

### Requirement: 명시적 preset 적용과 source-ready 복원
사용자가 `프리셋 불러오기`를 실행하면 시스템은 그 시점의 대기 preset을 active로 저장하고 현재 session에 적용해야 한다(MUST). Preset에 검증된 원격 `source`가 있고 현재 ready source와 다르면 해당 provider가 요구하는 고정 catalog·metadata와 character model을 요청해야 하며(MUST), 같은 source가 ready이면 불필요한 재요청 없이 설정만 다시 적용해야 한다(MUST). `source: null` preset은 network request, file access 또는 model import를 자동 시작해서는 안 되고(MUST NOT), 현재 ready source가 있으면 즉시 설정을 적용하고 source가 나중에 준비되면 그 설정을 적용해야 한다(MUST). Source가 ready가 되면 현재 source 추천 mapping을 먼저 계산한 뒤 저장 animation이 실제 목록에 존재하는 상태만 저장 mapping으로 덮어써야 한다(MUST).

#### Scenario: 원격 preset 명시적 복원
- **WHEN** 원격 source가 있는 `My Pet`을 선택하고 `프리셋 불러오기`를 실행한다
- **THEN** 시스템은 `My Pet`을 active로 저장하고 저장 provider의 catalog와 character model을 순서대로 요청해야 한다
- **AND** source가 ready가 된 뒤 저장된 metadata, framing, 눈 이동량, 반전과 유효 mapping을 적용해야 한다

#### Scenario: Garupa pinned preset 명시적 복원
- **WHEN** `garupa-pinned` source가 있는 preset에서 `프리셋 불러오기`를 실행한다
- **THEN** 시스템은 캐릭터 목록 UI를 먼저 불러오도록 요구하지 않고 저장된 `sdAssetBundleName`을 고정 provider에서 검증·materialize해야 한다
- **AND** 같은 pinned model이 이미 ready이면 network request 없이 저장 설정만 다시 적용해야 한다

#### Scenario: source 없는 preset 적용
- **WHEN** `source: null` preset에서 `프리셋 불러오기`를 실행한다
- **THEN** source 요청 없이 현재 ready source에 설정을 적용하거나 다음 local/source 준비까지 설정을 유지해야 한다

#### Scenario: 같은 preset 다시 불러오기
- **WHEN** 사용자가 현재 적용 중인 저장 preset의 설정을 수정한 뒤 같은 preset에서 `프리셋 불러오기`를 다시 실행한다
- **THEN** 저장 설정을 다시 적용하되 동일한 ready remote source를 다시 요청해서는 안 된다

#### Scenario: preset 요청 취소
- **WHEN** 원격 preset의 catalog 또는 model 요청 중 사용자가 `새 세션`을 선택한다
- **THEN** 이전 preset 요청을 취소하고 stale 결과를 active preview로 적용해서는 안 된다

#### Scenario: 없는 animation의 상태별 fallback
- **WHEN** active preset의 한 상태 animation은 새 source에 없고 다른 상태 animation은 존재한다
- **THEN** 없는 상태는 새 source의 추천 animation과 추천 상태별 반전을 유지해야 한다
- **AND** 존재하는 상태만 저장 animation과 저장 상태별 반전을 적용해야 한다

#### Scenario: 저장 preset이 없는 첫 source 이름
- **WHEN** 저장 preset이 하나도 없고 첫 source가 ready가 된다
- **THEN** builder는 source name의 `.zip` 또는 `.atlas` suffix를 제거하고 underscore·hyphen 연속 구간을 공백으로 바꾼 trim 결과를 Pet 표시 이름 초깃값으로 제안해야 한다

#### Scenario: 저장 catalog가 있는 새 세션 이름
- **WHEN** 저장 preset catalog는 존재하지만 대기 선택이 `새 세션`인 상태에서 source가 ready가 된다
- **THEN** Pet 표시 이름과 설명은 빈 값으로 시작하고 source name을 자동 입력하지 않아야 한다

### Requirement: 새 세션 전용 character catalog action
PRSK, STRR와 Garupa의 remote character catalog/list 불러오기 action은 preset dropdown의 대기 선택이 `새 세션`일 때만 활성화되어야 한다(MUST). 저장 preset이 대기 선택이면 `프리셋 불러오기`만 활성화하고 character catalog action은 비활성화해야 한다(MUST). 이 gate는 새 request 시작을 막아야 하며(MUST), local upload file 선택과 명시적 local import까지 금지하는 것으로 확장해서는 안 된다(MUST NOT).

#### Scenario: 저장 preset 선택 상태
- **WHEN** PRSK, STRR 또는 Garupa에서 저장 preset이 dropdown에 선택되어 있다
- **THEN** `프리셋 불러오기`는 활성이고 해당 runtime의 character catalog/list action은 비활성이어야 한다

#### Scenario: 새 세션 상태
- **WHEN** 같은 화면에서 `새 세션`을 선택한다
- **THEN** `프리셋 불러오기`는 비활성이고 character catalog/list action은 활성화 조건을 만족해야 한다

### Requirement: 저장소 오류 복구
지원하지 않는 version, 손상된 JSON, 알 수 없는 field 또는 schema 범위를 벗어난 preset은 적용되어서는 안 된다(MUST NOT). 읽기 또는 parse 실패는 해당 runtime key를 제거하려고 시도한 뒤 `{ version: 1, activePresetName: null, presets: {} }`로 교체해 복구해야 한다(MUST). Document가 유효하지만 `activePresetName`이 catalog에 없으면 preset은 보존하고 active 선택만 `null`로 정규화해야 한다(MUST). Storage read·write·remove가 예외를 발생시켜도 앱 mount, 현재 preview와 build session은 계속 동작해야 한다(MUST).

#### Scenario: 손상된 document
- **WHEN** preset storage가 JSON이 아니거나 지원하지 않는 version을 가진다
- **THEN** 시스템은 이를 빈 catalog로 취급하고 가능한 경우 손상된 runtime key를 빈 version 1 document로 교체해야 한다
- **AND** 앱은 기본 새 세션으로 계속 동작해야 한다

#### Scenario: 존재하지 않는 active preset
- **WHEN** document schema와 preset은 유효하지만 `activePresetName`이 `presets`에 존재하지 않는다
- **THEN** 시스템은 preset catalog를 유지하고 active 선택만 `null`인 새 세션으로 복원해야 한다

#### Scenario: storage 쓰기 차단
- **WHEN** 성공 build 뒤 `localStorage.setItem`이 보안 또는 quota 오류를 발생시킨다
- **THEN** 생성된 package와 현재 builder 설정은 유지되어야 한다
- **AND** 오류가 preview 또는 download 결과를 무효화해서는 안 된다
