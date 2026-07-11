## Context

Codex Pet frame sampler는 `resolveCodexPetMirrorX(globalMirrorX, stateMirrorX)`로 전체·상태별 반전을 XOR하고, 렌더된 cell을 2D canvas에서 수평 반전한다. 반면 실시간 `LiveSDPreviewSession`은 animation, framing과 look target만 제어하며 반전 API가 없다. `CodexPetBuilder`도 전체 반전 변경을 상위 integration에 알리지 않고, 상태별 mirror checkbox 변경은 해당 상태 preview를 재생하지 않는다.

Preview canvas에 CSS `transform: scaleX(-1)`을 적용하면 표시만 뒤집히고 WebGL projection·alpha calibration·pointer look 좌표는 원래 방향으로 남는다. 최종 export와 같은 의미를 제공하려면 session projection과 UI 상태를 함께 연결해야 한다.

## Goals / Non-Goals

**Goals:**

- LiveSD session이 현재 view bounds와 framing을 유지한 채 전체 pose를 중심 기준으로 수평 반전한다.
- 상태 preview는 export와 동일한 `globalMirrorX XOR stateMirrorX` 결과를 표시한다.
- 전체·상태별 checkbox, 상태 shortcut, mapping focus·변경과 direct animation 선택에서 preview 방향이 즉시 일관되게 바뀐다.
- 반전 중에도 pointer를 기준으로 본 화면상 눈 이동 방향을 유지한다.
- source lifecycle, locale 전환, package와 network 무변경 계약을 유지한다.

**Non-Goals:**

- Skeleton bone, attachment 좌표 또는 source animation을 영구 수정하지 않는다.
- Export sampler의 기존 2D cell mirror 알고리즘을 바꾸지 않는다.
- 수직 반전, 회전 또는 상태별 임의 transform을 추가하지 않는다.
- mirror 값을 recipe나 manifest에 새 형식으로 저장하지 않는다.

## Decisions

### Session은 projection width의 부호로 중심 반전한다

`LiveSDPreviewSession`에 `setMirrorX(boolean)`을 추가한다. `WebGLLiveSDPreviewSession`은 canonical positive-width projection을 계속 보존하고, matrix 설정 시 반전이 켜져 있으면 `ortho2d(x + width, y, -width, height)`를 사용한다. 이렇게 하면 bounds 중심과 framing scale을 유지하면서 skeleton·draw order를 수정하지 않는다.

CSS transform은 WebGL 내부 좌표와 pointer hit testing을 분리하므로 제외한다. Skeleton root scale 변경은 animation·bone hierarchy와 bounds 계산에 영향을 줄 수 있어 제외한다.

### Alpha calibration은 canonical 무반전 projection에서 수행한다

Animation 변경 시 coarse alpha calibration은 항상 positive-width projection으로 렌더링하고 screen pixel을 world bounds로 역변환한다. 최종 draw에서만 현재 mirror를 적용한다. 반전된 pixel bounds를 canonical world bounds로 잘못 해석해 비대칭 캐릭터가 이동하는 문제를 방지한다.

### Pointer look은 mirror 상태에서 normalized X를 반전한다

Projection이 반전되면 world +X가 screen -X가 된다. 따라서 저장된 screen-space look target의 X는 bone world delta 계산 직전에만 부호를 반전한다. UI pointer normalization과 eye bone 자체는 변경하지 않는다. Mirror toggle 중 pointer가 활성 상태면 animation pose에서 look offset을 다시 계산한다.

### Builder는 mirror snapshot을 preview callback에 명시적으로 전달한다

`CodexPetBuilder`는 초기값과 변경된 전체 반전을 optional callback으로 알린다. 상태 animation preview callback은 해당 상태의 현재 `mirrorX`를 함께 전달하며, mirror checkbox 변경도 그 상태를 즉시 활성 preview로 만든다. Shortcut도 자체 mapping의 animation과 mirror를 함께 전달한다.

`PrskIntegration`은 최신 전체 반전·mapping·활성 상태를 ref로 보존한다. 상태 경로는 전달된 state mirror와 전체 반전을 XOR해 `session.setMirrorX()` 뒤 `play()`하고, direct 경로는 활성 상태를 해제한 뒤 전체 반전만 적용한다. Mapping 또는 전체 반전만 바뀌어도 현재 활성 상태의 방향을 재계산한다.

## Risks / Trade-offs

- [Risk] negative projection width가 matrix 구현에서 예상과 다르게 처리될 수 있다. → adapter unit test에서 `ortho2d(x + width, y, -width, height)` 호출과 실제 WebGL pixel centroid 반전을 함께 검증한다.
- [Risk] mirror 변경과 mapping state effect 순서가 엇갈려 한 frame 동안 이전 방향이 보일 수 있다. → event callback에 새 mirror 값을 직접 전달하고 integration ref를 동기 갱신한 뒤 session을 호출한다.
- [Risk] 반전된 look target에서 offset이 누적될 수 있다. → 기존 `removeAppliedLookOffset → animation apply → mirrored target apply` 순서를 재사용하고 연속 toggle test를 추가한다.
- [Risk] 새 session method로 기존 test mock이 깨진다. → runtime 독립 interface의 모든 fixture를 갱신하고 호출 횟수를 명시적으로 검증한다.

## Migration Plan

1. session interface와 projection·look 구현을 추가하고 adapter test를 통과시킨다.
2. builder mirror callback과 PRSK integration의 XOR state machine을 연결한다.
3. component 및 실제 WebGL pixel 회귀를 실행한다.
4. 문제 발생 시 session method와 callback 연결을 함께 제거하면 기존 export-only mirror 동작으로 복귀한다.

## Open Questions

없음.
