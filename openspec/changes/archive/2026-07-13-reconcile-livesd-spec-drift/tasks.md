## 1. Runtime과 framing 계약 정리

- [x] 1.1 `spine-versioned-runtime` main spec을 game integration별 기준 runtime, source별 version 정책과 integration-local preview·sampler 계약으로 동기화한다.
- [x] 1.2 `codex-pet-package-export`의 mapping 이후 preview·export framing을 동일한 57-pose canonical projection 계약으로 동기화한다.
- [x] 1.3 Garupa registry 활성화 문구를 특정 feature branch가 아닌 검증된 dev·production build 기준으로 동기화한다.

## 2. Garupa 오류 context 보존

- [x] 2.1 공개 오류 adapter가 실제 importer 직접 field와 renderer·runtime `context`, remote `details`에서 allowlist 값만 보존하도록 수정한다.
- [x] 2.2 실제 오류 클래스 기반 회귀 테스트로 safe context 보존과 path·내부 값 제거를 검증한다.

## 3. 검증

- [x] 3.1 관련 단위 테스트와 typecheck를 실행한다.
- [x] 3.2 reconciliation change와 전체 main spec을 strict 검증한다.
