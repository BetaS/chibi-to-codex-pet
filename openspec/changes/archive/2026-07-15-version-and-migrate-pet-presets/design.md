## Context

Preset 저장소는 runtime별 `.v1` key와 catalog `version: 1`을 사용하지만 각 preset에는 schema 식별자가 없다. 현재 parser는 모든 entry를 한 번에 parse하므로 한 entry의 unknown field, 범위 오류 또는 provider 불일치가 catalog 전체 삭제로 이어진다. 동시에 mount만으로 preset을 적용하거나 provider request를 시작하지 않는 기존 lazy-load 계약과 localStorage 이외에 사용자 데이터를 보내지 않는 경계를 유지해야 한다.

## Goals / Non-Goals

**Goals:**

- Current catalog와 개별 preset의 version을 명시하고 저장 key에서도 세대를 구분한다.
- 지원 가능한 version 1 preset은 항목별 strict 검증 후 version 2로 승격한다.
- 손상·미지원 entry는 dropdown과 적용 경로에서 제외하면서 같은 catalog의 유효 entry는 보존한다.
- Migration source 우선순위와 write 시점을 결정적으로 만들어 재실행과 stale data 부활을 막는다.
- Migration이 localStorage 밖의 network, file, preview 또는 provider lifecycle을 시작하지 않게 한다.

**Non-Goals:**

- Animation 이름을 새 provider catalog에 맞춰 추측하거나 변환하지 않는다. Source-ready 시 기존 상태별 fallback 계약이 이를 처리한다.
- 알 수 없는 미래 catalog/preset version을 best-effort로 해석하지 않는다.
- Version 1 key를 삭제하거나 새 값을 dual-write하지 않는다.
- Provider asset, package 또는 local upload 파일을 migration 대상에 포함하지 않는다.

## Decisions

### 1. Catalog version 2와 preset `schemaVersion: 2`를 함께 사용한다

Current runtime key는 `chibi-to-codex-pet.pet-presets.<runtime>.v2`이고 document `version`도 `2`다. 각 entry는 `schemaVersion: 2`를 필수로 가진다. Storage key는 조회 세대를, catalog version은 envelope parser를, preset version은 항목별 migration/비노출 결정을 담당한다.

Production persistence verifier는 locale과 runtime별 v2 key만 writable current key로 승인하고, runtime별 v1과 공용 v1이 migration 호환성을 위해 bundle에 포함되는지 별도로 검사한다.

Catalog version만 올리는 대안은 mixed-version entry를 독립적으로 판별하지 못해 제외한다. Preset version만 추가하고 `.v1` key를 재사용하는 대안은 구버전 앱이 새 document를 손상된 값으로 지우거나 덮어쓸 수 있어 제외한다.

### 2. Current key가 없을 때만 legacy source를 한 번 이관한다

조회 순서는 current runtime `.v2`, 같은 runtime `.v1`, 공용 `.v1`이다. Current key가 존재하면 내용이 손상되었거나 지원하지 않는 version이어도 legacy로 fallback하지 않고 빈 v2 catalog로 복구한다. 이로써 사용자가 새 세대에서 삭제·수정한 preset이 오래된 key에서 다시 나타나지 않는다.

Runtime `.v1`은 이미 runtime이 확정되었으므로 `source: null` entry도 그 runtime으로 이관한다. 공용 `.v1`은 source provider로 runtime을 나누고 `source: null`은 기존 계약대로 PRSK에만 이관한다. Legacy key는 read-only로 남겨 rollback 근거를 보존한다.

### 3. Envelope 실패와 entry 실패를 분리한다

Current/legacy catalog envelope의 JSON, exact top-level field, catalog version, `activePresetName`, `presets` container가 유효하지 않으면 해당 source 전체를 사용할 수 없다. Envelope가 유효하면 각 preset을 독립적으로 strict parse한다.

Version 1 entry는 기존 허용 field와 값 범위를 만족할 때 `source` 누락을 `null`로 정규화하고 `schemaVersion: 2`를 추가한다. Version 2 entry는 exact field와 `schemaVersion: 2`를 요구한다. Unknown, malformed, runtime 불일치 또는 미래 version entry는 결과 catalog에서 제외한다. `activePresetName`이 제외된 entry를 가리키면 `null`로 정규화한다.

Entry를 field별로 부분 복구하는 대안은 안전하지 않은 source나 mapping이 섞일 수 있어 제외한다. Entry 하나 때문에 catalog 전체를 비우는 기존 방식은 유효한 사용자 preset을 불필요하게 잃으므로 대체한다.

### 4. Migration과 복구 때만 자동 write한다

Legacy source를 읽은 경우에는 migration 결과가 비어 있어도 v2 key를 기록해 migration 완료 marker로 사용한다. Current v2가 유효하면 단순 mount/read는 write하지 않는다. Current envelope가 손상된 경우에만 빈 v2 catalog로 복구한다. Current catalog 안의 잘못된 entry는 메모리 결과와 UI에서 제외하며, 다음 명시적 save/select가 정규화된 catalog를 기록한다.

이 결정은 저장 preset이 대기 선택인 mount에서 storage write가 0이어야 한다는 기존 loader 계약을 유지한다.

## Risks / Trade-offs

- [Version 1 parser가 지나치게 관대하면 손상 값을 승격할 수 있음] → Exact key, bounded value, source provider/runtime, 표준 9개 mapping 검증을 그대로 재사용한다.
- [Current v2 entry를 숨기되 즉시 저장하지 않으면 raw storage에 남음] → 모든 소비자는 parsed catalog만 사용하고 다음 명시적 mutation에서 제거한다. 자동 write 금지 계약을 우선한다.
- [Rollback한 구버전 앱은 v2에서 새로 저장한 preset을 보지 못함] → Legacy v1을 삭제·변경하지 않아 기존 데이터는 유지하며, forward migration은 단방향으로 명시한다.
- [공용 v1을 runtime별로 여러 번 읽음] → 각 runtime의 첫 read가 자기 v2 marker를 기록하고 이후에는 legacy를 다시 읽지 않는다.

## Migration Plan

1. V2 type, key와 current parser를 배포한다.
2. Runtime `.v1`과 공용 `.v1`을 읽는 항목별 migrator를 추가한다.
3. Provider integration은 기존과 동일하게 current parsed catalog만 받아 dropdown을 구성한다.
4. Valid v1, mixed valid/invalid, future preset version, corrupt/future catalog와 no-side-effect mount를 회귀 test로 고정한다.
5. Production persistence verifier의 current·legacy key allowlist를 갱신한다.
6. Rollback 시 v1 key는 그대로 있으므로 구버전은 기존 catalog를 계속 사용할 수 있다. V2-only 신규 저장은 forward app에서만 유지된다.

## Open Questions

- 없음.
