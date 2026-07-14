# Provider 저장소 경계 명세

## Purpose

권리를 보유하지 않은 provider의 응답과 모델 payload를 application source, package와 CI에서 분리한다. 공개 repository에는 integration contract, 검증 가능한 provenance와 원격 연결 정보만 남기고 실제 provider 자료가 필요한 운영·스모크 workflow는 개발자 local 환경에서만 수행한다.

## Requirements

### Requirement: Provider 권리물 비포함
공개 저장소의 추적 파일과 production·CLI package는 provider API의 캡처 응답 body, character·model asset pack, skeleton, atlas, texture, archive, 생성 package 또는 private fixture를 포함해서는 안 된다(MUST NOT). Provider repository·commit·URL·web viewer 연결, schema contract, 허용 origin, byte 수·digest·license 같은 provenance metadata와 실제 응답을 복제하지 않은 최소 synthetic fixture는 포함할 수 있다(MAY).

#### Scenario: 허용되는 provider 연결 정보
- **WHEN** integration이 provider repository의 immutable commit, delivery URL 또는 web viewer를 참조한다
- **THEN** 저장소는 해당 연결 정보와 검증 metadata를 추적할 수 있다
- **AND** 참조 대상의 API response body나 model byte를 source 또는 package에 복사해서는 안 된다

#### Scenario: Provider payload 유입
- **WHEN** 추적 파일 또는 package 후보에 provider의 `.skel`, atlas, PNG, ZIP, asset bundle, 캡처 catalog나 API response snapshot이 존재한다
- **THEN** repository 또는 artifact 검증은 해당 경로를 보고하고 실패해야 한다

#### Scenario: Synthetic CI fixture
- **WHEN** CI가 provider adapter와 request lifecycle을 검증한다
- **THEN** test는 권리 제한 자료를 복제하지 않은 최소 synthetic schema와 intercepted response를 사용할 수 있다
- **AND** live provider 또는 developer filesystem을 요구해서는 안 된다

### Requirement: Provider 운영 도구의 local 격리
Provider 자료를 fetch, capture, backup, decrypt, convert, install 또는 실제 byte로 inspect하는 도구와 provider 실제 자료에 의존하는 smoke test는 ignored local 파일이어야 하고(MUST), Git 추적, root package script, production package와 CI workflow에 포함되어서는 안 된다(MUST NOT). Local E2E는 `*.local.spec.ts`, local script는 `*.local.mjs` 또는 `*.local.py` 경계를 사용해야 한다(MUST).

#### Scenario: Karth와 게임 provider 운영 도구
- **WHEN** 개발자가 Karth 응답을 백업하거나 PRSK, STRR, Garupa 자료를 준비·검증한다
- **THEN** 관련 script와 output은 ignored local 경계 또는 repository 밖에 있어야 한다
- **AND** fresh clone의 package script와 CI는 해당 파일이 없어도 성공해야 한다

#### Scenario: 실제 provider smoke
- **WHEN** smoke test가 provider model, private fixture 또는 local asset directory를 읽어야 한다
- **THEN** test는 `*.local.spec.ts`로만 존재하고 명시적 local Playwright config로 실행되어야 한다
- **AND** 기본 `pnpm test:e2e` 대상에서는 제외되어야 한다

### Requirement: 전역 repository boundary harness
프로젝트는 provider가 추가될 때 별도 allowlist 없이 추적 경로, package script, CI workflow와 E2E source를 검사하는 repository boundary harness를 제공해야 한다(SHALL). Production build는 이 harness를 필수 gate로 실행해야 하고(MUST), 새 provider도 동일한 local naming과 payload 비포함 정책을 따라야 한다(MUST).

#### Scenario: 새 provider 추가
- **WHEN** 새 provider integration이 등록되고 build를 실행한다
- **THEN** harness는 provider 이름과 관계없이 local development 경로, 실제 asset·response 파일과 provider-dependent tracked smoke를 검사해야 한다
- **AND** 위반이 없을 때에만 나머지 build를 계속해야 한다

#### Scenario: CI에서 local smoke 호출
- **WHEN** workflow가 local Playwright config, `*.local.spec.ts` 또는 ignored local script를 호출하도록 변경된다
- **THEN** repository boundary harness는 workflow 경로와 위반 이유를 보고하고 실패해야 한다
