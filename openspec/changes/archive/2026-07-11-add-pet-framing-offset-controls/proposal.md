## Why

현재 Pet 크기는 자동 framing의 80%–100%만 지원하고 preview에 실제 Codex cell 경계가 표시되지 않아, 사용자가 캐릭터의 확대·위치를 의도대로 조정하거나 crop 결과를 생성 전에 판단하기 어렵다. LiveSD와 검증된 Codex Pet preview가 같은 framing 계약을 보여주고 X/Y 위치와 최대 150% 확대를 제어할 수 있어야 한다.

## What Changes

- LiveSD WebGL preview와 Codex Pet installed preview에 `192×208` 출력 cell의 border box를 표시한다.
- Pet 크기 범위를 `80%–150%`로 확장하고 최종 cell pixel 단위의 X/Y offset control을 추가한다.
- `+X`는 오른쪽, `+Y`는 아래쪽으로 정의하고 scale·offset을 LiveSD projection, export sampler와 remote recipe에 동일하게 적용한다.
- scale 또는 offset 변경 시 진행 중 export와 이전 download·validation·installed preview를 무효화하되 metadata와 animation mapping은 유지한다.
- 100% 초과 또는 offset으로 의도한 edge crop은 허용하지만 빈 사용 cell, 잘못된 geometry와 미사용 cell 오염 검증은 유지한다.
- 네 locale에 border box와 X/Y control의 visible label, 단위, 도움말과 접근성 문구를 추가한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `livesd-36-preview`: `192×208` border box, `80%–150%` scale과 X/Y offset의 실시간 projection 계약을 추가한다.
- `livesd-frame-sampling`: scale·offset snapshot을 canonical projection에 적용하고 의도한 cell edge crop을 처리하도록 확장한다.
- `codex-pet-package-export`: framing 변경 무효화, border box installed preview와 custom framing validation 정책을 추가한다.
- `npx-pet-installation`: schema version 1 recipe에 optional framing X/Y offset을 추가해 headless renderer가 웹과 같은 raster를 만들게 한다.
- `web-ui-localization`: framing border·scale·X/Y control 문구를 네 locale catalog에 포함한다.

## Impact

- LiveSD preview session API, projection 계산, frame sampling input과 recipe parser가 변경된다.
- PRSK preview toolbar, Codex Pet builder와 installed preview UI/CSS가 변경된다.
- package validator는 custom framing의 의도적 edge crop과 손상된 cell을 구분하는 option을 받는다.
- 단위·컴포넌트·Playwright 검증이 150%와 X/Y 이동의 preview/export 일관성을 확인한다.
