## Context

PRSK `sekai_atlas.png`는 premultiplied-alpha(PMA)로 저장되어 있다. 실제 `sd_21miku_miko`의 반투명 pixel 11,008개 중 허용 오차 2를 적용한 11,006개가 `max(R,G,B) <= A`를 만족하며, 기준 `prsk-chibi-viewer`도 `premultipliedAlpha: true`인 기본 WebGL context와 `SkeletonRenderer.premultipliedAlpha = true`를 사용한다.

현재 preview와 export sampler는 WebGL context 및 renderer 양쪽에서 PMA를 `false`로 강제한다. 이미 PMA인 texture를 `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`로 합성하면 attachment의 anti-aliased edge에 alpha가 다시 곱해져, 겹치는 앞머리 조각 경계가 어두운 선으로 나타난다. preview는 WebGL canvas를 page compositor에 직접 전달하지만 sampler는 `readPixels` 결과를 `ImageData`로 옮기므로 두 경로의 출력 경계가 다르다.

## Goals / Non-Goals

**Goals:**

- PRSK PMA atlas를 기준 viewer와 같은 blend semantics로 실시간 preview에 렌더링한다.
- 같은 PMA semantics를 deterministic frame sampler와 최종 Codex Pet PNG에 보존한다.
- 모바일의 높은 device pixel ratio에서도 Miku 앞머리 attachment seam이 나타나지 않음을 실제 자산으로 검증한다.
- depth-order, framing, look, mirror, animation mapping과 package schema를 유지한다.

**Non-Goals:**

- texture pixel을 다시 패킹하거나 원본 atlas PNG를 수정하지 않는다.
- attachment geometry, draw order 또는 z 값을 보정하지 않는다.
- straight-alpha로 제작된 임의의 비-PRSK atlas를 자동 감지하거나 혼합 지원하지 않는다.
- vendoring된 Spine runtime byte를 수정하지 않는다.

## Decisions

### PRSK texture는 이미 PMA인 source 계약으로 취급한다

preview와 sampler는 WebGL context를 `premultipliedAlpha: true`로 만들고 매 draw에서 `SkeletonRenderer.premultipliedAlpha = true`를 사용한다. 이 조합은 renderer가 normal blend의 source factor로 `ONE`을 선택하고 page compositor도 drawing buffer를 PMA로 해석하게 한다.

pixel별 PMA 자동 감지는 투명 edge가 적은 atlas에서 오판할 수 있고 source마다 renderer mode가 바뀌어 결정성을 낮추므로 사용하지 않는다. PRSK integration이 공급하는 atlas에만 적용되는 고정 계약으로 둔다.

### texture upload에서는 추가 premultiply를 하지 않는다

`UNPACK_PREMULTIPLY_ALPHA_WEBGL`은 계속 `0`으로 유지한다. source PNG의 채널 자체가 이미 PMA이므로 upload 시 다시 곱하면 현재와 동일한 이중 alpha 문제가 texture 단계로 이동한다.

### WebGL readback은 2D canvas 기록 전에 straight RGBA로 변환한다

PMA framebuffer의 `readPixels` 결과는 color가 alpha보다 작거나 같은 PMA byte다. `ImageData`는 straight RGBA 입력으로 취급되므로 sampler는 alpha가 0이면 RGB를 0으로 만들고, 그 외에는 각 channel을 `round(channel * 255 / alpha)`로 복원해 0–255로 clamp한다. alpha와 pixel 위치는 유지한다.

WebGL canvas를 `drawImage`로 직접 복사하는 대안은 브라우저가 context attribute에 따라 변환하도록 위임하지만, 현재 sampler의 top-down readback·alpha bounds·mirror 조립 흐름을 크게 바꾸고 구현별 전송 경계를 테스트하기 어렵다. 명시적 byte 변환이 더 작고 결정적이다.

### 회귀 검증은 설정 계약과 실제 Miku mobile render를 함께 본다

unit test는 preview/sampler context attribute, texture unpack flag, renderer PMA와 readback 변환을 고정한다. Playwright는 `sd_21miku_miko`를 mobile viewport와 device scale factor로 렌더링하고 실제 canvas screenshot 및 PMA context를 검사한다. export E2E는 생성·설치된 Miku sprite에서 동일 경계가 다시 생기지 않는지를 확인한다.

## Risks / Trade-offs

- [Risk] 작은 alpha를 unpremultiply할 때 8-bit 양자화가 확대된다. → 정수 clamp와 alpha 0 special case를 사용하고, 최종 2D canvas가 다시 PMA로 변환하는 round trip을 pixel test로 고정한다.
- [Risk] 기존 alpha-squared 출력보다 silhouette의 극저 alpha pixel이 넓어져 framing bounds가 미세하게 달라질 수 있다. → 기존 안전 inset·점유율 검증을 그대로 실행하고 실제 Airi/Miku package bbox 회귀를 다시 통과시킨다.
- [Risk] straight-alpha atlas를 같은 generic adapter에 넣으면 밝은 fringe가 생길 수 있다. → 현재 제품 계약은 PRSK PMA atlas로 한정하고 추후 다른 게임 source는 adapter option으로 명시적으로 blend mode를 전달한다.

## Migration Plan

1. preview와 sampler의 context 및 renderer PMA flag를 함께 전환한다.
2. sampler readback에 straight RGBA 변환을 추가한다.
3. 실제 Miku mobile preview, Miku/Airi export·설치와 전체 회귀 검증을 실행한다.
4. 문제가 발생하면 세 flag와 readback 변환을 한 묶음으로 되돌린다. 일부만 롤백하지 않는다.

## Open Questions

없음.
