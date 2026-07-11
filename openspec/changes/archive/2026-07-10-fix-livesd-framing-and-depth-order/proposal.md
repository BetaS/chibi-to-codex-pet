## Why

현재 LiveSD 기반 v2 pet은 투명한 파츠까지 포함한 모델 bounds로 공통 투영을 계산해, 실제 보이는 SD 캐릭터가 192×208 셀의 절반 안팎으로 축소된다. 또한 WebGL 렌더러가 depth buffer와 depth state를 명시적으로 배제하지 않아 동일 평면의 Spine attachment가 skeleton draw order 대신 깊이 판정에 간섭받을 수 있다. 자동 안전 framing만으로는 캐릭터와 소품에 따라 사용자가 선호하는 화면 크기를 고를 수 없으므로, 실제 WebGL preview에서 최종 pet 공통 배율을 직접 조절할 수 있어야 한다.

## What Changes

- preview와 frame sampler가 보수적인 coarse projection으로 실제 RGBA를 먼저 렌더링하고, alpha pixel bounds를 world 좌표로 역변환해 투명 texture·placeholder를 제외한다.
- 57개 표준 포즈의 실제 alpha bounds 합집합과 고정 8px inset으로 하나의 안정적인 canonical projection을 계산해, 셀을 충분히 사용하면서 프레임 간 크기 변화와 clipping을 방지한다.
- LiveSD WebGL context를 depth/stencil 없는 2D context로 만들고, 매 draw 전에 depth test/write 등 3D raster state를 비활성화해 Spine `drawOrder`를 유일한 겹침 순서로 보장한다.
- WebGL preview에 `80%–100%` Pet 크기 슬라이더를 제공하고, 선택한 단일 `framingScale`을 CSS가 아닌 preview projection과 표준·look 73개 전체의 canonical projection에 동일하게 적용한다.
- 새 source는 100%로 초기화하며, 배율 변경 시 이전 배율로 생성된 ZIP·검증 결과·installed preview를 폐기하고 이름과 상태 매핑은 유지한다.
- Airi와 Miku 로컬 리소스로 생성한 v2 atlas에 대해 셀 점유율, 안전 여백, 투명 프레임, clipping 및 실제 pet 렌더링을 검증한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `livesd-36-preview`: 실제 alpha 기반 framing, depth 없는 draw-order 렌더링과 사용자 Pet 크기 슬라이더 계약을 추가한다.
- `livesd-frame-sampling`: 실제 alpha 기반 canonical bounds와 사용자 공통 `framingScale` 적용 계약을 추가한다.
- `codex-pet-package-export`: 선택 배율과 package 결과의 일관성 및 실제 Airi·Miku v2 package 품질 계약을 추가한다.

## Impact

- LiveSD 3.6 preview adapter/session과 frame sampler의 calibration pass, bounds 계산, WebGL 상태 설정 및 `framingScale` handoff가 변경된다.
- `App` preview toolbar와 `CodexPetBuilder`에 접근 가능한 range control, 이전 결과 무효화 및 export snapshot 상태가 추가된다.
- v2 atlas 출력의 캐릭터 크기와 package hash가 변경되지만 manifest, 1536×2288 atlas, 192×208 cell, 8×11 layout 계약은 유지된다.
- 단위 테스트, Playwright 기반 로컬 export/install E2E, atlas 이미지 QA가 갱신된다.
