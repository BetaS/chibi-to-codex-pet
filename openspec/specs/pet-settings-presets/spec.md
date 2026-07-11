# Pet 설정 preset 명세

## Purpose

사용자는 성공적으로 생성한 Pet 설정을 이름별 preset으로 저장하고 다음 browser session에서 다시 선택할 수 있다. Preset은 렌더링 설정만 보관하며 source가 ready일 때 유효한 animation mapping을 적용한다.

## Requirements

### Requirement: versioned Pet 설정 preset 저장소
웹 앱은 same-origin `localStorage`의 전용 versioned document에 Pet 설정 preset을 저장해야 한다(MUST). Preset key는 trim된 Pet 표시 이름이어야 하며(MUST), 저장 field는 Pet 이름·설명, framing scale·X/Y offset, 눈 이동량, 전체 수평 반전, 9개 상태의 animation 이름·상태별 반전과 갱신 시각으로 제한해야 한다(MUST). Source와 package byte·위치·식별자는 session memory에서만 다뤄야 한다(MUST). 저장소는 최대 20개 preset으로 제한해야 한다(MUST).

#### Scenario: 허용된 설정만 저장
- **WHEN** source URL과 local model file을 사용한 Pet build가 성공한다
- **THEN** 저장 document에는 현재 설정과 갱신 시각만 기록되어야 한다
- **AND** source URL, file 내용·이름, character ID, package blob 또는 download URL이 포함되어서는 안 된다

#### Scenario: 같은 이름 덮어쓰기
- **WHEN** 이미 preset이 있는 trim된 Pet 이름으로 다른 유효 설정의 build가 성공한다
- **THEN** 시스템은 같은 key의 preset을 최신 설정으로 교체해야 한다
- **AND** selector에 같은 이름을 중복 추가해서는 안 된다

#### Scenario: bounded catalog
- **WHEN** 20개 preset이 있는 저장소에 새 이름의 성공 build를 저장한다
- **THEN** 시스템은 가장 오래 갱신된 preset을 제거하고 새 preset을 저장해야 한다
- **AND** document는 20개를 초과해서는 안 된다

### Requirement: 검증된 build 완료 시 preset 활성화
시스템은 Codex Pet package build와 validation이 성공한 뒤에만 현재 설정을 preset으로 저장해야 한다(MUST). 저장한 preset은 즉시 active preset이 되어야 하며(MUST), 실패·취소되거나 validation을 통과하지 못한 build는 저장소와 active preset을 변경해서는 안 된다(MUST NOT).

#### Scenario: 성공 build 저장
- **WHEN** 사용자가 유효한 표시 이름으로 Pet을 build하고 package validation이 성공한다
- **THEN** 시스템은 그 이름으로 현재 설정 preset을 저장해야 한다
- **AND** 해당 preset을 selector의 현재 선택으로 표시해야 한다

#### Scenario: 실패 build 무변경
- **WHEN** package 생성 또는 validation이 실패하거나 사용자가 진행 중 build를 취소한다
- **THEN** 기존 preset catalog와 active preset은 변경되지 않아야 한다

### Requirement: 다음 방문과 source-ready 복원
시스템은 마지막으로 저장하거나 사용자가 선택한 preset 이름을 다음 mount의 기본 선택으로 복원해야 한다(MUST). mount에서 preset을 읽는 행위는 provider request, model import 또는 preview session 생성을 시작해서는 안 된다(MUST NOT). source가 ready가 되면 시스템은 현재 source 추천 mapping을 먼저 계산하고 저장 animation이 실제 목록에 존재하는 상태만 저장 mapping으로 덮어써야 한다(MUST).

#### Scenario: 다음 방문 기본 preset
- **WHEN** 사용자가 `My Pet` preset을 저장한 뒤 page를 다시 열고 source를 수동으로 불러온다
- **THEN** selector는 최초부터 `My Pet`을 선택해야 한다
- **AND** source가 ready가 된 뒤 저장된 metadata, framing, 눈 이동량, 반전과 유효 mapping이 적용되어야 한다

#### Scenario: Preset만 복원한 초기 상태
- **WHEN** active preset이 저장된 상태로 page에 진입한다
- **THEN** preset 복원만으로 network request, file access, model import 또는 preview session 생성이 발생해서는 안 된다

#### Scenario: 없는 animation의 상태별 fallback
- **WHEN** active preset의 한 상태 animation은 새 source에 없고 다른 상태 animation은 존재한다
- **THEN** 없는 상태는 새 source의 추천 animation과 추천 상태별 반전을 유지해야 한다
- **AND** 존재하는 상태만 저장 animation과 저장 상태별 반전을 적용해야 한다

### Requirement: preset 전환과 새 세션
웹 UI는 저장된 preset을 선택하는 dropdown과 `새 세션` option을 제공해야 한다(MUST). preset을 선택하면 이를 active preset으로 저장하고 현재 ready source에 즉시 적용해야 한다(MUST). `새 세션`은 저장 catalog를 삭제하지 않고 active 선택을 비우며 현재 source의 추천 mapping과 기본 설정으로 reset해야 한다(MUST).

#### Scenario: 다른 preset 선택
- **WHEN** ready source에서 사용자가 preset dropdown의 다른 이름을 선택한다
- **THEN** 현재 builder와 LiveSD/Codex Pet preview는 해당 preset의 유효 설정으로 갱신되어야 한다
- **AND** 다음 방문의 기본 preset도 그 이름이어야 한다

#### Scenario: 새 세션 선택
- **WHEN** 사용자가 preset dropdown에서 `새 세션`을 선택한다
- **THEN** metadata는 비워지고 framing·눈 이동량·반전·mapping은 현재 source 기본값으로 돌아가야 한다
- **AND** 기존 저장 preset은 dropdown에 계속 남아야 한다
- **AND** 다음 방문의 기본 선택은 `새 세션`이어야 한다

### Requirement: 저장소 오류 복구
지원하지 않는 version, 손상된 값 또는 schema 범위를 벗어난 preset은 적용되어서는 안 된다(MUST NOT). storage read·write·remove가 예외를 발생시켜도 앱 mount, 현재 preview와 build session은 계속 동작해야 한다(MUST).

#### Scenario: 손상된 document
- **WHEN** preset storage가 JSON이 아니거나 지원하지 않는 version을 가진다
- **THEN** 시스템은 이를 빈 catalog로 취급하고 가능한 경우 손상 key를 제거해야 한다
- **AND** 앱은 기본 새 세션으로 계속 동작해야 한다

#### Scenario: storage 쓰기 차단
- **WHEN** 성공 build 뒤 `localStorage.setItem`이 보안 또는 quota 오류를 발생시킨다
- **THEN** 생성된 package와 현재 builder 설정은 유지되어야 한다
- **AND** 오류가 preview 또는 download 결과를 무효화해서는 안 된다
