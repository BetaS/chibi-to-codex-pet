## MODIFIED Requirements

### Requirement: 허용된 browser persistence 경계
Production browser code의 same-origin writable persistence key는 `chibi-to-codex-pet.locale.v1`, `chibi-to-codex-pet.pet-presets.prsk.v2`, `chibi-to-codex-pet.pet-presets.strr.v2`, `chibi-to-codex-pet.pet-presets.garupa.v2`로 제한되어야 한다(MUST). 이전 runtime별 `chibi-to-codex-pet.pet-presets.<runtime>.v1`과 공용 `chibi-to-codex-pet.pet-presets.v1`은 current runtime key가 없을 때 version 2 migration을 위한 read-only 입력으로만 허용해야 한다(MUST). Locale persistence와 Pet preset repository가 각각의 `localStorage` access를 소유해야 하며(MUST), preset field는 current `pet-settings-presets`의 version, metadata, framing, look scale, strict source 식별자와 animation·mirror mapping allowlist를 따라야 한다(MUST). Production source와 bundle은 `sessionStorage`와 `indexedDB`를 사용해서는 안 되며(MUST NOT), source binary와 생성 결과는 session memory에서 관리해야 한다(MUST).

#### Scenario: production storage allowlist
- **WHEN** production source와 bundle을 persistence verifier로 검사한다
- **THEN** `localStorage` 호출은 locale storage와 Pet preset repository의 명시적 module에만 존재해야 한다
- **AND** current writable preset key 세 개와 migration read-only v1 key 네 개가 명시적으로 검증되어야 한다

#### Scenario: preset 외 source 정보 제외
- **WHEN** local file 또는 remote provider source로 preview와 build를 완료한다
- **THEN** browser persistence에는 source binary, local 파일 내용·이름·경로와 package·spritesheet·download 결과가 없어야 한다
- **AND** 원격 source 재현에 필요한 값은 current preset schema가 허용한 provider 식별자와 custom normalized asset base URL로 제한되어야 한다
