## ADDED Requirements

### Requirement: Garupa Spine 4.0 preview 구성

시스템은 검증된 Garupa source의 Spine 4.0 skeleton, costume atlas와 모든 PNG page를 `spine-4.0` adapter로 파싱하고 투명 WebGL canvas에 현재 `skeleton.drawOrder`로 렌더링해야 한다(MUST). Session은 parser가 반환한 animation 이름과 순서를 그대로 제공해야 하고(MUST), `Idle`이 있으면 기본 반복 animation으로, 없으면 첫 animation을 사용해야 한다(MUST). Skeleton·atlas parse와 첫 frame draw가 모두 성공하기 전에는 source를 ready 또는 exporter 입력으로 노출해서는 안 된다(MUST NOT).

#### Scenario: 대표 4.0 source preview
- **WHEN** 유효한 4.0 skeleton과 모든 region을 충족하는 costume atlas/PNG가 주어진다
- **THEN** session은 첫 visible frame을 그린 뒤 ready가 되고 skeleton에서 읽은 전체 animation 목록을 제공한다

#### Scenario: Idle 기본 선택
- **WHEN** 파싱된 animation 목록 중 정확한 이름 `Idle`이 존재한다
- **THEN** preview는 `Idle`을 기본값으로 반복 재생하되 사용자가 다른 실제 animation을 선택할 수 있게 한다

#### Scenario: Idle이 없는 source
- **WHEN** animation 목록에 `Idle`이 없고 하나 이상의 다른 animation이 있다
- **THEN** preview는 파싱된 첫 animation을 기본값으로 사용한다

#### Scenario: 첫 frame 실패
- **WHEN** skeleton과 atlas parse는 성공하지만 texture upload 또는 첫 WebGL draw가 실패한다
- **THEN** session은 `GARUPA_PREVIEW_RENDER_FAILED`로 실패하고 부분 자원을 정리하며 source를 ready로 만들지 않는다

### Requirement: Straight-alpha preview 합성

Garupa renderer는 source의 straight-alpha texture channel을 보존하고 texture upload에서 추가 premultiply를 적용해서는 안 된다(MUST NOT). Spine renderer의 `premultipliedAlpha`는 `false`여야 하고(MUST), normal attachment는 `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` 의미의 blend로 합성해야 한다(MUST). Preview는 depth test/write, cull, scissor, stencil과 polygon offset을 draw 전에 비활성화하고 현재 draw order만으로 2D layer를 결정해야 한다(MUST).

#### Scenario: Straight-alpha edge preview
- **WHEN** RGB channel이 alpha보다 큰 반투명 edge pixel을 가진 Garupa texture를 렌더링한다
- **THEN** texture upload는 RGB 값을 변경하지 않고 renderer는 straight-alpha blend를 사용해 dark fringe나 이중 alpha를 만들지 않는다

#### Scenario: PMA 상태 격리
- **WHEN** 이전 Spine 3.6 session이 PMA mode를 사용한 뒤 Garupa preview를 만든다
- **THEN** Garupa renderer는 PMA texture·blend·WebGL state를 재사용하지 않고 `premultipliedAlpha: false` 계약으로 첫 frame을 그린다

#### Scenario: Draw order 보존
- **WHEN** 둘 이상의 Garupa attachment가 겹치거나 animation draw-order timeline이 순서를 바꾼다
- **THEN** renderer는 z-offset이나 depth 판정 없이 현재 `skeleton.drawOrder` 순서로 합성한다

### Requirement: Runtime 독립 canonical framing

Garupa preview와 sampler는 기존 Codex Pet 출력과 같은 `192×208` cell, 57개 표준 pose의 coarse bounds·alpha calibration·1px guard, 8px final inset, framing scale·offset과 canonical projection 계약을 사용해야 한다(MUST). Version별 bounds와 animation apply API 차이는 Spine 4.0 adapter 내부에서 처리해야 하며(MUST), 같은 source·mapping·framing 입력은 preview와 export에서 raster 반올림 오차 안의 같은 위치·크기·crop을 만들어야 한다(MUST).

#### Scenario: Preview와 export projection 일치
- **WHEN** 같은 Garupa source, 57개 pose mapping, scale, offset과 mirror를 preview와 sampler에 적용한다
- **THEN** 두 경로는 같은 canonical visible bounds와 final projection을 사용해 동일 pose의 pixel 위치와 크기가 일치한다

#### Scenario: 투명 placeholder 제외
- **WHEN** skeleton에 geometry는 있지만 선택된 costume texture에서 완전 투명한 attachment가 있다
- **THEN** alpha calibration은 해당 geometry를 final visible bounds에서 제외한다

### Requirement: Garupa dual-eye look rig 검증

`garupa-dual-eye-v1` profile은 parent transform을 가진 `F_eyeL`과 `F_eyeR` bone을 모두 찾아야 하고(MUST), 각 bone 또는 descendant의 현재 visible slot에서 실제 크기가 1×1px보다 크고 `eye`를 포함하되 `eyebrow`를 포함하지 않는 attachment를 하나 이상 확인해야 한다(MUST). 일반 animation preview는 look rig 검증과 독립적으로 ready가 될 수 있지만(MUST), 조건을 만족하지 못하면 v2 package export는 빈 look frame을 생성하지 않고 `GARUPA_LOOK_RIG_UNSUPPORTED`로 차단해야 한다(MUST).

#### Scenario: 유효한 paired-eye rig
- **WHEN** skeleton에 `F_eyeL`, `F_eyeR`, 유효한 두 parent transform과 양쪽의 visible eye attachment가 존재한다
- **THEN** 시스템은 두 bone을 하나의 `garupa-dual-eye-v1` look rig로 확정한다

#### Scenario: 한쪽 eye bone 누락
- **WHEN** `F_eyeL` 또는 `F_eyeR` 중 하나가 없거나 parent transform이 유효하지 않다
- **THEN** animation preview는 계속 사용할 수 있지만 v2 export는 `GARUPA_LOOK_RIG_UNSUPPORTED`로 거부된다

#### Scenario: 눈썹과 placeholder 제외
- **WHEN** eye bone 아래에 eyebrow, alpha 0 또는 1×1 이하 placeholder attachment가 있다
- **THEN** 시스템은 이를 paired-eye 검증 수에 포함하지 않는다

### Requirement: Paired-eye 시선 변환

Preview와 look sampler는 같은 setup pose와 idle `time=0`에 animation을 적용한 뒤 요청된 screen-space gaze delta를 두 eye bone 각각의 parent 2×2 world matrix 역변환으로 local delta에 바꿔 적용해야 한다(MUST). 두 bone은 같은 screen-space 방향과 이동 배율을 사용해야 하고(MUST), 이전 frame의 offset을 누적해서는 안 된다(MUST NOT). Parent determinant 절댓값이 `1e-8`보다 작으면 해당 pose를 `GARUPA_LOOK_RIG_UNSUPPORTED`로 거부해야 한다(MUST).

#### Scenario: 오른쪽 시선
- **WHEN** 무반전 preview에서 pointer target 또는 export direction이 오른쪽이다
- **THEN** `F_eyeL`과 `F_eyeR`의 최종 visible pixel은 모두 화면 오른쪽으로 이동하고 각 local delta는 자신의 parent matrix로 독립 계산된다

#### Scenario: 서로 다른 parent transform
- **WHEN** 좌우 eye bone의 parent rotation 또는 scale이 서로 다르다
- **THEN** 시스템은 하나의 local delta를 복사하지 않고 같은 world delta를 두 parent 역행렬로 각각 변환한다

#### Scenario: frame 간 비누적
- **WHEN** 같은 gaze target으로 연속 animation frame을 렌더링한다
- **THEN** 각 frame은 animation pose를 다시 적용한 뒤 한 번의 eye offset만 합성해 시간 경과에 따라 이동량이 증가하지 않는다

### Requirement: Garupa 73-frame sampling

Garupa sampler는 유효한 9개 상태 mapping에서 57개 표준 frame과 `garupa-dual-eye-v1`의 16개 look frame을 8열×11행 atlas의 기존 cell 위치에 렌더링해야 한다(MUST). Sample time, 미사용 cell 투명도, canonical projection, 전체·상태별 mirror 합성, progress와 cancellation은 runtime version과 관계없이 기존 Codex Pet v2 계약과 같아야 한다(MUST). 별도 left/right skeleton이 없는 Garupa source는 final raster mirror로 방향을 만들어야 하고(MUST), global mirror 후에도 look index `0`, `4`, `8`, `12`는 화면의 위, 오른쪽, 아래, 왼쪽 의미를 유지해야 한다(MUST).

#### Scenario: 전체 frame 조립
- **WHEN** 유효한 mapping과 look rig으로 Garupa export를 실행한다
- **THEN** rows 0–8에 57개 표준 frame, rows 9–10에 16개 look frame이 생성되고 나머지 cell은 완전 투명하다

#### Scenario: 결정적인 반복 export
- **WHEN** 같은 source byte, mapping, framing, mirror와 look movement로 export를 두 번 실행한다
- **THEN** 두 결과는 같은 sample time, projection, cell-local alpha bounds와 PNG byte를 생성한다

#### Scenario: global mirror 방향 의미
- **WHEN** global mirror를 활성화해 16개 look frame을 생성한다
- **THEN** 좌우 gaze vector와 final cell mirror를 보정해 `0`, `4`, `8`, `12`가 위, 오른쪽, 아래, 왼쪽을 계속 의미한다

### Requirement: Straight-alpha source의 PNG readback

Garupa sampler는 straight-alpha texture를 `premultipliedAlpha: false` renderer와 transparent framebuffer에 합성해야 한다(MUST). Blend된 framebuffer의 `readPixels` 결과는 PNG 또는 2D atlas canvas에 기록하기 전에 straight RGBA로 정확히 한 번 정규화해야 하며(MUST), alpha 0 pixel의 RGB는 0이어야 한다(MUST). Source texture upload와 framebuffer readback 정규화를 같은 단계로 취급해 alpha를 두 번 곱하거나 두 번 나눠서는 안 된다(MUST NOT).

#### Scenario: 반투명 readback 정규화
- **WHEN** transparent framebuffer의 합성 pixel이 premultiplied color channel과 `0 < A < 255`를 가진다
- **THEN** sampler는 alpha를 유지하고 color channel을 한 번만 unpremultiply해 straight RGBA로 기록한다

#### Scenario: 완전 투명 pixel
- **WHEN** readback pixel의 alpha가 0이다
- **THEN** sampler는 출력 RGB를 모두 0으로 기록한다

#### Scenario: 반투명 attachment 경계
- **WHEN** 서로 겹치는 Garupa attachment의 반투명 edge를 preview와 PNG로 렌더링한다
- **THEN** 두 결과에 dark fringe, 밝은 halo 또는 이중 alpha 흔적이 없고 alpha bounds가 일치한다

### Requirement: Garupa rendering 자원 수명과 오류

Preview session과 export sampler는 각자 소유한 Spine 4.0 animation state, texture, image, shader, batcher, atlas, WebGL 참조와 frame callback을 성공, 실패, 취소와 dispose에서 한 번만 정리해야 한다(MUST). 알려진 Garupa rendering 실패는 아래 영문 code를 사용해야 하며(MUST), 알 수 없는 실패는 `GARUPA_RENDERING_FAILED`로 정규화해야 한다(MUST).

```text
GARUPA_ANIMATION_MISSING
GARUPA_ATLAS_RUNTIME_PARSE_FAILED
GARUPA_SKELETON_PARSE_FAILED
GARUPA_PREVIEW_RENDER_FAILED
GARUPA_LOOK_RIG_UNSUPPORTED
GARUPA_FRAME_RENDER_FAILED
GARUPA_FRAME_READBACK_FAILED
GARUPA_RENDERING_FAILED
```

#### Scenario: 사용자 취소
- **WHEN** Garupa sampling 중 전달된 `AbortSignal`이 abort된다
- **THEN** sampler는 후속 frame과 PNG encoding을 중단하고 부분 결과를 노출하지 않으며 모든 소유 자원을 정리한다

#### Scenario: 알려진 rendering 실패
- **WHEN** parse, preview, look rig, frame draw 또는 readback이 실패한다
- **THEN** 시스템은 위 집합의 해당 code와 현재 locale로 변환 가능한 진단을 반환하고 부분 session·atlas를 노출하지 않는다

#### Scenario: 중복 dispose
- **WHEN** 같은 Garupa preview session을 두 번 이상 dispose한다
- **THEN** 첫 호출에서만 소유 자원을 정리하고 후속 호출은 오류나 중복 해제를 만들지 않는다
