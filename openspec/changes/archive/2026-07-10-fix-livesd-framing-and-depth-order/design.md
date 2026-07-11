## Context

현재 preview와 exporter는 vendored Spine 3.6의 `Skeleton.getBounds()`를 그대로 사용한다. 이 함수는 Region/Mesh attachment의 vertex 범위는 합치지만 slot/attachment alpha, texture alpha와 clipping 결과를 고려하지 않는다. 실제 Airi atlas의 269개 region 중 150개가 완전 투명하고 pose마다 활성 attachment의 약 72%가 투명 placeholder다. 예를 들어 atlas에서 완전 투명한 `1×1` region이 skeleton에서는 수백 world unit의 quad/mesh여서 canonical bounds를 넓힌다. 설치된 현행 v2 atlas의 중앙 가시 영역은 Airi가 약 `71×101`, Miku가 약 `76×98`로 `192×208` cell의 절반 안팎이다.

LiveSD는 모든 attachment vertex를 같은 WebGL 평면에 놓고 `skeleton.drawOrder`와 alpha blending으로 겹침을 표현한다. 현재 context는 depth buffer 생성을 막지 않고 draw 직전 depth state를 재설정하지 않으므로, 외부 또는 runtime이 남긴 WebGL state가 painter order에 간섭할 수 있다.

## Goals / Non-Goals

**Goals:**

- 실제 coarse RGBA의 alpha pixel만으로 preview와 export bounds를 보정한다.
- 전체 표준 상태와 look frame에 하나의 안정적인 projection을 적용하면서 cell을 충분히 사용하고 clipping을 방지한다.
- preview와 sampler에서 Spine draw order가 유일한 레이어 순서가 되도록 2D WebGL state를 결정적으로 설정한다.
- 사용자가 WebGL preview의 슬라이더로 한 export 전체의 Pet 크기를 직접 정하고 최종 atlas에 같은 배율을 bake한다.
- Airi와 Miku 실제 v2 ZIP의 점유율, 안전 여백, 설치 및 렌더링을 자동·시각적으로 검증한다.

**Non-Goals:**

- Spine skeleton의 slot 순서, draw-order timeline 또는 vertex z를 수정하지 않는다.
- 상태별·animation별 또는 X/Y 축별 배율과 100%를 넘는 unsafe crop은 도입하지 않는다. 동일 export 전체에 적용되는 단일 균등 `framingScale`만 지원한다.
- texture mask나 Spine attachment polygon을 재작성하지 않는다.

## Decisions

### 1. 실제 coarse render alpha를 world bounds로 역변환한다

먼저 raw `Skeleton.getBounds()` 57-pose 합집합으로 모든 geometry를 포함하는 보수적인 coarse projection을 만든다. 이 projection으로 각 표준 pose를 임시 렌더링하고 top-down RGBA에서 alpha가 0이 아닌 inclusive pixel bbox `L,R,T,B`를 구한다. pixel edge를 다음과 같이 world 좌표로 역변환한다.

```text
minX = P.x + L / 192 * P.width
maxX = P.x + (R + 1) / 192 * P.width
maxY = P.y + (1 - T / 208) * P.height
minY = P.y + (1 - (B + 1) / 208) * P.height
```

inclusive pixel 전체를 보존하는 `+1`과 WebGL Y축 뒤집힘을 명시적으로 반영하고 float 좌표를 반올림하지 않는다. 재샘플링 경계의 antialias clipping을 막기 위해 각 측정 bounds에 coarse pixel 1개에 해당하는 world guard를 더한다. 실제 alpha가 없는 표준 사용 frame은 건너뛰지 않고 `FRAME_BOUNDS_FAILED`로 실패한다.

slot 합성 alpha만 확인하는 geometry helper는 texture 자체가 완전 투명한 placeholder를 제거하지 못한다. texture mask를 CPU에서 attachment별로 재구성하는 방식보다 실제 renderer의 blending, clipping과 texture 결과를 그대로 측정하는 calibration pass가 더 정확하고 단순하므로 선택한다.

preview도 선택 animation의 첫 frame을 raw bounds로 coarse render한 뒤 같은 alpha 역변환으로 framing을 한 번 보정해 다시 그린다. animation 전환 시 새 pose의 coarse bounds로 재보정한다.

### 2. 57개 표준 pose의 실제 alpha 합집합과 고정 8px inset을 사용한다

57개 calibration bounds를 합치고 `176×192` 내부 영역에 맞는 scale `s = min(176/visibleWidth, 192/visibleHeight)`을 계산한다. final projection은 `192/s × 208/s`이고 캐릭터의 실제 `minY`가 cell bottom 8px에 오도록 baseline을 고정한다. 같은 projection을 표준 57개 cell과 look 16개 cell에 재사용한다. mirror 상태는 source world bounds를 임의 반전하지 않고 최종 cell pixel만 반전한다.

기존 10% ratio는 가로·세로 limiting에 따라 실제 pixel 여백이 달라지고 작은 캐릭터를 충분히 키우지 못해 고정 inset으로 바꾼다. 상태별 projection은 개별 row를 더 크게 만들 수 있지만 상태 전환 시 캐릭터 크기가 튀고 look/idle anchor가 달라질 수 있어 사용하지 않는다.

### 3. WebGL context와 매 draw의 2D raster state를 함께 고정한다

preview와 sampler는 `depth: false`, `stencil: false`로 context를 요청한다. 공유 2D state helper는 매 draw 직전에 `DEPTH_TEST`를 끄고 `depthMask(false)`를 설정하며, coplanar 2D painter order나 전체 frame에 간섭할 수 있는 cull, scissor, stencil, polygon offset도 비활성화한다. blending과 texture/batch flush는 Spine `PolygonBatcher`가 담당하고 attachment 순서는 `skeleton.drawOrder`를 그대로 따른다.

context 생성 옵션만 고정하면 context 복구나 다른 코드가 바꾼 state를 막지 못하고, attachment마다 임의 z epsilon을 주면 draw-order timeline과 다중 texture flush 의미가 달라질 수 있으므로 매 draw state 재설정을 선택한다.

### 4. 독립 validator가 가시 alpha bbox 품질을 검사한다

ZIP을 다시 연 validator는 alpha `>= 2/255`인 pixel로 각 사용 cell의 bbox를 계산한다. 모든 사용 cell은 외곽 4px 안전 영역을 침범하지 않아야 하고, 57개 표준 cell bbox의 cell-local 합집합은 가로 또는 세로 중 큰 점유율이 70% 이상이어야 한다. 위반은 각각 `PNG_CELL_CLIPPED`, `PNG_OCCUPANCY_TOO_SMALL`으로 거부한다. 이 검사는 기존 empty/unused/look 검사를 보강하며 exporter 내부 상태를 신뢰하지 않는다.

### 5. 실제 두 캐릭터로 회귀 검증한다

로컬 `sd_07airi_normal`과 `sd_21miku_normal`을 동일한 v2 mapping으로 export한다. Miku idle은 `z_test_F_negi01`을 유지한다. Playwright는 다운로드한 실제 ZIP을 격리 root와 승인된 실제 Codex pets root에 설치하고, 독립 bbox 수치와 installed preview 상태를 검사한다. 마지막으로 실제 Codex renderer에서 캐릭터 크기, clipping, layer 순서를 screenshot으로 확인한다.

### 6. 자동 안전 fit 대비 80%–100%의 단일 사용자 배율을 적용한다

`framingScale`은 `0.80 ≤ f ≤ 1.00`, 기본 `1.00`, UI 간격 `0.01`로 고정한다. 100%는 기존 8px inset의 최대 안전 크기다. 자동 fit의 limiting-axis 점유율은 최소 `176/192 ≈ 0.9167`이므로 80%에서도 약 0.733을 유지해 validator의 0.70 기준을 통과한다. 100%를 넘으면 세로 또는 가로 제한 pose가 4px 안전 여백을 침범할 수 있으므로 허용하거나 조용히 clamp하지 않는다.

export의 기본 pixels-per-world-unit `s₀`에 `f`를 곱하고 projection을 `192/(s₀f) × 208/(s₀f)`로 계산한다. 수평 중심은 가시 bounds 중심에 고정하고 `y = minY - 8/(s₀f)`로 계산해 모든 배율에서 bottom anchor를 8px로 유지한다. 이 projection 하나를 표준 57개와 look 16개 모두에 사용하며 look 이동은 계속 최종 cell 기준 2px×1.5px다.

WebGL preview session은 보정된 현재 animation bounds를 cache한다. 슬라이더 변경은 재-calibration이나 animation restart 없이 cached bounds의 projection만 갱신하고 같은 pose를 다시 그린다. animation 변경은 새 pose를 한 번 보정하되 선택 배율을 유지하고, resize도 배율을 유지한다. 큰 preview와 `192×208` final cell의 종횡비·bounds 범위가 다르므로 preview는 상대 크기와 안정적인 하단 anchor를 보여주며, 생성 후 installed preview가 최종 pixel의 권위다.

`App`이 배율의 단일 source of truth를 소유해 active preview session과 `CodexPetBuilder`에 전달한다. 새 source가 성공적으로 ready가 될 때만 100%로 초기화한다. export는 시작 시 배율을 snapshot하며, 배율 변경은 진행 중 export를 취소하고 기존 download URL·검증 결과·installed preview를 폐기하지만 metadata와 animation mapping은 유지한다. 배율은 PNG pixel에 bake하며 `pet.json` schema는 변경하지 않는다.

## Risks / Trade-offs

- [coarse 해상도에서 1px보다 작은 effect가 보이지 않을 수 있음] → alpha 0이 아닌 모든 coarse pixel을 포함하고 world 1px guard와 final 8px inset을 함께 적용한다.
- [calibration 때문에 57회 draw/readback이 추가됨] → 동일한 `192×208` target에서만 수행하고 각 frame 사이 기존 cooperative yield와 취소 검사를 유지한다.
- [큰 소품이 포함된 상태가 전체 projection을 제한할 수 있음] → 상태 간 물리적 scale 일관성과 무클리핑을 우선하며 Miku negi를 실제 회귀 fixture로 유지한다.
- [매 draw state 설정의 소규모 호출 비용] → 수 개의 boolean WebGL state 호출로 제한하며 결정적인 레이어 순서를 우선한다.
- [슬라이더를 빠르게 움직일 때 draw가 반복됨] → calibration과 animation state는 재시작하지 않고 projection과 현재 pose draw만 갱신한다.
- [preview와 final cell의 종횡비 차이] → UI는 자동 안전 fit 대비 상대 백분율로 표시하고 실제 package preview를 final pixel 기준으로 유지한다.

## Migration Plan

1. alpha pixel bounds/역변환/projection 및 2D WebGL state helper와 단위 테스트를 추가한다.
2. preview와 sampler를 helper로 전환하고 기존 테스트를 갱신한다.
3. validator와 Airi·Miku Playwright 품질 검사를 추가한다.
4. WebGL preview 슬라이더와 sampler `framingScale` handoff를 연결하고 경계값을 테스트한다.
5. 80% Airi와 100% Miku package를 다시 생성·설치하고 웹 및 실제 Codex 렌더링을 확인한다.
6. 실패 시 설치된 이전 ZIP을 복원할 수 있도록 새 package hash와 QA 결과를 기록한다.

## Open Questions

없음.
