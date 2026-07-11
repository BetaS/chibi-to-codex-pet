## Context

현재 builder 설정은 React session에만 존재해서 page를 다시 열거나 source를 다시 불러오면 framing, 반전, 눈 이동량, Pet metadata와 9개 상태 animation mapping을 다시 입력해야 한다. locale만 versioned same-origin `localStorage`에 저장되고 있으며 production 검증은 그 외 persistence를 금지한다. 상태별 animation control은 native `<select>`라 실제 animation이 많은 PRSK skeleton에서 이름으로 찾기 어렵다.

이 변경은 모델을 자동으로 다시 불러오지 않으면서도 사용자가 검증된 Pet을 생성할 때의 설정을 재사용하게 해야 한다. 따라서 persistence는 source binary나 provider 식별자가 아닌 portable 설정으로 제한하고, 저장한 animation 이름을 다음 source의 실제 animation 목록과 대조한 뒤 적용해야 한다.

## Goals / Non-Goals

**Goals:**

- 검증된 Pet build 성공 시 표시 이름으로 versioned preset을 저장하고 마지막 preset을 다음 방문의 기본값으로 선택한다.
- preset selector로 저장 preset을 전환하거나 저장 목록을 삭제하지 않고 `새 세션` 기본값으로 돌아갈 수 있게 한다.
- framing, 눈 이동량, 전체·상태별 반전, metadata와 상태별 animation 이름을 source 준비 후 안전하게 복원한다.
- storage 손상·차단·quota 오류가 preview와 build를 중단하지 않게 한다.
- 상태별 animation을 현재 session의 실제 animation 안에서 검색하고 keyboard로 선택할 수 있게 한다.
- 네 locale과 production persistence 검증을 함께 갱신한다.

**Non-Goals:**

- model byte, ZIP, atlas/PNG, source/provider URL, character ID, download URL, 생성 package 또는 validation 결과를 저장하지 않는다.
- page 진입 시 network 요청이나 model import를 자동 시작하지 않는다.
- cloud 동기화, preset export/import, 이름 변경 또는 개별 삭제 UI를 추가하지 않는다.
- animation fuzzy search, 원격 검색 또는 source 간 animation 이름 변환을 구현하지 않는다.

## Decisions

### 1. 하나의 bounded versioned document를 사용한다

`chibi-to-codex-pet.pet-presets.v1` key 하나에 schema version, active preset 이름과 preset map을 저장한다. preset key는 build에 사용한 trim된 Pet 표시 이름이며 같은 이름의 성공 build는 기존 preset을 덮어쓴다. document는 최대 20개 preset만 유지하고 새 이름을 추가할 때 가장 오래 갱신된 preset을 제거한다.

한 document를 사용하면 preset 저장과 active 선택 갱신을 한 번의 write로 처리할 수 있고 storage allowlist도 좁게 유지된다. parser는 모든 field의 type·범위·길이를 검증하고 지원하지 않는 version이나 손상된 document는 제거한 뒤 빈 catalog로 복구한다.

### 2. preset에는 portable 설정만 저장한다

각 preset은 이름, 설명, framing scale과 X/Y offset, 눈 이동량, 전체 반전, 9개 상태의 animation 이름과 상태별 반전, 마지막 갱신 시각만 가진다. source와 package를 재구성할 수 있는 byte·파일·URL·provider/character 식별자와 생성 결과는 포함하지 않는다.

성공한 build의 validation이 완료된 시점에만 저장한다. 실패하거나 취소된 build는 preset과 active 선택을 변경하지 않는다.

### 3. active preset은 source가 ready일 때 검증해서 적용한다

앱 mount에서는 catalog와 active 이름만 읽으며 network 또는 model loading을 시작하지 않는다. 실제 source가 준비되면 먼저 그 source의 추천 mapping을 계산하고, 저장 animation이 현재 animation 목록에 존재하는 상태만 preset mapping과 상태별 반전으로 덮어쓴다. 존재하지 않는 animation의 상태는 새 source 추천값 전체를 유지한다. metadata, framing, 눈 이동량과 전체 반전은 유효 범위로 정규화해 적용한다.

사용자가 preset을 선택할 때도 같은 규칙을 사용한다. 선택은 active 이름을 즉시 저장하고 현재 source가 있으면 현재 session에 적용한다.

### 4. `새 세션`은 저장 preset을 보존하는 명시적 reset이다

selector의 sentinel option은 active 이름을 `null`로 저장하고 현재 source의 추천 mapping, source 기본 반전, 기본 framing·눈 이동량과 빈 metadata를 적용한다. 기존 preset catalog는 삭제하지 않는다. 다음 방문도 새 세션이 기본 선택으로 남는다.

### 5. 상태 선택에는 공용 searchable combobox를 재사용한다

각 상태 row는 `SearchableCombobox`에 현재 source animation을 원래 순서로 전달한다. 검색은 client-side 대소문자 무시 substring이고 query 입력, highlight 이동 또는 결과 없음은 mapping을 변경하지 않는다. 실제 option을 확정했을 때만 mapping과 Spine preview를 갱신한다. focus 시에는 기존 요구대로 현재 mapping을 preview한다.

preset 또는 새 세션을 적용하면 모든 상태 query를 reset해 화면의 검색 문자열이 새 mapping과 충돌하지 않게 한다.

## Risks / Trade-offs

- **같은 Pet 이름 충돌:** 같은 이름은 의도적으로 같은 preset을 덮어쓴다. selector에서 중복 표시를 피하는 대신 서로 다른 설정은 다른 이름이 필요하다.
- **source 간 animation 불일치:** 일부 저장 mapping만 적용되면 혼합 결과가 생길 수 있다. 각 상태를 독립 검증하고 없는 상태는 새 source 추천으로 되돌려 invalid export를 방지한다.
- **storage 접근 실패:** private mode나 정책으로 persistence가 동작하지 않을 수 있다. repository API가 예외를 흡수하고 현재 in-memory 작업은 계속한다.
- **preset 수 제한:** 20개를 넘으면 오래된 preset이 제거된다. storage를 bounded하게 유지하고 UI에 별도 관리 기능을 추가하지 않는 대가다.
- **combobox row 증가:** 9개 listbox가 DOM에 존재할 수 있다. 공용 component는 열린 row만 option list를 렌더링하고 animation 배열을 공유한다.

## Migration Plan

1. preset schema/parser/repository와 corruption·quota·bounded catalog 단위 테스트를 추가한다.
2. builder에 preset selector와 source-ready 적용 경계를 연결하고 성공 build 뒤 저장한다.
3. 상태 `<select>`를 searchable combobox로 바꾸고 locale catalog와 CSS를 갱신한다.
4. production storage allowlist, component tests, Playwright 회귀와 production build를 검증한다.

기존 설치에는 preset key가 없으므로 migration 없이 빈 catalog로 시작한다. 문제가 발생하면 preset module과 UI 연결을 제거해도 기존 locale storage와 source workflow는 그대로 동작한다.

## Open Questions

없음.
