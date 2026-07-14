## 1. PRSK catalog 계층 projection

- [x] 1.1 Flat `PrskRemoteCatalog` option을 canonical 캐릭터 그룹과 model choice로 투영하는 read-only 타입 및 pure utility를 추가한다.
- [x] 1.2 Canonical multi-model grouping, multi-part suffix, custom label, singleton fallback, stable order와 `모델 - 캐릭터` 기본 이름 unit test를 추가한다.

## 2. PRSK 두 단계 선택과 builder handoff

- [x] 2.1 `PrskIntegration`의 remote state를 character key와 canonical model ID로 분리하고 두 searchable combobox를 렌더링한다.
- [x] 2.2 Character commit은 model request 없이 pending model만 비우고, model commit·연속 선택·catalog reload가 기존 abort 및 generation 계약을 유지하도록 연결한다.
- [x] 2.3 Remote preset load가 저장된 leaf ID의 상위 캐릭터와 model selector를 복원하고 같은 canonical ID로 source를 불러오도록 갱신한다.
- [x] 2.4 Ready PRSK remote source가 `defaultDisplayName`을 builder에 전달하고 적용된 preset metadata가 우선하는지 검증한다.
- [x] 2.5 네 locale에 character/model selector, loading, empty와 선택 순서 안내 message를 동일한 key 집합으로 추가한다.

## 3. Provider 공통 계약 회귀 검증

- [x] 3.1 React integration test helper와 PRSK 시나리오를 두 단계 선택, request count, reload, stale completion 및 기본 Pet 이름에 맞게 갱신한다.
- [x] 3.2 Playwright PRSK remote fixture를 character→model interaction과 accidental request 방지 계약에 맞게 갱신한다.
- [x] 3.3 STRR와 Garupa의 기존 두 단계 선택 및 `모델/에디션 - 캐릭터` 기본 이름 테스트가 계속 통과하는지 확인한다.

## 4. 명세 동기화와 품질 검사

- [x] 4.1 Delta spec을 main spec과 capability map에 동기화하고 change 및 main spec strict validation을 통과시킨다.
- [x] 4.2 Typecheck, lint, unit test와 관련 Playwright E2E를 실행하고 발견된 회귀를 수정한다.

## 5. Provider repository와 local 검증 경계

- [x] 5.1 Karth·PRSK·STRR·Garupa acquisition, backup, 변환, 실제 asset smoke와 QA evidence를 ignored `*.local.*` 파일로 보존하고 root package script에서 제거한다.
- [x] 5.2 PRSK production integration의 repository-local development asset fallback과 관련 공개 API·message·spec을 제거한다.
- [x] 5.3 Provider 권리물 비포함과 local smoke 격리 main/delta spec, contribution policy, CI-safe/local Playwright config와 전역 repository-boundary harness를 동기화한다.
- [x] 5.4 Repository boundary, OpenSpec strict validation, typecheck, lint, unit, build와 CI-safe Playwright E2E를 실행한다.
