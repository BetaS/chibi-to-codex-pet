## ADDED Requirements

### Requirement: 허용된 browser persistence 경계
production browser code는 사용자 locale과 versioned Pet 설정 preset만 same-origin `localStorage`에 저장할 수 있다(MUST). locale persistence와 Pet preset repository 외의 module은 `localStorage` API를 직접 호출해서는 안 된다(MUST NOT). Pet source byte·파일, ZIP, atlas/PNG, source/provider URL, character ID, download URL, package와 validation 결과는 browser persistence에 기록해서는 안 된다(MUST NOT).

#### Scenario: production storage allowlist
- **WHEN** production source와 bundle을 persistence verifier로 검사한다
- **THEN** `localStorage` 호출은 locale storage와 Pet preset repository의 명시적 module에만 존재해야 한다

#### Scenario: 민감 source 정보 제외
- **WHEN** local file 또는 remote provider source로 preview와 build를 완료한다
- **THEN** browser persistence에는 source binary, 파일·URL·provider·character 식별자와 생성 결과가 없어야 한다
