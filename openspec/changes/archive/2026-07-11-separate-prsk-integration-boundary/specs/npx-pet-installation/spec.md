## MODIFIED Requirements

### Requirement: strict Codex Pet recipe schema
Recipe는 `schemaVersion: 1`, `kind: "livesd-recipe"`, `renderer: "livesd36-codex-pet@1"`, remote `source`, `pet` metadata/framing scale, PRSK 전체 수평 반전 설정, 그리고 모든 표준 Codex Pet 상태의 animation mapping과 상태별 `mirrorX`를 포함해야 한다(MUST). Recipe는 PNG, ZIP, base64 spritesheet 또는 local file path를 포함해서는 안 된다(MUST NOT). Parser는 기존 schema version 1 recipe에 전체 반전 값이 없으면 `false`로 해석해야 하며(MUST), 새로 생성하는 recipe에는 canonical boolean 값을 명시해야 한다(MUST).

#### Scenario: 유효한 prsk-chibi-viewer recipe
- **WHEN** recipe source가 `provider: "prsk-chibi-viewer"`, safe `characterId`와 전체 수평 반전 값을 가진다
- **THEN** CLI는 canonical prsk-chibi-viewer catalog와 pjsek.ai area_sd asset base를 사용해 모델 리소스를 찾아야 한다
- **AND** headless renderer는 recipe의 전체 반전과 좌·우 상태별 반전을 웹 exporter와 동일하게 적용해야 한다

#### Scenario: 유효한 custom provider recipe
- **WHEN** recipe source가 `provider: "custom"`, canonical HTTPS `assetBaseUrl`, safe `characterId`와 전체 수평 반전 값을 가진다
- **THEN** CLI는 해당 asset base의 `catalog.json`과 모델 리소스만 요청 대상으로 사용해야 한다

#### Scenario: 기존 recipe의 방향 기본값
- **WHEN** 유효한 기존 schema version 1 recipe에 전체 수평 반전 key가 없다
- **THEN** parser는 전체 반전을 `false`로 정규화해야 한다
- **AND** 기존 상태별 `mirrorX` 의미를 변경해서는 안 된다

#### Scenario: binary inline recipe 거부
- **WHEN** recipe에 `spritesheet`, `spritesheetBase64`, `zip`, `zipBase64`, local path 또는 unknown top-level key가 있다
- **THEN** CLI는 `RECIPE_INVALID`와 exit `2`를 반환해야 한다
