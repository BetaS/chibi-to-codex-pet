## Context

현재 웹 exporter는 Codex Pet v1의 8×9 atlas와 57개 표준 상태 frame을 생성한다. 설치된 Codex의 v2 renderer는 rows 9–10의 16개 전체 캐릭터 frame을 `000` 위쪽에서 시계 방향 22.5도 간격으로 선택하며, 동적 눈 layer를 별도로 합성하지 않는다.

PRSK 공통 LiveSD (Spine 3.6) 스켈레톤의 좌·우 눈은 `eye_scale` bone에 묶인 별도 slot이지만 atlas region 하나가 동공만이 아닌 눈 전체의 흰자·홍채·동공·하이라이트를 포함한다. 167개 원본 animation은 `eye_scale` 이동을 사용하지 않으므로 exporter가 animation apply 후 이 bone을 미세 이동해야 한다.

## Goals / Non-Goals

**Goals:**

- 기존 rows 0–8의 mapping, timing, mirror, framing을 보존한다.
- 원본 atlas 눈 전체 attachment를 사용해 16방향 시선이 구분되는 전체 frame을 결정적으로 렌더링한다.
- `spriteVersionNumber: 2`, 8×11, `1536×2288` PNG package를 생성·검증·미리보기·설치한다.
- 일반 포인터를 사용하는 웹 미리보기에서 Codex와 같은 방향 index와 dead zone을 검증한다.
- Airi와 Miku를 실제 로컬 자산으로 재생성하고 실제 Codex pets root에 v2로 재설치한다.

**Non-Goals:**

- atlas에 없는 동공·홍채 layer를 추론, inpaint 또는 새로 그리지 않는다.
- 스켈레톤에 pupil/iris bone을 새로 리깅하지 않는다.
- Codex desktop의 Computer Use cursor 이벤트 발행 조건을 변경하지 않는다.
- v1 package를 새로 생성하거나 이 변경의 validator에서 계속 지원하지 않는다.

## Decisions

### 1. 새 이미지 생성 대신 원본 Spine pose를 결정적으로 렌더링한다

사용자가 요청한 atlas 기반 source 충실도를 위해 image generation과 raster pupil 분리를 사용하지 않는다. sampler는 idle에 선택된 animation의 `time=0` pose를 매 look frame마다 다시 적용한 뒤, `eye_scale` bone 위치만 방향별로 변경하고 전체 스켈레톤을 렌더링한다. 이 방법은 원본 눈 모양, 표정, alpha와 atlas pixel provenance를 유지한다.

대안인 전체 눈 texture에서 동공만 분리하는 색상 분할은 캐릭터별 palette와 highlight에 의존하고 눈 외곽을 파괴할 수 있어 제외한다.

### 2. 눈 이동량은 최종 cell pixel로 정의하고 parent world matrix의 역행렬로 변환한다

neutral pose에서 `eye_scale` bone에 연결된 실제 비표시자 눈 region 두 개 이상을 확인한다. 시선 반경은 최종 192×208 cell 기준 가로 2px, 세로 1.5px로 고정하고 canonical projection으로 world 이동량을 얻는다. 방향 `d`에 대해 `worldDx = sin(d) * 2 * projection.width / 192`, `worldDy = cos(d) * 1.5 * projection.height / 208`를 계산한다. Spine world의 +y는 출력의 위쪽이다.

`F_head`의 world rotation은 Airi와 Miku에서 각각 약 95도와 83도이므로 world delta를 `eye_scale.x/y`에 직접 더해서는 안 된다. parent matrix `a,b,c,d`의 determinant로 역행렬을 구해 `localDx = (d*worldDx - b*worldDy)/det`, `localDy = (-c*worldDx + a*worldDy)/det`로 변환한 뒤 animation apply 후, `updateWorldTransform()` 전에 더한다. determinant가 0에 가까우면 안전한 시선 변환이 불가능하므로 export를 차단한다.

bone이 없거나 실제 눈 region이 두 개 미만이면 `LOOK_RIG_MISSING`으로 export를 차단한다. 빈 look cell을 채우기 위해 neutral pose를 복제하는 fallback은 시선 의미를 보장하지 못하므로 사용하지 않는다.

### 3. 표준 57개 frame의 canonical projection을 look frame에도 재사용한다

frame plan은 rows 0–8의 57개 frame 뒤에 rows 9–10의 16개 look frame을 추가해 총 73개를 만든다. 기존 v1 표준 row를 pixel 단위로 보존하기 위해 projection은 표준 57개 pose의 bounds 합집합으로만 계산한다. 눈 이동은 얼굴 외곽 안의 2px/1.5px로 제한되므로 look frame은 이 canonical projection을 그대로 재사용한다. rows 9–10은 모든 8개 column을 사용하며 주요 상태의 frame timing을 가지지 않는 정적 선택 frame이다.

### 4. 방향 순서와 웹 선택 식은 Codex desktop 계약을 따른다

row 9는 `000, 022.5, 045, 067.5, 090, 112.5, 135, 157.5`, row 10은 `180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5`를 저장한다. 웹 미리보기는 Pet 중심과 pointer의 `dx`, `dy`로 `atan2(dx, -dy)`를 계산하고 가장 가까운 22.5도 index를 선택한다. 중심 1px dead zone과 stage pointer leave에서는 look frame을 제거하고 기존 상태 animation을 계속한다.

### 5. validator는 v2의 16개 look cell을 전부 사용 cell로 검증한다

manifest와 IHDR은 v2와 `1536×2288`을 요구한다. rows 0–8은 기존 frame count 뒤의 미사용 cell이 투명해야 하고, rows 9–10은 각 8개 cell이 모두 비어 있지 않아야 한다. 구조 검증은 시선 방향의 의미를 대체하지 않으므로 Airi·Miku Playwright에서 16개 cell 픽셀 차이, cardinal pointer 선택과 시각 QA를 추가로 수행한다.

## Risks / Trade-offs

- [동공 대신 눈 전체가 이동함] → 이동량을 눈 attachment 크기의 작은 비율로 제한하고 192×208 실표시 크기의 cardinal QA로 눈 외곽이 얼굴에서 떠 보이지 않는지 확인한다.
- [시선 이동이 작아 중간 방향이 비슷해 보임] → 카디널을 hard gate로 두고 중간 방향은 순서와 연속성을 같이 검토한다.
- [표정 animation이 `eye_scale`을 다룸] → 매 frame마다 setup pose와 idle animation을 먼저 적용하고 look offset을 마지막에 더해 동일한 출발 pose를 보장한다.
- [look pose가 canonical framing 밖으로 나감] → Airi·Miku의 눈과 얼굴 경계 여유가 최대 이동보다 큰지 실파일로 검사하고, 전체 이동을 final cell 2px/1.5px로 제한한다.
- [v1 consumer와 호환되지 않음] → manifest version과 geometry를 함께 전환하고 검증된 Airi·Miku package를 원자적으로 덮어쓴다. 롤백은 기존 v1 스프라이트시트와 manifest를 복구하는 방식이다.

## Migration Plan

1. v2 계약, look direction plan과 rig validation을 단위 테스트로 추가한다.
2. sampler를 73개 frame·11행으로 확장하고 Airi·Miku 격리 Playwright package로 검증한다.
3. manifest·validator·installed preview를 v2로 전환하고 전체 테스트와 production build를 통과한다.
4. 실제 `${CODEX_HOME}/pets/airi-livesd`와 `miku-livesd`를 검증된 v2 package로 덮어쓴다.
5. 실제 Codex에서 custom pet 목록을 새로 고친 뒤 pointer look frame 렌더링을 확인한다.

## Open Questions

- 없음. 원본에 pupil/iris rig가 없다는 제약과 눈 전체 미세 이동을 사용하는 트레이드오프를 사용자가 명시적으로 선택했다.
