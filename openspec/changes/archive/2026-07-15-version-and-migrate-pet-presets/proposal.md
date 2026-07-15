## Why

현재 Pet 설정 preset은 catalog 수준의 `version: 1`만 있고 preset 개별 schema version이 없어, 오래되었거나 손상된 preset 하나가 catalog 전체를 무효화할 수 있다. Provider와 builder 계약이 진화해도 사용 가능한 기존 preset은 보존하면서, 더 이상 해석할 수 없는 항목은 UI에 노출하거나 적용하지 않는 명시적 migration 경계가 필요하다.

## What Changes

- Runtime별 preset 저장소를 catalog version 2로 올리고 각 preset에 `schemaVersion: 2`를 기록한다.
- Runtime별 version 1 catalog와 이전 공용 version 1 catalog를 read-only migration source로 지원한다.
- Version 1 preset을 항목별로 strict 검증해 현재 schema로 승격하고, 이관할 수 없는 항목과 지원하지 않는 preset version은 dropdown에서 제외한다.
- 유효한 preset 하나의 문제로 다른 유효 preset까지 삭제하지 않도록 catalog envelope와 preset entry 검증·복구 책임을 분리한다.
- Migration은 localStorage 내부에서만 수행하며 mount만으로 network, file access, preview 생성 또는 source 교체를 시작하지 않는다.

## Capabilities

### New Capabilities

- 없음.

### Modified Capabilities

- `pet-settings-presets`: Catalog·preset 개별 versioning, version 1 항목별 migration, 지원하지 않는 항목의 비노출과 유효 항목 보존 요구사항을 추가한다.
- `web-app-foundation`: Production writable persistence allowlist를 v2 current key로 갱신하고 runtime·공용 v1 key는 migration read-only 입력으로 제한한다.

## Impact

- `src/features/codex-pet/settingsPresets.ts`의 저장 key, catalog/preset type, parser와 migration 경로가 변경된다.
- Preset loader와 provider integration은 migration된 current catalog만 소비하며 기존 UI API는 유지한다.
- Preset storage·loader·provider harness test와 `pet-settings-presets` delta spec이 갱신된다.
- Production persistence verifier와 `web-app-foundation` delta spec의 storage key 경계가 갱신된다.
- 외부 dependency, provider API, 원격 asset 또는 package format에는 변화가 없다.
