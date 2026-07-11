# Codex Pet 애니메이션 매핑 명세

## Purpose

Ready LiveSD source의 animation을 Codex Pet v2의 9개 표준 상태에 연결한다. 이 capability는 초기 추천, 검색 가능한 사용자 매핑, 좌·우 방향 설정과 같은 Spine session에서의 상태 preview를 제공한다.

## Requirements

### Requirement: 표준 Codex Pet 상태 계약
시스템은 Codex Pet v2의 표준 상태 rows 0–8을 `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review` 순서로 정의하고(MUST), 각 상태의 row index, 사용 frame 수와 재생 duration을 단일 runtime 독립 계약으로 제공해야 한다(MUST). Rows 9–10은 16방향 look frame 전용이며 표준 상태 mapping의 범위는 rows 0–8이다(MUST).

표준 상태 계약은 다음 값과 정확히 일치해야 한다(MUST).

| ID | Row | Frame 수 | Frame duration (ms) |
|---|---:|---:|---|
| `idle` | 0 | 6 | `280, 110, 110, 140, 140, 320` |
| `running-right` | 1 | 8 | `120, 120, 120, 120, 120, 120, 120, 220` |
| `running-left` | 2 | 8 | `120, 120, 120, 120, 120, 120, 120, 220` |
| `waving` | 3 | 4 | `140, 140, 140, 280` |
| `jumping` | 4 | 5 | `140, 140, 140, 140, 280` |
| `failed` | 5 | 8 | `140, 140, 140, 140, 140, 140, 140, 240` |
| `waiting` | 6 | 6 | `150, 150, 150, 150, 150, 260` |
| `running` | 7 | 6 | `120, 120, 120, 120, 120, 220` |
| `review` | 8 | 6 | `150, 150, 150, 150, 150, 280` |

#### Scenario: 표준 상태 계약 조회
- **WHEN** exporter와 installed preview가 표준 상태 계약을 조회한다
- **THEN** 두 구성 요소는 동일한 rows 0–8의 9개 row 순서와 frame 수를 사용한다
- **AND** installed preview는 표의 duration과 별도 idle 배율 계약으로 cell 재생 시간을 계산한다

#### Scenario: 표준 row의 미사용 cell 계산
- **WHEN** frame 수가 8보다 작은 rows 0–8의 표준 상태 row를 계산한다
- **THEN** 마지막 사용 frame 뒤부터 7번 column까지를 미사용 cell로 식별한다

#### Scenario: Pet 마우스 오버 표준 상태
- **WHEN** 일반 pointer가 Pet 위로 진입하고 v2 look cursor가 활성화되지 않는다
- **THEN** renderer는 표준 `jumping` row 4를 임시로 재생하고 pointer가 나가면 이전 상태로 복귀한다

#### Scenario: Installed preview의 idle 속도
- **WHEN** installed preview가 `idle` row를 재생한다
- **THEN** 각 cell의 표시 시간은 위 표의 해당 duration에 `6`을 곱한 값이어야 한다
- **AND** 다른 8개 상태는 표의 duration을 그대로 사용해야 한다

#### Scenario: look row 분리
- **WHEN** v2 pointer look이 활성화된다
- **THEN** renderer는 9개 표준 상태 mapping을 변경하지 않고 rows 9–10의 정적 look frame을 우선 표시한다

### Requirement: animation 자동 추천
시스템은 ready 스켈레톤이 제공한 실제 animation 이름만 대상으로 정규화된 이름 token과 아래의 상태별 우선순위를 사용해 9개 상태의 초기 매핑을 결정해야 한다(MUST). 이름 정규화는 NFKD, camel-case 경계 분리, `en-US` 소문자화, 영숫자가 아닌 문자의 underscore 치환과 양끝 underscore 제거 순서로 수행하고(MUST), 각 token의 끝 숫자를 제거한 별도 token도 일치 후보에 포함해야 한다(MUST).

각 상태는 `전용 이름` 전체 일치, `직접 token` 그룹의 왼쪽부터, `fallback token` 그룹의 왼쪽부터 순서로 선택해야 한다(MUST).

| 상태 | 전용 이름 우선순위 | 직접 token 우선순위 | Fallback token 우선순위 |
|---|---|---|---|
| `idle` | `w_happy_idle01_f` | `idle`, `rest`, `stand`, `breath` | `default`, `neutral` |
| `running-right` | `w_normal_walk01_f` | `running+right`, `run+right`, `walking+right`, `walk+right`, `walk`, `run` | `move` |
| `waving` | `w_cute_joy01_f` | `waving`, `wave`, `greeting`, `greet` | `joy`, `cheer`, `laugh` |
| `jumping` | `z_test_f_negi01`, `w_happy_surprise01_f` | `jumping`, `jump`, `leap`, `hop` | `surprise`, `excited` |
| `failed` | `w_happy_sad01_f` | `failed`, `fail`, `failure`, `error` | `sad`, `deflated`, `angry` |
| `waiting` | `w_happy_listen01_f` | `waiting`, `wait` | `listen`, `ask`, `talk` |
| `running` | `w_happy_doubt01_f` | `running`, `run`, `working`, `work`, `processing`, `process`, `thinking`, `think` | `doubt`, `focus`, `scan` |
| `review` | `w_happy_doubt02_f` | `review`, `reviewing`, `inspect`, `checking`, `check` | `doubt`, `focus`, `think` |

같은 token 그룹에 여러 후보가 있으면 정규화 이름이 token 결합과 정확히 같은 후보, 전용 이름 목록의 앞선 후보, `_b`로 끝나지 않는 front-facing 후보, `w_`로 시작하는 후보, token 수가 적은 후보, 원본 animation 목록에서 앞선 후보 순서로 동률을 해소해야 한다(MUST). `idle`에 의미 후보가 없으면 `pose_default`, 원본 목록의 첫 animation 순서로 실제 존재하는 값을 사용해야 한다(MUST). `running-right`를 포함한 나머지 상태에 의미 후보가 없으면 `pose_default`, 위 규칙으로 확정된 `idle`, 원본 목록의 첫 animation 순서로 실제 존재하는 값을 사용해야 하며(MUST), `running-left`는 확정된 `running-right`와 같은 animation을 사용해야 한다(MUST).

#### Scenario: 직접 이름이 있는 animation
- **WHEN** animation 목록에 상태 이름과 직접 일치하거나 더 높은 우선순위의 action 이름이 있다
- **THEN** 시스템은 일반적인 fallback보다 직접 후보를 추천한다

#### Scenario: 의미 기반 fallback
- **WHEN** `wave`나 `jump`라는 직접 이름은 없지만 `joy`나 `surprise` 후보가 있다
- **THEN** 시스템은 각각 waving과 jumping의 문서화된 fallback 우선순위에 따라 실제 animation을 추천한다

#### Scenario: PRSK hover 반응 우선 매핑
- **WHEN** animation 목록에 `z_test_F_negi01`이 있다
- **THEN** 시스템은 다른 jump나 surprise 후보보다 이 animation을 `jumping` 마우스 오버 상태에 우선 매핑한다

#### Scenario: 후보가 부족함
- **WHEN** 어떤 상태의 token 후보도 animation 목록에 없다
- **THEN** `idle`은 `pose_default`, 목록의 첫 animation 순으로 실제 존재하는 fallback을 선택한다
- **AND** `running-right`와 그 밖의 비-idle 상태는 `pose_default`, 확정된 idle, 목록의 첫 animation 순으로 실제 존재하는 fallback을 선택한다
- **AND** `running-left`는 확정된 `running-right` animation을 사용한다

#### Scenario: 범용 좌우 추천과 PRSK override
- **WHEN** 범용 recommender가 `running-right` animation을 결정한다
- **THEN** `running-left`는 같은 animation과 `mirrorX: true`로 생성되고 다른 상태의 `mirrorX`는 `false`여야 한다
- **AND** PRSK integration은 범용 결과를 받은 뒤 `running-right.mirrorX: true`, `running-left.mirrorX: false`로 명시적으로 덮어써야 한다

#### Scenario: animation 목록이 비어 있음
- **WHEN** animation 목록이 비어 있다
- **THEN** 시스템은 완성된 매핑을 만들지 않고 `ANIMATION_MISSING`으로 export를 차단한다

### Requirement: 좌우 이동 매핑
시스템은 `running-right`와 `running-left`가 같은 source animation을 사용할 수 있게 해야 하며(MUST), 두 상태 각각에 frame 순서를 유지하는 독립적인 `mirrorX` 선택을 제공해야 한다(MUST). PRSK integration의 초기 추천은 `running-right`의 `mirrorX`만 활성화해야 한다(MUST). `_b` suffix는 back-facing animation 의미를 유지하고 좌우 방향은 상태별 `mirrorX`로 표현해야 한다(MUST).

#### Scenario: 좌우 공통 walk source
- **WHEN** 목록에 front walk animation은 있지만 별도 left walk animation은 없다
- **THEN** 시스템은 양쪽 row에 같은 source 이름을 추천해야 한다
- **AND** PRSK source에서는 `running-right`의 상태별 `mirrorX`만 활성화하고 `running-left`의 상태별 `mirrorX`는 비활성화해야 한다

#### Scenario: right와 left 독립 반전
- **WHEN** 사용자가 `running-right` 또는 `running-left`의 수평 반전 설정을 변경한다
- **THEN** 시스템은 선택한 방향의 `mirrorX`만 변경해야 한다
- **AND** 반대 방향의 animation 및 `mirrorX` 선택을 유지해야 한다

#### Scenario: 방향별 전용 animation 선택
- **WHEN** 사용자가 `running-right` 또는 `running-left`에 다른 유효 animation을 선택한다
- **THEN** 시스템은 각 방향의 선택값과 독립적인 `mirrorX` 설정을 보존해야 한다

### Requirement: 사용자 매핑 확인과 수정
웹 UI는 ready source의 9개 상태와 현재 추천 animation을 모두 표시하고(MUST), 각 상태를 현재 스켈레톤의 실제 animation 중 하나로 검색해 변경할 수 있는 accessible combobox를 제공해야 한다(MUST). 상태 label과 목적 설명, 검색 label·placeholder·빈 결과 문구는 현재 locale로 표시해야 한다(MUST). combobox는 현재 session의 실제 animation만 원래 순서로 제공하고(MUST), 대소문자를 구분하지 않는 local substring 검색을 지원해야 한다(MUST). query 입력, option highlight 또는 빈 검색 결과만으로 mapping을 변경해서는 안 되며(MUST NOT), 실제 option을 확정할 때만 해당 상태를 변경해야 한다(MUST). PRSK source에서는 전체 캐릭터 수평 반전과 `running-right`, `running-left` 각각의 추가 수평 반전을 표시하고 수정할 수 있어야 한다(MUST). source가 교체되면 이전 source에만 존재하는 선택, 검색 query 또는 방향 설정을 유지해서는 안 되며(MUST NOT), 새 목록과 source 기본 facing으로 추천을 다시 계산해야 한다(MUST).

#### Scenario: 상태 매핑 표시
- **WHEN** PRSK LiveSD preview가 ready가 된다
- **THEN** UI는 현재 locale의 9개 상태 label과 목적 설명, 추천 animation, 전체 수평 반전과 좌·우 이동의 개별 수평 반전 여부를 표시해야 한다
- **AND** 각 상태 combobox는 현재 source의 실제 animation만 검색할 수 있어야 한다

#### Scenario: locale 변경
- **WHEN** 사용자가 mapping을 수정한 뒤 locale을 변경한다
- **THEN** 상태 label과 목적 설명, 검색 UI 문구만 새 locale로 변경되어야 한다
- **AND** 상태 ID, animation, mirror, 현재 query와 preview 재생은 유지되어야 한다

#### Scenario: 검색 중 mapping 보존
- **WHEN** 사용자가 상태 combobox에 substring query를 입력하거나 keyboard로 option을 highlight한다
- **THEN** listbox는 일치하는 실제 animation만 원래 순서로 표시해야 한다
- **AND** 사용자가 실제 option을 확정하기 전까지 mapping과 preview animation은 변경되지 않아야 한다

#### Scenario: 유효한 override
- **WHEN** 사용자가 상태 combobox에서 다른 실제 animation을 확정한다
- **THEN** 해당 상태만 새 값으로 갱신되고 다른 상태의 선택과 방향 설정은 유지되어야 한다
- **AND** 현재 Spine preview session은 새로 선택한 실제 animation을 즉시 재생해야 한다

#### Scenario: source 교체
- **WHEN** 다른 스켈레톤의 preview가 성공적으로 활성화된다
- **THEN** 시스템은 새 animation 목록과 source 기본 facing만 사용해 전체 추천과 방향 설정을 다시 계산해야 한다
- **AND** 이전 source의 상태별 검색 query를 비워야 한다

#### Scenario: preset 적용 후 검색 reset
- **WHEN** 사용자가 다른 저장 preset 또는 `새 세션`을 선택한다
- **THEN** 시스템은 검증된 mapping을 적용하고 모든 상태 combobox query를 비워야 한다

### Requirement: 상태별 실시간 Spine preview
웹 UI의 상태 preview는 현재 활성 Spine session에서 실제 source animation을 재생해야 한다(MUST). Preview toolbar는 9개 표준 상태를 계약 순서로 나타내는 아이콘 바로가기 group을 제공하고(MUST), 상태 combobox focus와 option 확정도 같은 session에서 해당 animation을 재생해야 한다(MUST). 검색 query, option highlight와 빈 결과는 현재 mapping과 재생을 유지해야 한다(MUST). 직접 animation combobox를 선택하면 상태 선택을 해제하고 해당 animation을 재생해야 한다(MUST). Preview 동작은 option 확정에 따른 해당 mapping 변경 외의 mirror, metadata, package, export와 network 상태를 유지해야 한다(MUST).

바로가기 glyph는 상태 순서대로 `◉`, `→`, `←`, `👋`, `↑`, `×`, `…`, `⚙`, `⌕`를 사용하고(MUST), glyph 자체는 `aria-hidden`인 장식이며 현재 locale의 상태명과 설명을 accessible name과 tooltip으로 제공해야 한다(MUST). 폭이 36rem보다 크면 한 행 9열, 36rem 이하면 3×3 grid로 배치해야 한다(MUST).

#### Scenario: 현재 상태 매핑 확인
- **WHEN** 사용자가 상태 row의 animation combobox에 focus한다
- **THEN** 현재 활성 Spine preview session은 그 row에 매핑된 source animation을 재생해야 한다
- **AND** 해당 상태 바로가기만 현재 선택 상태로 표시되어야 한다
- **AND** 다른 상태의 mapping은 변경되지 않아야 한다

#### Scenario: 상태 animation 변경 직후 확인
- **WHEN** 사용자가 상태 row에서 다른 유효 animation option을 확정한다
- **THEN** UI는 mapping을 갱신하고 같은 Spine preview session에서 선택한 animation을 즉시 재생해야 한다
- **AND** 해당 상태 바로가기는 갱신된 animation을 사용해야 한다
- **AND** 별도의 preview renderer 또는 spritesheet를 생성하지 않아야 한다

#### Scenario: 검색만 수행
- **WHEN** 사용자가 현재 상태 combobox에서 query를 입력하고 option을 확정하지 않는다
- **THEN** 현재 Spine preview animation과 package mapping은 그대로 유지되어야 한다

#### Scenario: 상태 아이콘 바로가기
- **WHEN** ready source에서 사용자가 9개 상태 중 하나의 바로가기 icon을 활성화한다
- **THEN** 시스템은 해당 상태의 현재 mapping animation을 기존 session에서 재생해야 한다
- **AND** 활성화한 button만 `aria-pressed` 선택 상태를 가져야 한다
- **AND** mapping, mirror, metadata와 기존 package 결과를 변경해서는 안 된다

#### Scenario: 직접 animation 선택과 공존
- **WHEN** 사용자가 상태 바로가기 재생 뒤 직접 animation combobox에서 다른 실제 animation을 선택한다
- **THEN** 시스템은 직접 선택한 animation을 같은 session에서 재생해야 한다
- **AND** 상태 바로가기의 현재 선택 상태를 해제해야 한다
- **AND** 9개 상태 mapping은 유지되어야 한다

#### Scenario: Idle preview 상태
- **WHEN** active preview 또는 유효한 9개 상태 mapping이 없다
- **THEN** 모든 상태 바로가기 button은 비활성화되어야 한다
- **AND** 활성화 시도로 session, request 또는 build를 시작해서는 안 된다

#### Scenario: source 교체
- **WHEN** 다른 source가 성공적으로 ready가 된다
- **THEN** 이전 상태 선택을 해제하고 새 source의 추천 mapping으로 9개 바로가기를 갱신해야 한다

#### Scenario: 현재 session에서 상태 재생
- **WHEN** 사용자가 여러 상태 바로가기를 연속으로 활성화한다
- **THEN** 각 동작은 현재 session의 `play()`만 호출해야 한다
- **AND** catalog, model, adapter 또는 export 작업을 새로 시작해서는 안 된다

#### Scenario: 모바일 상태 바로가기 배치
- **WHEN** 폭 36rem 이하의 모바일 viewport에서 preview toolbar를 표시한다
- **THEN** 9개 상태 바로가기는 toolbar content box 안의 3×3 grid로 배치되어야 한다
- **AND** shortcut group, button 또는 toolbar가 viewport 방향으로 가로 overflow해서는 안 된다
- **AND** 다른 preview control과 겹치거나 별도 flex column으로 밀려나서는 안 된다

### Requirement: Mapping mirror의 실시간 LiveSD preview

웹 UI는 전체 수평 반전과 활성 Codex Pet 상태의 `mirrorX`를 export와 동일한 XOR 규칙으로 합성해 현재 LiveSD preview session에 적용해야 한다(MUST). 상태 shortcut, mapping combobox focus·확정과 상태별 mirror checkbox 변경은 해당 상태의 animation과 합성 반전을 함께 preview해야 하며(MUST), 전체 반전 checkbox 변경은 현재 활성 상태를 유지한 채 합성 방향을 즉시 갱신해야 한다(MUST). 직접 animation combobox는 상태 선택을 해제하되 전체 반전만 preview에 유지해야 한다(MUST).

#### Scenario: 기본 PRSK 오른쪽 이동 상태
- **WHEN** 전체 반전이 꺼져 있고 기본 `running-right.mirrorX`가 켜진 상태에서 오른쪽 이동 shortcut을 누른다
- **THEN** 기존 LiveSD session은 오른쪽 이동 animation을 재생하고 수평 반전된다
- **AND** mapping과 package 결과는 변경되지 않는다

#### Scenario: 전체와 상태 반전 XOR
- **WHEN** 활성 상태의 `mirrorX`와 전체 반전이 모두 켜져 있다
- **THEN** LiveSD preview의 최종 수평 반전은 꺼진다
- **AND** 둘 중 하나만 켜져 있으면 최종 수평 반전은 켜진다

#### Scenario: 상태별 mirror checkbox 변경
- **WHEN** 사용자가 오른쪽 또는 왼쪽 이동 row의 mirror checkbox를 변경한다
- **THEN** 해당 row가 현재 상태 preview로 선택된다
- **AND** 새 XOR 결과와 현재 mapping animation이 같은 session에 즉시 적용된다

#### Scenario: 직접 animation 선택
- **WHEN** 상태 반전 preview 뒤 direct animation combobox에서 animation을 선택한다
- **THEN** 상태 shortcut 선택은 해제된다
- **AND** preview는 상태별 mirror를 제외하고 현재 전체 반전만 적용한다

#### Scenario: source와 locale lifecycle
- **WHEN** locale만 바뀐다
- **THEN** 전체·상태별 반전과 현재 preview 방향은 보존된다
- **WHEN** 다른 source가 성공적으로 ready가 된다
- **THEN** 이전 상태 선택과 preview 반전은 새 source 기본값으로 초기화된다
