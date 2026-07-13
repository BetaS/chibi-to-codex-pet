# GitHub Star 안내 명세

## Purpose

Pet ZIP 다운로드를 시작한 사용자가 작업 흐름을 방해받지 않으면서 프로젝트의 GitHub 저장소를 확인하고 Star로 응원할 수 있는 선택지를 제공한다.

## Requirements

### Requirement: 다운로드 이후 Star 안내
시스템은 현재 빌더 작업 세션에서 검증된 Codex Pet ZIP 다운로드 링크를 사용자가 처음 누른 직후 GitHub 저장소를 안내하는 비차단형 모달을 표시해야 한다(SHALL).

#### Scenario: 첫 다운로드 링크 클릭
- **WHEN** 사용자가 검증된 ZIP의 다운로드 링크를 처음 누른다
- **THEN** ZIP 다운로드 동작과 기존 분석 이벤트가 유지된다
- **AND** 시스템은 GitHub Star 안내 모달을 표시한다

#### Scenario: 반복 다운로드 링크 클릭
- **WHEN** 같은 빌더 작업 세션에서 사용자가 ZIP 다운로드 링크를 다시 누른다
- **THEN** ZIP 다운로드 동작과 기존 분석 이벤트가 유지된다
- **AND** 시스템은 Star 안내 모달을 다시 표시하지 않는다

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
- **WHEN** 사용자가 Star 안내를 닫는다
- **THEN** 키보드 포커스는 안내를 연 다운로드 링크로 돌아간다

### Requirement: 지원 언어 안내
Star 안내의 제목, 설명, 주요 동작 및 닫기 문구는 앱이 지원하는 모든 언어로 제공되어야 한다(SHALL).

#### Scenario: 언어 변경
- **WHEN** 사용자가 앱 언어를 변경한 뒤 Star 안내를 연다
- **THEN** 시스템은 선택된 언어의 안내 문구를 표시한다
