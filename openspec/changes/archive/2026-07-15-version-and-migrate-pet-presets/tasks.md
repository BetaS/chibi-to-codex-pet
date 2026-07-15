## 1. Current preset schema

- [x] 1.1 Runtime storage key와 catalog version을 v2로 올리고 각 저장 preset에 필수 `schemaVersion: 2`를 추가한다.
- [x] 1.2 V2 catalog envelope는 strict하게 검증하되 invalid·future-version preset entry만 격리하고 유효 entry와 active 정규화를 보존한다.
- [x] 1.3 Production persistence spec과 verifier가 v2 current key만 writable로 승인하고 runtime·공용 v1 key를 migration read-only 입력으로 구분하게 한다.

## 2. Version 1 migration

- [x] 2.1 Runtime `.v1`과 공용 `.v1` exact entry parser를 구현하고 `source` 누락 정규화, runtime 소속 검증과 v2 승격을 적용한다.
- [x] 2.2 Current v2 → runtime v1 → 공용 v1 우선순위, one-time v2 marker write, legacy read-only와 current 손상 시 no-fallback 복구를 구현한다.

## 3. 노출·회귀 방지

- [x] 3.1 Mixed valid/invalid current catalog와 future preset version에서 유효 preset만 loader dropdown에 노출되는 test를 추가한다.
- [x] 3.2 Runtime/common v1 migration, current-key precedence, legacy 불변과 valid current mount의 storage·network 무동작 test를 추가한다.

## 4. 전체 검증

- [x] 4.1 관련·전체 test, App·CLI typecheck, lint, strict OpenSpec, package·repository boundary와 diff 무결성 검사를 통과시킨다.
