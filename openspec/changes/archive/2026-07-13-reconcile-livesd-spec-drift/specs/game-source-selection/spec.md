## MODIFIED Requirements

### Requirement: 게임 integration 활성화 조건

Registry의 `available` entry는 해당 ID의 source lifecycle, preview 입력과 builder source 계약을 구현한 integration을 가져야 한다(MUST). Garupa entry는 추가로 고정 Spine 4.0 runtime license/provenance, external fixture matrix, 73-frame package와 artifact allowlist receipt를 가져야 하며(MUST), registry validation은 이 조건을 충족한 entry만 선택 가능한 상태로 허용해야 한다(MUST).

#### Scenario: integration 없는 상태 변경 거부
- **WHEN** `strr` 또는 `garupa` entry에 실행 가능한 integration 없이 상태를 `available`로 구성한다
- **THEN** type 또는 registry 검증이 해당 구성을 거부해야 한다

#### Scenario: 향후 available 게임 전환
- **WHEN** 향후 게임이 검증된 integration과 함께 `available`로 등록된다
- **THEN** 탭 선택은 기존 active request와 preview session을 정리한 뒤 새 integration을 mount해야 한다
- **AND** 이전 게임의 source, recipe 또는 방향 설정을 새 게임에 재사용해서는 안 된다

#### Scenario: 검증된 Garupa 활성화
- **WHEN** Garupa integration과 모든 activation evidence가 검증된 build에 기록된다
- **THEN** registry는 dev·production mode 구분 없이 `garupa`를 `available`로 허용해야 한다
- **AND** production artifact는 공식 Spine 4.0 runtime과 고지를 포함하되 Garupa 원본 asset은 포함하지 않아야 한다
