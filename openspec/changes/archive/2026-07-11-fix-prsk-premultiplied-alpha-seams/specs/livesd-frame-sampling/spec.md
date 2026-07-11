## ADDED Requirements

### Requirement: PMA frame sampling과 straight RGBA export 경계

LiveSD frame sampler는 PRSK PMA texture를 PMA WebGL drawing buffer와 PMA Spine renderer로 합성해야 한다(MUST). `readPixels`로 얻은 PMA RGBA는 `ImageData`, 2D atlas canvas 또는 PNG encoder에 전달하기 전에 straight RGBA로 정확히 한 번 변환해야 하며(MUST), alpha가 0인 pixel의 RGB는 0이어야 한다(MUST). 변환은 alpha와 pixel 위치를 바꾸거나 edge color에 alpha를 두 번 곱해서는 안 된다(MUST NOT).

#### Scenario: 반투명 pixel readback 변환
- **WHEN** PMA WebGL readback pixel이 `(R, G, B, A)`이고 `0 < A < 255`이다
- **THEN** sampler는 alpha를 유지하고 각 color channel을 `clamp(round(channel * 255 / A), 0, 255)`로 straight RGBA에 기록한다

#### Scenario: 완전 투명 pixel 변환
- **WHEN** PMA WebGL readback pixel의 alpha가 0이다
- **THEN** sampler는 출력 RGB를 모두 0으로 기록한다
- **AND** 나눗셈 오류나 숨은 color byte를 생성하지 않는다

#### Scenario: Miku Pet atlas 경계 보존
- **WHEN** `sd_21miku_miko`의 표준 및 look frame을 Codex Pet PNG atlas로 생성한다
- **THEN** 생성·검증·설치된 sprite는 앞머리 attachment 연결 경계에 추가 dark seam을 포함하지 않는다
- **AND** 기존 alpha bounds, 안전 여백, 점유율과 draw-order 검증을 통과한다
