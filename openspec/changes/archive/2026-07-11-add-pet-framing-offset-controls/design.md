## Context

LiveSD preview와 Codex Pet exporter는 같은 alpha-calibrated projection을 사용하지만 현재 사용자가 조절할 수 있는 값은 `80%–100%` 배율뿐이고, preview에는 최종 `192×208` cell 경계가 표시되지 않는다. 따라서 확대 또는 위치 조정이 최종 atlas에서 어디까지 crop되는지 생성 전에 판단할 수 없으며, browser export와 recipe 기반 headless export가 위치 설정을 전달할 계약도 없다.

## Goals / Non-Goals

**Goals**

- LiveSD와 installed Codex Pet preview에서 최종 `192×208` cell의 경계를 명시적으로 표시한다.
- 공통 framing 배율을 `80%–150%`로 확장하고 X/Y offset을 최종 cell pixel 단위로 조절한다.
- WebGL preview, deterministic sampler, browser package와 recipe renderer가 같은 좌표 의미와 snapshot을 사용한다.
- 의도적인 확대·이동 crop은 허용하되 빈 cell, 잘못된 atlas geometry와 미사용 cell 오염은 계속 차단한다.
- 네 locale에서 visible label, 단위와 접근 가능한 control 이름을 제공한다.

**Non-Goals**

- Codex `pet.json` schema 또는 v2 atlas geometry를 변경하지 않는다.
- 상태별로 서로 다른 배율·offset을 제공하지 않는다.
- drag/pinch gesture나 자동 얼굴 추적 framing을 추가하지 않는다.
- 설치된 Pet의 runtime 위치를 변경하는 manifest 설정을 추가하지 않는다. 모든 framing은 PNG raster에 bake한다.

## Decisions

### 1. Offset은 최종 cell pixel 좌표로 정의한다

`framingOffsetX`와 `framingOffsetY`는 `192×208` output cell 기준 정수 pixel이다. 기본값은 `0,0`, X 범위는 `-96..96`, Y 범위는 `-104..104`, step은 1px로 제한한다. `+X`는 캐릭터를 오른쪽으로, `+Y`는 아래쪽으로 이동한다. 이 단위는 preview canvas 크기와 device pixel ratio에 독립적이고 recipe에서도 그대로 재현할 수 있다.

Projection에서는 X offset을 world 좌표의 왼쪽 경계를 감소시키고 Y offset을 world 좌표의 아래 경계를 증가시킨다. 배율과 offset은 alpha-calibrated base projection에 함께 적용되며 표준 57 frame과 look 16 frame이 하나의 canonical projection을 공유한다.

### 2. 배율 범위는 80%–150%로 확장한다

자동 안전 fit을 100%로 유지하고 `framingScale`의 범위를 `0.80..1.50`, UI step을 1%로 확장한다. 100% 초과는 projection을 축소해 캐릭터를 확대하므로 cell edge crop이 발생할 수 있다. 이는 border box를 보며 사용자가 선택하는 framing 결과로 취급한다.

### 3. Preview border box는 실제 cell aspect ratio를 사용한다

LiveSD canvas container를 `192 / 208` aspect ratio의 frame으로 만들고 시각적인 border와 `192 × 208` label을 표시한다. canvas resize와 WebGL projection은 이 container의 실제 크기를 따라가므로 border 안쪽이 곧 export cell이다. Installed preview는 이미 정확한 192×208 CSS sprite를 사용하므로 같은 경계 표시를 그 sprite box에 추가한다.

### 4. Custom framing만 edge crop 검사를 완화한다

기본 validator 동작은 기존과 동일하게 모든 used cell에 4px 안전 여백을 요구한다. `framingScale > 1` 또는 offset이 0이 아닌 snapshot으로 생성한 package에만 validator option을 전달해 edge 접촉을 허용한다. 이 경우에도 used cell empty, 최소 occupancy, atlas geometry, manifest 및 unused cell alpha 검사는 유지한다. 외부 호출자가 option을 명시하지 않으면 strict 검증이 유지된다.

### 5. Recipe schema version 1을 호환 확장한다

`pet.framingOffsetX`와 `pet.framingOffsetY`를 optional number로 추가한다. 기존 recipe에서 누락되면 각각 0으로 정규화하고 새 browser recipe에는 canonical 값을 명시한다. 유효 범위와 정수 여부를 strict parser가 검증한다. `schemaVersion`과 renderer ID는 바꾸지 않는다.

### 6. Framing 변경은 생성 결과만 무효화한다

배율 또는 offset 변경 시 진행 중 export를 취소하고 이전 download URL, validation 및 installed preview를 폐기한다. metadata, mapping, mirror와 현재 LiveSD animation은 유지한다. 새 source가 first-frame ready가 될 때만 `100%, 0, 0`으로 초기화한다.

## Risks / Trade-offs

- 150% 확대와 큰 offset은 캐릭터 일부를 잘라낼 수 있다. 실제 cell border를 항상 표시하고 custom framing에서만 의도적 crop을 허용한다.
- CSS 크기와 WebGL drawing buffer의 반올림 차이가 1px 수준으로 생길 수 있다. projection은 정규화된 cell pixel offset을 canvas 크기로 환산하고 raster 검증은 최종 192×208 출력에서 수행한다.
- Edge crop 검사 완화가 손상된 package를 숨길 수 있다. opt-in flag를 builder snapshot에서만 전달하고 empty/occupancy/geometry 검사는 완화하지 않는다.
- Optional recipe key는 오래된 consumer가 unknown key를 거부할 수 있다. 이 저장소의 strict parser와 CLI를 함께 갱신하고 renderer ID는 유지한다.

## Migration Plan

1. 공통 scale/offset 상수와 projection helper를 추가한다.
2. preview session, sampler input과 recipe parser/renderer에 offset을 전달한다.
3. UI control과 두 preview border box를 추가하고 framing 변경 invalidation을 연결한다.
4. validator의 opt-in edge crop 정책을 적용한다.
5. 단위·통합·browser test와 production build로 기본 및 custom framing을 검증한다.

기존 recipe와 UI state는 offset `0,0`, scale `100%`로 동작하므로 별도 데이터 migration은 없다.

## Open Questions

없음.
