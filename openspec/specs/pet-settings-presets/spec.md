# Pet 설정 preset 명세

## Purpose

사용자는 성공적으로 생성한 Pet의 렌더링 설정과 다시 불러올 수 있는 원격 캐릭터 식별자를 이름별 preset으로 저장하고 다음 browser session에서 즉시 복원할 수 있다. Local upload preset은 browser가 파일을 다시 읽을 권한이 없으므로 설정만 복원하고 파일 선택을 기다린다.

## Requirements

### Requirement: versioned Pet 설정 preset 저장소
웹 앱은 same-origin `localStorage`의 `chibi-to-codex-pet.pet-presets.v1` key에 schema version `1`인 Pet 설정 document를 저장해야 한다(MUST). Document의 허용 field는 정확히 `version`, `activePresetName`, `presets`이고(MUST), 각 preset의 허용 field는 `description`, `displayName`, `framingOffset`, `framingScale`, `globalMirrorX`, `lookMovementScale`, `mappings`, `source`, `updatedAt`으로 제한해야 한다(MUST). `source`는 `null`, `{ provider: "prsk-chibi-viewer", characterId }`, `{ provider: "custom", assetBaseUrl, characterId }` 중 하나여야 하며(MUST), 기존 version 1 document에서 이 field가 없으면 `null`로 정규화해야 한다(MUST). Preset key는 trim된 Pet 표시 이름과 정확히 같아야 하며(MUST), JavaScript UTF-16 `length` 기준 표시 이름은 1–80, 설명은 0–280, 각 animation 이름은 trim 후 1–512 범위여야 한다(MUST). `updatedAt`은 0 이상 `Number.MAX_SAFE_INTEGER` 이하의 정수 millisecond 값이어야 한다(MUST). Package byte·blob URL과 local upload 파일 내용·이름·경로는 session memory에서만 다뤄야 한다(MUST). 저장소는 최대 20개 preset으로 제한해야 한다(MUST).

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

### Requirement: 검증된 build 완료 시 preset 활성화
시스템은 Codex Pet package build와 validation이 성공한 뒤에만 현재 설정을 preset으로 저장해야 한다(MUST). 저장한 preset은 즉시 active preset이 되어야 하며(MUST), 실패·취소되거나 validation을 통과하지 못한 build는 저장소와 active preset을 변경해서는 안 된다(MUST NOT).

#### Scenario: 성공 build 저장
- **WHEN** 사용자가 유효한 표시 이름으로 Pet을 build하고 package validation이 성공한다
- **THEN** 시스템은 그 이름으로 현재 설정 preset을 저장해야 한다
- **AND** 해당 preset을 selector의 현재 선택으로 표시해야 한다

#### Scenario: 실패 build 무변경
- **WHEN** package 생성 또는 validation이 실패하거나 사용자가 진행 중 build를 취소한다
- **THEN** 기존 preset catalog와 active preset은 변경되지 않아야 한다

### Requirement: 다음 방문과 source-ready 복원
시스템은 마지막으로 저장하거나 사용자가 선택한 preset 이름을 다음 mount의 기본 선택으로 복원해야 한다(MUST). PRSK 화면은 이 session preset dropdown을 입력 source, upload file, provider URL, catalog와 character control보다 먼저 표시해야 하며(MUST), 같은 dropdown을 packaging header에 중복 표시해서는 안 된다(MUST NOT). 사용자는 source가 없어도 preset 또는 `새 세션`을 선택해 active session 설정을 확정할 수 있어야 한다(MUST). Active preset에 유효한 원격 `source`가 있으면 mount 또는 dropdown 선택 직후 해당 provider catalog와 character model을 순서대로 요청해 preview를 만들어야 한다(MUST). `source`가 `null`인 preset과 `새 세션`은 network request, file access, model import 또는 preview session 생성을 자동 시작해서는 안 된다(MUST NOT). Source가 ready가 되면 시스템은 현재 active preset을 session 전체의 metadata, framing, 눈 이동량과 반전 기준으로 사용하고(MUST), 현재 source 추천 mapping을 먼저 계산한 뒤 저장 animation이 실제 목록에 존재하는 상태만 저장 mapping으로 덮어써야 한다(MUST).

#### Scenario: 다음 방문 원격 preset 자동 복원
- **WHEN** 원격 source가 있는 `My Pet` preset을 저장한 뒤 page를 다시 연다
- **THEN** selector는 최초부터 `My Pet`을 선택해야 한다
- **AND** 별도 `불러오기` 조작 없이 저장 provider의 catalog와 character model을 요청해야 한다
- **AND** source가 ready가 된 뒤 저장된 metadata, framing, 눈 이동량, 반전과 유효 mapping이 적용되어야 한다

#### Scenario: source 없는 preset 초기 상태
- **WHEN** `source: null`인 active preset이 저장된 상태로 page에 진입한다
- **THEN** 설정과 active 이름을 복원하되 network request, file access, model import 또는 preview session 생성이 발생해서는 안 된다

#### Scenario: 자동 복원 취소
- **WHEN** 원격 preset의 catalog 또는 model 자동 요청 중 사용자가 `새 세션`이나 다른 preset을 선택한다
- **THEN** 이전 preset의 진행 중 요청을 취소하고 그 결과를 active preview로 적용해서는 안 된다

#### Scenario: 리소스보다 먼저 preset 확정
- **WHEN** 저장된 원격 preset이 둘 이상인 초기 화면에서 사용자가 입력 source나 리소스 경로를 선택하기 전에 `My Pet`을 선택한다
- **THEN** `My Pet`은 즉시 active preset으로 저장되어야 한다
- **AND** preset dropdown은 입력 source control보다 앞에 있어야 한다
- **AND** 저장된 provider와 character를 사용해 catalog·model request와 preview 생성을 즉시 시작해야 한다

#### Scenario: 먼저 고른 preset으로 source 준비
- **WHEN** 사용자가 `My Pet`을 active로 선택한 뒤 upload 또는 remote source를 불러온다
- **THEN** source가 ready 되는 즉시 `My Pet`의 metadata, framing, 눈 이동량, 전체 반전과 유효 상태 mapping이 적용되어야 한다
- **AND** 다른 preset이나 source 기본값을 중간 상태로 확정해서는 안 된다

#### Scenario: 없는 animation의 상태별 fallback
- **WHEN** active preset의 한 상태 animation은 새 source에 없고 다른 상태 animation은 존재한다
- **THEN** 없는 상태는 새 source의 추천 animation과 추천 상태별 반전을 유지해야 한다
- **AND** 존재하는 상태만 저장 animation과 저장 상태별 반전을 적용해야 한다

#### Scenario: 저장 preset이 없는 첫 source 이름
- **WHEN** 저장 preset이 하나도 없고 첫 source가 ready가 된다
- **THEN** builder는 source name의 `.zip` 또는 `.atlas` suffix를 제거하고 underscore·hyphen 연속 구간을 공백으로 바꾼 trim 결과를 Pet 표시 이름 초깃값으로 제안해야 한다

#### Scenario: 저장 catalog가 있는 새 세션 이름
- **WHEN** 저장 preset catalog는 존재하지만 active 선택이 `새 세션`인 상태에서 source가 ready가 된다
- **THEN** Pet 표시 이름과 설명은 빈 값으로 시작하고 source name을 자동 입력하지 않아야 한다

### Requirement: preset 전환과 새 세션
웹 UI는 저장된 preset을 선택하는 dropdown과 `새 세션` option을 제공해야 한다(MUST). preset을 선택하면 이를 active preset으로 저장하고 현재 ready source에 즉시 적용해야 한다(MUST). 선택 preset의 원격 source가 현재 ready source와 다르면 저장된 provider와 character로 교체 로드를 즉시 시작해야 하며(MUST), 같으면 불필요한 재요청 없이 설정만 적용해야 한다(MUST). `새 세션`은 저장 catalog를 삭제하지 않고 active 선택을 비우며 현재 source의 추천 mapping과 기본 설정으로 reset해야 한다(MUST).

#### Scenario: 다른 preset 선택
- **WHEN** 사용자가 preset dropdown의 다른 원격 캐릭터 preset을 선택한다
- **THEN** 해당 캐릭터 로드를 즉시 시작하고 ready가 되면 builder와 LiveSD/Codex Pet preview를 해당 preset의 유효 설정으로 갱신해야 한다
- **AND** 다음 방문의 기본 preset도 그 이름이어야 한다

#### Scenario: 새 세션 선택
- **WHEN** 사용자가 preset dropdown에서 `새 세션`을 선택한다
- **THEN** metadata는 비워지고 framing·눈 이동량·반전·mapping은 현재 source 기본값으로 돌아가야 한다
- **AND** 기존 저장 preset은 dropdown에 계속 남아야 한다
- **AND** 다음 방문의 기본 선택은 `새 세션`이어야 한다

### Requirement: 저장소 오류 복구
지원하지 않는 version, 손상된 JSON, 알 수 없는 field 또는 schema 범위를 벗어난 preset은 적용되어서는 안 된다(MUST NOT). 읽기 또는 parse 실패는 전체 key를 제거하려고 시도한 뒤 `{ version: 1, activePresetName: null, presets: {} }`로 복구해야 한다(MUST). Document가 유효하지만 `activePresetName`이 catalog에 없으면 preset은 보존하고 active 선택만 `null`로 정규화해야 한다(MUST). Storage read·write·remove가 예외를 발생시켜도 앱 mount, 현재 preview와 build session은 계속 동작해야 한다(MUST).

#### Scenario: 손상된 document
- **WHEN** preset storage가 JSON이 아니거나 지원하지 않는 version을 가진다
- **THEN** 시스템은 이를 빈 catalog로 취급하고 가능한 경우 손상 key를 제거해야 한다
- **AND** 앱은 기본 새 세션으로 계속 동작해야 한다

#### Scenario: 존재하지 않는 active preset
- **WHEN** document schema와 preset은 유효하지만 `activePresetName`이 `presets`에 존재하지 않는다
- **THEN** 시스템은 preset catalog를 유지하고 active 선택만 `null`인 새 세션으로 복원해야 한다

#### Scenario: storage 쓰기 차단
- **WHEN** 성공 build 뒤 `localStorage.setItem`이 보안 또는 quota 오류를 발생시킨다
- **THEN** 생성된 package와 현재 builder 설정은 유지되어야 한다
- **AND** 오류가 preview 또는 download 결과를 무효화해서는 안 된다
