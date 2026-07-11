## Why

PRSK texture atlas는 색상 채널에 alpha가 이미 곱해진 premultiplied-alpha(PMA) PNG인데, 현재 preview와 frame sampler는 straight-alpha 렌더링을 강제해 반투명 attachment 경계의 색상과 alpha를 다시 곱하고 있다. 그 결과 Miku 앞머리 조각의 연결선처럼 atlas 경계가 어둡게 드러나며, 높은 device pixel ratio의 모바일 화면에서 특히 선명하게 보인다.

## What Changes

- PRSK LiveSD preview의 WebGL drawing buffer와 Spine renderer를 PMA 합성으로 일치시킨다.
- 이미 PMA인 atlas byte를 texture upload 단계에서 다시 premultiply하지 않는다.
- frame sampler는 PMA로 렌더링한 WebGL readback을 straight RGBA로 한 번 변환한 뒤 2D canvas와 최종 PNG atlas에 기록한다.
- `sd_21miku_miko`를 모바일 viewport와 높은 device pixel ratio로 렌더링해 앞머리 attachment seam이 나타나지 않는 회귀 검증을 추가한다.
- context attribute, renderer blend mode와 readback 변환을 unit/component test로 고정한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `livesd-36-preview`: PMA atlas를 PMA WebGL pipeline으로 렌더링해 attachment 경계의 이중 alpha 곱과 seam을 방지하는 요구사항을 추가한다.
- `livesd-frame-sampling`: PMA frame을 올바르게 합성하고 readback을 straight RGBA로 변환해 export PNG의 색상·alpha 경계를 보존하는 요구사항을 추가한다.

## Impact

- `LiveSD36Adapter`의 WebGL context attribute와 texture upload 설정
- `WebGLLiveSDPreviewSession` 및 `LiveSD36FrameSampler`의 `SkeletonRenderer` blend mode
- sampler의 WebGL RGBA readback과 2D atlas 조립 경계
- adapter/sampler 단위 테스트와 실제 Miku 모바일 Playwright 시각 회귀
- 외부 dependency, public API, recipe 또는 Pet manifest schema 변경 없음
