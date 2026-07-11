## Why

현재 exporter는 Codex Pet v1의 9개 상태 행만 생성하므로 Codex가 제공하는 16방향 시선 반응을 사용할 수 없다. Airi와 Miku의 LiveSD atlas는 좌·우 눈 전체 attachment와 공통 `eye_scale` bone을 제공하므로, 원본 자산을 유지하면서 미세한 눈 전체 이동으로 v2 시선 frame을 결정적으로 렌더링할 수 있다.

## What Changes

- 현재 선택된 LiveSD animation의 neutral pose에서 `eye_scale` 또는 검증된 눈 attachment rig을 16개 시계 방향으로 미세 이동해 전체 캐릭터 frame을 렌더링한다.
- 기존 8×9 상태 atlas의 rows 0–8을 그대로 유지하고, rows 9–10에 `000`부터 `337.5`까지 22.5도 간격의 16방향 frame을 추가한다.
- **BREAKING** 생성·검증 package 계약을 `spriteVersionNumber: 2`, 8×11, `1536×2288` atlas로 변경한다. 이 변경의 exporter와 validator는 새 v2 package만 생성·검증한다.
- installed preview가 일반 포인터 위치를 Codex와 같은 16방향 index로 계산해 look frame을 우선 표시하고, dead zone에서는 이전 상태 animation으로 복귀한다.
- Airi와 Miku 로컬 실파일에 대해 v2 ZIP 다운로드, 안전 설치, 9개 표준 상태, 16방향 시선 및 실제 Codex pets root 재설치를 검증한다.

## Capabilities

### New Capabilities

- `codex-pet-look-direction-rendering`: LiveSD atlas·skeleton의 검증된 눈 rig으로 16방향 v2 look frame을 결정적으로 렌더링하고 포인터 방향에 맞게 재생하는 계약

### Modified Capabilities

- `codex-pet-animation-mapping`: 기존 9개 mapping을 v2의 표준 rows 0–8 계약으로 유지하고 rows 9–10 look 확장과 구분하는 계약
- `livesd-frame-sampling`: 57개 표준 상태 frame과 공통 framing을 유지하면서 16개 look frame을 rows 9–10에 추가하는 샘플링 계약
- `codex-pet-package-export`: 생성 manifest, PNG geometry, pixel validation, installed preview와 실제 설치 검증을 Codex Pet v2로 확장하는 계약

## Impact

- `src/features/livesd/export/`: neutral pose와 eye rig override를 포함한 16방향 frame 계획·렌더링
- `src/features/codex-pet/`: v2 geometry·manifest·export·validation·installed preview
- `e2e/codex-pet-export.spec.ts`: Airi/Miku v2 package 다운로드·설치·시선 QA
- `${CODEX_HOME}/pets/airi-livesd`, `${CODEX_HOME}/pets/miku-livesd`: 검증 통과 후 v2 package로 재설치
- 새 외부 런타임이나 네트워크 의존성은 추가하지 않는다.
