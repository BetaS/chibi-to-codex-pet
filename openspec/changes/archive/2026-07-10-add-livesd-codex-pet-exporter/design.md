## Context

현재 앱은 `LiveSDAtlasBundle`과 공통 스켈레톤을 `LiveSD36Adapter`에 전달해 animation 목록을 얻고 WebGL 미리보기를 반복 재생한다. preview session은 wall-clock `requestAnimationFrame`에 결합되어 있고 pose seek, animation duration, raster frame capture를 제공하지 않으므로 그대로 화면을 캡처하면 실행마다 다른 결과가 나온다.

설치된 Codex 앱은 로컬 custom pet을 `${CODEX_HOME:-$HOME/.codex}/pets/<folder>/pet.json`과 같은 디렉터리의 PNG/WebP atlas로 읽는다. `spriteVersionNumber: 1`은 `192x208` 셀, 8열, 9행의 `1536x1872` atlas를 사용하며 9개 명명 상태와 정확히 대응한다. ZIP 자체를 여는 native installer는 없으므로 웹 출력 ZIP은 이 설치 디렉터리를 보존하는 이동 형식이고, 실제 설치는 안전하게 압축을 해제하는 테스트/사용자 단계다.

테스트 기준 리소스의 실제 경로는 요청 표기의 underscore 변형이 아니라 `assets/prsk/sd_07airi_normal`이며, 공통 `assets/prsk/base_model/sekai_skeleton.skel`과 조합한다. 이 스켈레톤은 167개 animation을 가지지만 `wave`, `jump`, `run`이라는 직접 이름은 없으므로 의미 기반 fallback과 사용자 확인이 모두 필요하다.

## Goals / Non-Goals

**Goals:**

- ready LiveSD source의 animation을 9개 Codex Pet 상태에 자동 추천하고 사용자가 수정할 수 있게 한다.
- wall-clock과 무관한 명시적 animation time으로 총 57개 frame을 결정론적으로 렌더링한다.
- 동일 export의 모든 frame에 하나의 framing을 적용해 clipping과 크기 튐을 줄인다.
- Codex가 실제 읽을 수 있는 v1 manifest와 atlas를 `<pet-id>/` 아래에 둔 ZIP으로 다운로드한다.
- 생성 직후 package를 다시 검증하고 동일한 sprite row/column 규칙으로 상태별 렌더링을 보여 준다.
- `sd_07airi_normal`로 다운로드한 실제 ZIP을 임시 또는 명시된 Codex pets root에 설치하고 렌더링을 검증한다.

**Non-Goals:**

- v2의 포인터 시선 방향 16개 pose를 생성하거나 LiveSD에 없는 gaze rig를 합성하지 않는다.
- Codex의 HTTPS deep-link pet installer를 호출하거나 사용자의 파일을 업로드하지 않는다.
- Cubism 기반 Live2D 입력, 음성, 사운드, 물리 simulation을 새로 지원하지 않는다.
- animation 이름만으로 의미가 완벽하다고 주장하지 않으며 사용자 override를 제거하지 않는다.

## Decisions

### 1. 9개 상태에 맞는 Codex Pet v1을 출력한다

출력은 `spriteVersionNumber: 1`, 8열×9행, `1536x1872` PNG로 고정한다. 행 순서는 `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`이며 사용 frame 수는 각각 6, 8, 8, 4, 5, 8, 6, 6, 6이다. 사용하지 않는 셀은 완전 투명하게 유지한다.

v2는 현재 앱이 지원하지만 추가 2행은 상태가 아니라 pointer gaze이다. 입력 스켈레톤에 16방향 의미가 없는데 synthetic bone 변형이나 중립 frame 복제로 채우면 source-faithful 변환과 방향 semantics를 모두 해치므로 이번 변경에서는 v1을 선택한다.

### 2. 상태 계약과 animation 매핑을 runtime 밖의 순수 모듈로 둔다

`src/features/codex-pet/contract.ts`는 행, frame 수, 재생 duration, 표시 label을 단일 source of truth로 제공한다. `animationMapping.ts`는 animation 이름을 정규화하고 상태별 우선 token/정확 일치 목록으로 점수를 계산한다. 후보가 없으면 `pose_default`, 첫 idle 후보, animation 목록의 첫 항목 순으로 fallback하되 항상 실제 목록 안의 이름만 반환한다.

`running-left`는 `running-right`와 같은 source animation을 사용할 수 있고 별도 `mirrorX` metadata로 capture 결과만 수평 반전한다. 다른 상태는 서로 다른 의미를 유지하며 자동으로 다른 상태의 raster frame을 복사하지 않는다. UI의 각 select는 현재 animation 목록만 제공하고 source가 바뀌면 추천값을 다시 계산한다.

`sd_07airi_normal`의 기대 추천값은 실제 파싱 결과를 기준으로 다음과 같이 고정 회귀 테스트한다.

- `idle`: `w_happy_idle01_f`
- `running-right`: `w_normal_walk01_f`
- `running-left`: `w_normal_walk01_f` + `mirrorX`
- `waving`: `w_cute_joy01_f`
- `jumping`: `w_happy_surprise01_f`
- `failed`: `w_happy_sad01_f`
- `waiting`: `w_happy_listen01_f`
- `running`: `w_happy_doubt01_f`
- `review`: `w_happy_doubt02_f`

### 3. preview와 분리된 manual-time frame sampler를 만든다

`LiveSD36FrameSampler`는 기존 fixed runtime loader, atlas image loader, skeleton padding과 error 정규화를 재사용하되 자체 offscreen WebGL canvas와 runtime 자원을 소유한다. 각 source animation의 `duration`을 읽고 endpoint 중복을 피하도록 `time = duration * frameIndex / frameCount`로 pose를 직접 적용한다. `requestAnimationFrame`, timeout 또는 활성 preview canvas를 읽지 않는다.

첫 pass는 모든 sample pose의 bounds를 계산해 합집합을 만들고, 두 번째 pass는 그 합집합에 10% padding을 적용한 동일 projection으로 모든 frame을 렌더링한다. WebGL `readPixels` 결과는 Y축을 뒤집어 `ImageData`로 만들고 atlas의 정확한 셀 좌표에 기록한다. `mirrorX`는 완성된 단일 cell을 2D canvas에서 반전해 source animation timing과 frame 순서를 보존한다.

sampler는 `AbortSignal`과 progress callback을 받고 성공·실패·취소에서 texture, image URL, GL renderer와 canvas 참조를 한 번만 정리한다.

### 4. ready source와 export source를 원자적으로 교체한다

App은 성공적으로 첫 preview frame까지 그린 source의 `atlasBundle`과 `skeletonData`만 `ActiveLiveSDSource`로 보존한다. 새 source가 loading 또는 실패 상태일 때 기존 ready source와 exporter 입력은 유지하며, 새 session 활성화가 성공한 같은 시점에 둘을 교체한다. session의 후속 render 실패나 unmount에서는 export source도 제거한다.

### 5. package 생성과 검증을 분리한다

`CodexPetExporter`는 metadata, 유효한 상태 매핑과 sampled atlas를 받아 UTF-8 `pet.json`과 `spritesheet.png`를 `<safe-id>/` 아래에 넣는다. id는 소문자 영숫자와 `-`만 사용하는 slug로 정규화하고 빈 값, path separator, `.`/`..`는 허용하지 않는다. 다운로드 이름은 `<safe-id>.codex-pet.zip`이다.

`CodexPetPackageValidator`는 생성된 Blob을 독립적으로 다시 열어 정확히 하나인 top-level pet 디렉터리, manifest schema, `spriteVersionNumber: 1`, 내부 상대 `spritesheetPath`, PNG signature, `1536x1872` 크기, 각 사용 cell의 non-empty alpha와 미사용 cell의 완전 투명 alpha를 검사한다. 검증이 성공해야 download와 installed preview를 제공한다.

### 6. 웹의 installed preview가 Codex의 sprite 좌표를 재현한다

생성 성공 뒤 UI는 atlas object URL을 `background-size: 800% 900%`로 표시하고 상태에 맞는 row/column을 순환한다. 이 preview는 package validator가 다시 읽은 bytes를 사용하므로 exporter 내부 canvas를 직접 표시하지 않는다. 사용자가 상태를 바꿀 수 있고 `data-pet-state`, `data-frame-index`를 노출해 Playwright가 실제 rendered cell 변화와 alpha를 검사한다.

### 7. ZIP 설치 테스트는 명시된 pets root에만 쓴다

Playwright Node 측 helper는 download bytes를 path traversal 없이 풀어 `<install-root>/<pet-id>/pet.json`과 `spritesheet.png`를 만든다. 기본 install root는 repository의 `test-results/codex-home/pets`이고, 명시적인 `CODEX_PET_INSTALL_ROOT`가 있을 때만 실제 `${CODEX_HOME}/pets`를 사용한다. 테스트는 설치된 manifest를 다시 읽고 PNG geometry와 상태별 pixel 변화 및 browser installed preview를 함께 검증한다.

브라우저 자체에서 홈 디렉터리에 쓰거나 native app을 자동 조작하지 않는다. 실제 Codex 설치 smoke는 사용자가 요청한 검증 실행에서 `CODEX_PET_INSTALL_ROOT`를 명시해 같은 Playwright 시나리오를 실행한 뒤 Codex settings refresh로 확인한다.

## Risks / Trade-offs

- **이름 기반 추천이 특정 모델의 의미와 다를 수 있음** → 실제 목록으로 제한하고 모든 상태 select 및 Airi 회귀 fixture를 제공한다.
- **animation bounds의 극단적인 effect가 모델을 작게 만들 수 있음** → 실제로 선택된 57개 pose만 합집합에 포함하고 10% padding을 적용하며 preview로 확인한다.
- **WebGL readback이 느릴 수 있음** → 57개 frame과 고정 `192x208` 해상도로 제한하고 progress와 취소를 제공한다.
- **PNG atlas가 WebP보다 클 수 있음** → lossless alpha와 브라우저 호환성을 우선하고 Codex의 20MiB image 제한보다 작은지 validator에서 확인한다.
- **ZIP을 Codex가 직접 열지 않음** → manifest 디렉터리 구조를 보존하고 설치 방법 및 테스트 helper의 역할을 UI/README에 명시한다.
- **v1은 pointer look을 지원하지 않음** → 9개 요청 상태의 source 충실도를 우선하며 후속 capability로 v2 look rig를 분리한다.

## Migration Plan

1. 신규 `codex-pet` 순수 계약·매핑 모듈과 테스트를 추가한다.
2. adapter에 export 전용 sampler를 추가하되 기존 preview API와 동작을 유지한다.
3. App에 active source handoff와 builder UI를 feature flag 없이 연결한다.
4. package validator와 installed preview를 통과한 경우에만 ZIP download를 활성화한다.
5. 합성 fixture, 실제 `sd_07airi_normal`, Playwright download/install/render, production build 검증을 순서대로 실행한다.

기존 importer와 preview는 exporter 실패와 독립적으로 계속 사용할 수 있으므로 rollback은 builder section과 신규 feature 모듈을 제거하는 것으로 가능하다. 저장 형식 migration이나 서버 배포는 없다.

## Open Questions

- 없음. 실제 Codex 앱의 v1 schema와 로컬 테스트 자산의 animation 목록을 구현 전에 확인했다.
