## MODIFIED Requirements

### Requirement: 모든 game runtime의 명시적 preset loader
PRSK, STRR와 Garupa 화면은 같은 preset dropdown과 `새 세션` option을 input source·catalog·character control보다 먼저 표시하고(MUST), dropdown 바로 아래에 locale별 `프리셋 불러오기` action을 제공해야 한다(MUST). 유효한 저장 preset이 대기 선택된 동안에는 같은 영역에서 locale별 `새로 만들기` action을 `프리셋 불러오기` 아래에 표시해야 하며(MUST), `새 세션`이 선택된 동안에는 이 action을 표시하지 않아야 한다(MUST NOT). 같은 dropdown을 packaging header에 중복 표시해서는 안 된다(MUST NOT). 마지막으로 저장하거나 불러온 `activePresetName`은 다음 mount의 dropdown 대기 선택으로 복원하되(MUST), mount 또는 저장 preset option 선택만으로 설정 적용, storage write, catalog·model request, file access, preview 생성이나 source 교체를 시작해서는 안 된다(MUST NOT). `프리셋 불러오기`는 유효한 저장 preset이 대기 선택일 때만 활성화하고(MUST), catalog·model·import 작업과 충돌하는 동안에는 비활성화해야 한다(MUST).

#### Scenario: 다음 방문의 대기 선택
- **WHEN** `My Pet`이 마지막 active preset인 상태로 PRSK, STRR 또는 Garupa 화면을 mount한다
- **THEN** dropdown은 최초부터 `My Pet`을 표시하고 `프리셋 불러오기`를 활성화해야 한다
- **AND** `새로 만들기`를 `프리셋 불러오기` 아래에 표시해야 한다
- **AND** 사용자가 그 action을 실행하기 전까지 설정 적용, storage write, catalog·model request와 preview 생성은 0건이어야 한다

#### Scenario: 저장 preset option만 변경
- **WHEN** ready source가 있거나 없는 상태에서 사용자가 dropdown의 다른 저장 preset을 선택한다
- **THEN** 대기 선택만 바뀌고 현재 적용 preset, metadata, mapping, preview, source와 저장 `activePresetName`은 유지되어야 한다
- **AND** 선택된 저장 preset 때문에 network 또는 file 작업을 시작해서는 안 된다

#### Scenario: 새 세션 선택
- **WHEN** 사용자가 preset dropdown에서 `새 세션`을 선택한다
- **THEN** 저장 catalog는 유지하되 active preset을 비우고 현재 source의 추천 mapping과 기본 metadata·framing·눈 이동량·반전으로 reset해야 한다
- **AND** `프리셋 불러오기`는 비활성화되고 `새로 만들기`는 표시되지 않으며 다음 방문의 기본 선택은 `새 세션`이어야 한다

#### Scenario: 저장 preset에서 새로 만들기
- **WHEN** 저장 preset이 대기 선택된 상태에서 사용자가 `새로 만들기`를 실행한다
- **THEN** 시스템은 preset dropdown의 `새 세션` option을 선택한 것과 같은 상태 전이와 request 취소를 실행해야 한다
- **AND** 저장 catalog는 유지하되 active preset과 대기 선택을 비우고 현재 source의 추천 mapping과 기본 metadata·framing·눈 이동량·반전으로 reset해야 한다
- **AND** `프리셋 불러오기`는 비활성화되고 `새로 만들기`는 표시되지 않아야 한다

### Requirement: 새 세션 전용 character catalog action
PRSK, STRR와 Garupa의 remote character catalog/list 불러오기 action은 preset dropdown의 대기 선택이 `새 세션`일 때만 DOM과 accessibility tree에 표시되어야 하며(MUST), provider별 기존 실행 조건을 만족할 때 활성화되어야 한다(MUST). 저장 preset이 대기 선택이면 `프리셋 불러오기`와 `새로 만들기`를 표시하고 character catalog action은 렌더링하지 않아야 한다(MUST NOT). 이 gate는 새 request 시작을 막아야 하며(MUST), local upload file 선택과 명시적 local import까지 금지하는 것으로 확장해서는 안 된다(MUST NOT).

#### Scenario: 저장 preset 선택 상태
- **WHEN** PRSK, STRR 또는 Garupa에서 저장 preset이 dropdown에 선택되어 있다
- **THEN** `프리셋 불러오기`와 `새로 만들기`는 표시되고 해당 runtime의 character catalog/list action은 DOM과 accessibility tree에 없어야 한다

#### Scenario: dropdown으로 새 세션 선택
- **WHEN** 같은 화면에서 preset dropdown의 `새 세션`을 선택한다
- **THEN** `프리셋 불러오기`는 비활성이고 `새로 만들기`는 표시되지 않아야 한다
- **AND** character catalog/list action은 표시되고 provider별 활성화 조건을 만족해야 한다

#### Scenario: 새로 만들기로 새 세션 선택
- **WHEN** 같은 화면에서 저장 preset 아래의 `새로 만들기`를 실행한다
- **THEN** character catalog/list action은 표시되고 provider별 활성화 조건을 만족해야 한다
- **AND** 이 전환만으로 catalog 또는 model request를 시작해서는 안 된다
