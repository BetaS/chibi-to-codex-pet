# GitHub Star 안내 명세

## Purpose

Pet 생성을 완료한 사용자가 작업 흐름을 방해받지 않으면서 프로젝트의 GitHub 저장소를 확인하고 Star로 응원할 수 있는 contextual 안내와 항상 접근 가능한 상단 진입점을 제공한다.

## Requirements

### Requirement: Pet 생성 완료 직후 Star 안내

시스템은 현재 빌더 작업 세션에서 첫 번째 Codex Pet package export와 독립 validation이 성공해 결과가 준비된 직후 GitHub 저장소를 안내하는 비차단형 모달을 표시해야 한다(MUST). 모달은 같은 빌더 작업 세션에서 최대 한 번만 표시해야 하며(MUST), ZIP 다운로드 클릭이나 이후의 성공한 재생성으로 다시 표시해서는 안 된다(MUST NOT). 생성 취소·실패 또는 validation 실패에서는 표시해서는 안 된다(MUST NOT). 다운로드 링크 클릭은 기존 Blob 다운로드와 분석 이벤트를 그대로 유지해야 한다(MUST).

#### Scenario: 첫 Pet 생성 성공
- **WHEN** 사용자의 첫 package export와 독립 validation이 성공해 Pet 결과가 준비된다
- **THEN** ZIP 링크를 클릭하지 않아도 GitHub Star 안내 모달이 즉시 표시되어야 한다
- **AND** 다운로드 분석 이벤트는 전송되지 않아야 한다

#### Scenario: 반복 생성과 다운로드
- **WHEN** 사용자가 안내를 닫은 뒤 같은 빌더 작업 세션에서 Pet을 다시 생성하거나 ZIP 다운로드 링크를 반복 클릭한다
- **THEN** 생성 결과, Blob 다운로드와 각 다운로드 클릭의 분석 이벤트는 유지되어야 한다
- **AND** 시스템은 Star 안내 모달을 다시 표시해서는 안 된다

#### Scenario: Pet 생성 미완료
- **WHEN** sampling, packaging 또는 validation이 취소되거나 실패한다
- **THEN** 시스템은 Star 안내 모달을 표시해서는 안 된다

### Requirement: 상단 GitHub Star 인디케이터

앱 header는 현재 provider, source와 build 상태에 관계없이 locale별 GitHub Star 인디케이터를 항상 표시해야 한다(MUST). 인디케이터는 `https://github.com/BetaS/chibi-to-codex-pet`을 새 browsing context에서 여는 native anchor여야 하고(MUST), opener referrer를 전달하지 않아야 하며(MUST), accessible name은 Star action과 새 탭 동작을 함께 알려야 한다(MUST). 인디케이터를 렌더링하기 위해 외부 script, iframe, GitHub API 또는 mount-time network request를 사용해서는 안 된다(MUST NOT).

#### Scenario: 앱 최초 진입
- **WHEN** 사용자가 앱에 진입한다
- **THEN** header action 영역에 현재 locale의 GitHub Star 인디케이터가 표시되어야 한다
- **AND** 정확한 repository URL, 새 창 target과 안전한 relation을 가져야 한다

#### Scenario: Star 인디케이터 활성화
- **WHEN** 사용자가 상단 GitHub Star 인디케이터를 활성화한다
- **THEN** browser는 repository를 새 browsing context에서 열어야 한다
- **AND** 현재 provider, source, Pet metadata와 build 결과를 변경해서는 안 된다

#### Scenario: locale 변경
- **WHEN** 사용자가 앱 locale을 변경한다
- **THEN** 인디케이터의 visible label과 accessible name은 선택한 locale로 갱신되어야 한다
- **AND** repository URL과 새 탭 동작은 유지되어야 한다

#### Scenario: 인디케이터 idle network
- **WHEN** 앱이 header 인디케이터를 mount하고 사용자가 링크를 활성화하지 않는다
- **THEN** 인디케이터 자체는 외부 network request나 third-party code 실행을 시작해서는 안 된다

### Requirement: 선택 가능한 저장소 이동
Star 안내는 사용자가 저장소로 이동하거나 앱에 남을 수 있는 명시적 선택을 제공해야 한다(SHALL).

#### Scenario: GitHub 이동 선택
- **WHEN** 사용자가 Star 안내의 주요 링크를 누른다
- **THEN** 시스템은 `https://github.com/BetaS/chibi-to-codex-pet`을 새 탭에서 연다
- **AND** 다운로드된 Pet이나 현재 빌더 상태는 변경하지 않는다

#### Scenario: 안내 닫기
- **WHEN** 사용자가 닫기 동작 또는 Escape 키를 사용한다
- **THEN** 시스템은 Star 안내를 닫는다
- **AND** 사용자는 현재 빌더 흐름을 계속 사용할 수 있다

### Requirement: 접근 가능한 단순 모달
Star 안내는 현재 앱의 시각 언어를 따르는 반응형 일반 모달이어야 하며(SHALL), 장식적 doodle 표현 없이 보조 기술과 키보드로 사용할 수 있어야 한다(SHALL).

#### Scenario: 모달 포커스와 이름
- **WHEN** Star 안내가 열린다
- **THEN** 보조 기술은 이를 이름이 연결된 modal dialog로 인식한다
- **AND** 키보드 포커스는 모달 내부의 주요 동작으로 이동한다

#### Scenario: 모달을 닫은 뒤
- **WHEN** 사용자가 생성 완료 직후 열린 Star 안내를 닫는다
- **THEN** 키보드 포커스는 새로 준비된 ZIP 다운로드 링크로 이동한다

### Requirement: 지원 언어 안내
Star 안내의 제목, 설명, 주요 동작 및 닫기 문구는 앱이 지원하는 모든 언어로 제공되어야 한다(SHALL).

#### Scenario: 언어 변경
- **WHEN** 사용자가 앱 언어를 변경한 뒤 Star 안내를 연다
- **THEN** 시스템은 선택된 언어의 안내 문구를 표시한다
