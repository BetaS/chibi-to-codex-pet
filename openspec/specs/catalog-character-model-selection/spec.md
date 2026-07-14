# 카탈로그 캐릭터·모델 선택 명세

## Purpose

모든 카탈로그형 provider가 캐릭터를 먼저 고른 뒤 해당 캐릭터의 모델·에디션·의상 leaf를 선택하는 공통 workflow와 계층 정규화, 기본 Pet 이름 및 preset 복원 계약을 정의한다.

## Requirements

### Requirement: 카탈로그형 provider의 캐릭터 우선 선택
캐릭터별로 하나 이상의 모델, 에디션 또는 의상 leaf를 제공하는 모든 카탈로그형 provider는 검색 가능한 캐릭터 선택과 선택된 캐릭터의 leaf 선택을 순서대로 제공해야 한다(MUST). 캐릭터 commit은 해당 캐릭터의 leaf option만 결정하고 현재 pending leaf 선택을 비워야 하며(MUST), resource request를 시작해서는 안 된다(MUST NOT). Leaf commit은 현재 catalog와 상위 캐릭터에 속한 canonical leaf identity를 다시 검증한 뒤 해당 source load를 시작해야 한다(MUST).

#### Scenario: 여러 모델을 가진 캐릭터 선택
- **WHEN** catalog에 한 캐릭터의 모델 두 개와 다른 캐릭터의 모델이 있고 사용자가 첫 캐릭터를 commit한다
- **THEN** 두 번째 selector에는 첫 캐릭터의 모델 두 개만 표시되어야 한다
- **AND** model resource request는 0건이어야 한다
- **WHEN** 사용자가 그중 한 모델을 commit한다
- **THEN** 해당 canonical leaf identity의 source load가 한 번 시작되어야 한다

#### Scenario: single-model 캐릭터 선택
- **WHEN** catalog에 모델 하나만 가진 캐릭터가 있다
- **THEN** 시스템은 캐릭터와 모델을 각각 명시적으로 commit할 수 있게 해야 한다
- **AND** 캐릭터 commit만으로 모델을 자동 선택하거나 요청해서는 안 된다

### Requirement: Provider metadata의 계층 정규화
카탈로그형 provider는 신뢰 가능한 구조화 metadata 또는 provider adapter가 검증한 stable ID 규칙으로 leaf option을 캐릭터 그룹에 연결해야 한다(MUST). 정규화는 catalog 응답에 존재하는 option만 사용하고(MUST), 앱에 고정된 provider snapshot 전체 목록이나 별도 존재 probe를 요구해서는 안 된다(MUST NOT). 캐릭터를 안전하게 공유 그룹으로 판별할 수 없는 유효한 leaf는 삭제하지 않고 독립적으로 선택 가능한 singleton character group으로 보존해야 한다(MUST).

#### Scenario: 구조화된 캐릭터 metadata
- **WHEN** provider catalog가 character identity와 그 character의 모델 목록을 명시한다
- **THEN** selector는 해당 구조를 그대로 캐릭터와 leaf 단계에 사용해야 한다

#### Scenario: 검증된 ID 기반 그룹
- **WHEN** provider adapter가 두 leaf ID에서 같은 stable character token을 검증한다
- **THEN** 두 leaf는 같은 캐릭터의 model option으로 표시되어야 한다

#### Scenario: 그룹을 판별할 수 없는 leaf
- **WHEN** 유효한 catalog leaf가 provider의 캐릭터 그룹 규칙과 일치하지 않는다
- **THEN** 해당 leaf는 singleton character group의 model로 계속 선택할 수 있어야 한다
- **AND** normalization만으로 추가 network request를 보내서는 안 된다

### Requirement: 카탈로그 source의 기본 Pet 이름
저장 preset을 명시적으로 적용하지 않은 새 카탈로그 source가 ready가 되면 builder의 기본 Pet 이름은 source activation 시점의 visible label을 사용한 `모델/에디션 이름 - 캐릭터 이름`이어야 한다(MUST). 명시적으로 적용한 preset의 Pet 이름과 사용자가 편집한 metadata는 source 기본값보다 우선해야 하고(MUST), locale 또는 검색 query 변경만으로 다시 계산하거나 덮어써서는 안 된다(MUST NOT).

#### Scenario: 새 모델의 기본 이름
- **WHEN** 현재 locale에서 캐릭터 label이 `하츠네 미쿠`이고 모델 label이 `스트리트`인 source가 처음 ready가 된다
- **THEN** 저장 preset이 없는 builder의 기본 Pet 이름은 `스트리트 - 하츠네 미쿠`여야 한다

#### Scenario: 저장 preset 이름 우선
- **WHEN** 사용자가 `Miku Night`라는 Pet 이름이 저장된 preset을 명시적으로 불러와 해당 leaf source가 ready가 된다
- **THEN** builder의 Pet 이름은 source 기본 이름 대신 `Miku Night`여야 한다

#### Scenario: metadata 상태 보존
- **WHEN** ready source에서 사용자가 Pet 이름을 편집한 뒤 locale을 변경하거나 selector query를 입력한다
- **THEN** 편집한 Pet 이름은 그대로 유지되어야 한다
- **AND** source load 또는 preset 적용이 새로 시작되어서는 안 된다

### Requirement: Canonical leaf 선택 복원
카탈로그형 provider의 preset source identity는 실제 load에 사용하는 canonical leaf ID를 보존해야 한다(MUST). Preset을 명시적으로 불러오거나 catalog를 재로드할 때 leaf가 현재 catalog에 남아 있으면 시스템은 상위 캐릭터와 leaf 선택을 함께 복원해야 하며(MUST), leaf가 없으면 pending 두 단계 선택을 비우고 기존 catalog selection 오류 계약을 따라야 한다(MUST).

#### Scenario: Preset leaf 복원
- **WHEN** 저장 preset의 canonical leaf ID가 현재 catalog의 한 캐릭터 아래에 존재한다
- **THEN** preset load는 해당 캐릭터와 leaf selector를 함께 복원해야 한다
- **AND** 같은 canonical leaf ID로 source load를 시작해야 한다

#### Scenario: Catalog 재로드 후 leaf 유지
- **WHEN** 선택된 canonical leaf와 그 상위 캐릭터가 새 catalog에도 존재한다
- **THEN** 두 selector는 같은 선택을 유지해야 한다
- **AND** catalog 재로드 자체가 model resource를 다시 요청해서는 안 된다

### Requirement: locale별 공식 캐릭터 label
카탈로그형 provider는 현재 app locale에서 공식적으로 사용하는 캐릭터 이름을 known canonical character identity의 visible label로 제공해야 한다(MUST). Locale별 label projection은 canonical character·leaf identity와 catalog data를 변경해서는 안 되며(MUST NOT), locale 전환은 selector의 visible label과 검색 대상만 다시 계산하고 현재 캐릭터·leaf 선택, preview와 request generation을 유지해야 한다(MUST). 공식 locale label을 알 수 없는 유효한 identity는 provider가 검증한 label 또는 canonical ID 기반 fallback으로 보존해야 하고(MUST), 다른 캐릭터의 이름을 추측해서는 안 된다(MUST NOT).

#### Scenario: 지원 locale의 공식 캐릭터 이름
- **WHEN** known canonical character를 `ko`, `en`, `ja`, `zh-CN` 중 하나의 locale에서 표시한다
- **THEN** 캐릭터 selector와 새 source의 기본 Pet 이름은 해당 지역 공식 이름을 사용해야 한다
- **AND** 내부 선택값과 preset source identity는 같은 canonical character·leaf ID를 유지해야 한다

#### Scenario: locale 전환 중 선택 보존
- **WHEN** 사용자가 캐릭터와 leaf를 선택한 상태에서 app locale을 변경한다
- **THEN** 캐릭터 visible label과 그 label의 검색 결과는 새 locale로 즉시 갱신되어야 한다
- **AND** 캐릭터·leaf 선택, active preview와 request generation은 유지되어야 한다
- **AND** 이미 ready인 source의 Pet 이름을 다시 계산하거나 덮어써서는 안 된다

#### Scenario: 공식 이름이 없는 identity
- **WHEN** catalog에 공식 locale map에 없는 mob, custom 또는 신규 canonical character identity가 있다
- **THEN** 해당 identity는 검증된 provider label 또는 canonical ID 기반 fallback으로 계속 검색·선택할 수 있어야 한다
- **AND** 알려진 다른 캐릭터의 공식 이름을 할당해서는 안 된다

#### Scenario: PRSK 번호형 mob과 staff 그룹
- **WHEN** PRSK catalog에 `sd_mob<digits>` 또는 `sd_staff<digits>` leaf가 하나 이상 있다
- **THEN** 캐릭터 selector는 해당 leaf를 각각 stable `Mob`과 `Staff` 그룹 하나로 묶어야 한다
- **AND** 모델 selector는 선택한 family에 속한 leaf만 번호 또는 검증된 provider label로 표시해야 한다
- **AND** canonical model ID, preset source identity와 request target은 변경해서는 안 된다
- **AND** 해당 exact pattern과 일치하지 않는 singleton identity를 `Mob` 또는 `Staff`로 추측해서는 안 된다

#### Scenario: 실제 Akito ordinal token
- **WHEN** PRSK catalog가 `sd_11akito_normal` 또는 같은 `11akito` character token의 leaf를 제공한다
- **THEN** 캐릭터 selector와 새 source의 기본 Pet 이름은 현재 locale의 Akito 공식 이름을 사용해야 한다
- **AND** visible label에 raw `akito` token을 노출해서는 안 된다

### Requirement: selector popup viewport 가시성
카탈로그형 provider와 Pet animation mapping에서 사용하는 searchable selector popup은 clipping ancestor 밖에 렌더링되어야 하고(MUST), input의 현재 viewport 위치에 따라 위 또는 아래의 가용 공간에 배치되어야 한다(MUST). Popup은 선택한 방향의 viewport 공간을 넘지 않는 높이로 내부 스크롤을 제공해야 하며(MUST), popup 이동이 canonical option, highlight, keyboard commit과 ARIA 관계를 변경해서는 안 된다(MUST NOT).

#### Scenario: viewport 하단의 selector
- **WHEN** 사용자가 viewport 하단 또는 overflow-hidden panel 하단의 searchable selector를 연다
- **THEN** popup은 input 위쪽으로 배치되고 ancestor 경계에 잘리지 않아야 한다
- **AND** 모든 option은 popup 내부 스크롤로 탐색·선택할 수 있어야 한다

#### Scenario: 열린 popup 중 문서 스크롤
- **WHEN** popup이 열린 상태에서 viewport 크기 또는 ancestor scroll 위치가 바뀐다
- **THEN** popup은 현재 input rect에 맞춰 위치와 가용 높이를 다시 계산해야 한다
- **AND** 현재 query, highlight와 selection을 유지해야 한다

### Requirement: PRSK 캐릭터의 공식 유닛 section
PRSK 캐릭터 selector는 catalog에 존재하는 known canonical character를 `Leo/need`, `MORE MORE JUMP!`, `Vivid BAD SQUAD`, `Wonderlands×Showtime`, `25시, 나이트 코드에서.`, `VIRTUAL SINGER`, `기타` 순서의 비선택 section으로 표시해야 한다(MUST). Known character는 각 유닛의 공식 roster 순서로 표시해야 하고(MUST), locale별 section label은 stable unit key와 canonical character·model identity를 변경해서는 안 된다(MUST NOT). 유효한 Mob·Staff·custom·미분류 identity는 마지막 `기타` section에 보존해야 하며(MUST), section heading은 option highlight·commit 또는 network request 대상이 되어서는 안 된다(MUST NOT).

#### Scenario: 공식 유닛과 VIRTUAL SINGER 순서
- **WHEN** catalog에 다섯 스토리 유닛과 Miku·Rin·Len·Luka·MEIKO·KAITO character leaf가 순서 없이 포함된다
- **THEN** selector는 다섯 스토리 유닛을 공식 순서로 표시한 뒤 독립 `VIRTUAL SINGER` section을 표시해야 한다
- **AND** 각 section 안의 known character를 공식 roster 순서로 표시해야 한다
- **AND** Virtual Singer character를 스토리 유닛에 중복 표시해서는 안 된다

#### Scenario: 기타 identity 보존
- **WHEN** catalog에 numbered Mob·Staff family와 known roster에 없는 valid singleton 또는 custom identity가 있다
- **THEN** selector는 해당 identity를 마지막 `기타` section에서 계속 검색·선택할 수 있어야 한다
- **AND** identity를 알려진 유닛으로 추측하거나 canonical model ID를 변경해서는 안 된다

#### Scenario: section 검색과 결과 축소
- **WHEN** 사용자가 character label·canonical key·unit key 또는 현재 locale의 unit label로 검색한다
- **THEN** 일치하는 selectable option과 그 option이 속한 section heading만 표시해야 한다
- **AND** 검색과 heading rendering은 character·model 선택, preview와 request generation을 변경해서는 안 된다

#### Scenario: section heading interaction
- **WHEN** 사용자가 PRSK character listbox를 pointer 또는 arrow key로 탐색한다
- **THEN** section heading은 highlight·active descendant·commit 대상에서 제외되어야 한다
- **AND** 실제 character option만 선택 가능해야 한다
- **AND** PRSK group metadata를 제공하지 않는 다른 provider와 Pet animation mapping은 기존 flat option behavior를 유지해야 한다

#### Scenario: locale 전환 중 unit 보존
- **WHEN** 캐릭터와 model이 선택된 상태에서 app locale을 변경한다
- **THEN** unit section과 character visible label은 새 locale 표기로 갱신되어야 한다
- **AND** stable unit key, canonical character·model 선택, preview와 request generation은 유지되어야 한다

### Requirement: STRR와 Garupa 캐릭터의 공식 소속 section

STRR와 Garupa character selector는 provider adapter가 검증한 stable 소속 identity에 따라 catalog에 존재하는 캐릭터 option을 공식 순서의 비선택 section으로 표시해야 한다(MUST). STRR는 frozen catalog의 exact canonical roster를 세이쇼 음악학교, 린메이칸 여학교, 프론티어 예술학교, 시크펠트 음악학원, 세이란 종합예술원, 기타 순서로 표시해야 한다(MUST). Garupa는 고유 캐릭터의 검증된 `bandId`를 사용해 Poppin'Party, Afterglow, Pastel＊Palettes, Roselia, Hello, Happy World!, Morfonica, RAISE A SUILEN, MyGO!!!!!, 기타 순서로 표시해야 한다(MUST). Known character는 각 소속의 공식 roster 순서를 따라야 하며(MUST), unknown STRR ID, unknown Garupa band ID, Garupa Mob과 미매핑 identity는 마지막 기타 section에서 계속 검색·선택할 수 있어야 한다(MUST). Section heading은 option highlight·commit 또는 request 대상이 되어서는 안 되고(MUST NOT), section projection을 위해 추가 provider request를 보내서는 안 된다(MUST NOT).

#### Scenario: STRR 공식 학교 section
- **WHEN** STRR catalog에 다섯 학교의 known canonical character와 roster에 없는 유효한 character가 순서 없이 존재한다
- **THEN** selector는 세이쇼, 린메이칸, 프론티어, 시크펠트, 세이란, 기타 section 순서로 해당 option을 표시해야 한다
- **AND** known character는 각 학교의 공식 roster 순서로, unknown character는 기타 section에서 원본 canonical ID로 선택 가능해야 한다

#### Scenario: Garupa 공식 band section
- **WHEN** Garupa catalog에 known `bandId`를 가진 고유 캐릭터가 순서 없이 존재한다
- **THEN** selector는 Poppin'Party부터 MyGO!!!!!까지 공식 band 순서로 section을 표시하고 각 band의 캐릭터를 공식 roster 순서로 표시해야 한다
- **AND** character·bundle identity와 model request target은 section 추가 전과 같아야 한다

#### Scenario: Garupa 기타 section
- **WHEN** catalog에 단일 Mob group, 미매핑 model group 또는 unknown `bandId`의 고유 캐릭터가 있다
- **THEN** selector는 해당 option을 마지막 기타 section에서 모두 보존해야 한다
- **AND** Mob과 미매핑 option을 서로 합치거나 unknown character를 known band로 추측해서는 안 된다

#### Scenario: section 검색과 heading interaction
- **WHEN** 사용자가 STRR/Garupa character label, canonical key, section key, 현재 locale의 section label 또는 지원 alias로 검색·탐색한다
- **THEN** 일치하는 selectable option과 해당 section heading만 표시해야 한다
- **AND** heading은 pointer·arrow key highlight와 commit 대상에서 제외되고 실제 character option만 선택 가능해야 한다
- **AND** 검색과 heading rendering은 selection, preview, preset과 network generation을 변경해서는 안 된다

#### Scenario: locale 전환과 추가 request 금지
- **WHEN** 캐릭터와 leaf가 선택된 상태에서 app locale을 변경하거나 section option을 다시 계산한다
- **THEN** section·character visible label은 새 locale로 갱신되고 stable section key와 canonical character·leaf selection은 유지되어야 한다
- **AND** section projection만으로 catalog, model 또는 별도 소속 metadata request를 시작해서는 안 된다
