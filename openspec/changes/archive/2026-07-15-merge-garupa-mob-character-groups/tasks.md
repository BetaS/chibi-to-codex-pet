## 1. Catalog 분류

- [x] 1.1 Garupa catalog entry에 `characterKind`를 추가하고 non-`unique` 전용 후보를 Mob으로 분류한다.
- [x] 1.2 공유 Mob, 고유 캐릭터 충돌과 unresolved 경계를 remote parser test로 고정한다.

## 2. 단일 Mob 선택 UX

- [x] 2.1 Garupa panel에서 모든 Mob entry를 stable `mob` key로 합치고 선택 복원·count·locale label을 갱신한다.
- [x] 2.2 단일 Mob option, 원본 bundle model 목록, request identity와 미매핑 분리를 panel test로 검증한다.

## 3. 검증

- [x] 3.1 Garupa unit/integration test와 typecheck를 실행해 회귀가 없는지 확인한다.
- [x] 3.2 OpenSpec change를 검증하고 구현 결과와 작업 상태를 일치시킨다.
