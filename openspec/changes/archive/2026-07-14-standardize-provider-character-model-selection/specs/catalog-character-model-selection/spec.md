## ADDED Requirements

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
