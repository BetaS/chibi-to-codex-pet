## 1. 공통 프리셋 진입점

- [x] 1.1 지원 locale에 `새로 만들기` message를 추가한다.
- [x] 1.2 `CodexPetPresetLoader`가 저장 프리셋 선택 중에만 `새로 만들기`를 표시하고 기존 null selection callback을 호출하도록 구현한다.
- [x] 1.3 공통 loader의 조건부 표시, callback 동작과 busy 중 취소 가능성을 component test로 검증한다.

## 2. Provider catalog action gate

- [x] 2.1 PRSK remote catalog action을 새 session에서만 렌더링한다.
- [x] 2.2 STRR character catalog action을 새 session에서만 렌더링한다.
- [x] 2.3 Garupa character catalog action을 새 session에서만 렌더링한다.

## 3. 통합 회귀와 검증

- [x] 3.1 Runtime 격리 및 provider integration test를 저장 프리셋의 숨김 상태와 `새로 만들기` 전환 계약에 맞게 갱신한다.
- [x] 3.2 Provider development harness, 관련 component/integration test, typecheck와 OpenSpec strict validation을 통과시킨다.
