## 1. Codex Pet 상태와 매핑 계약

- [x] 1.1 9개 상태의 row, frame 수, duration, cell/atlas geometry를 정의하는 `codex-pet` contract 모듈을 추가한다.
- [x] 1.2 실제 animation 목록만 반환하는 우선순위 기반 자동 매핑과 `running-left` mirror metadata를 구현한다.
- [x] 1.3 직접 이름, 의미 fallback, 부족한 후보, 좌우 mirror 및 Airi 여성형 후보를 검증하는 단위 테스트를 추가한다.

## 2. 결정적 LiveSD frame sampling

- [x] 2.1 export input, progress, abort와 안정적인 sampling 오류를 위한 runtime 독립 type/error 경계를 추가한다.
- [x] 2.2 fixed Spine 3.6 runtime과 atlas image loader를 재사용하는 manual-time `LiveSD36FrameSampler`를 구현한다.
- [x] 2.3 전체 sample bounds 합집합, 공통 projection, WebGL RGBA readback과 Y축 보정을 구현한다.
- [x] 2.4 57개 frame atlas 배치, `mirrorX`, 완전 투명 미사용 cell과 PNG encoding을 구현한다.
- [x] 2.5 명시적 sample time, 공통 framing, 좌우 mirror 순서, abort와 자원 정리를 mock runtime/canvas로 검증한다.

## 3. Codex Pet package와 validator

- [x] 3.1 pet metadata 정규화, 안전한 slug와 v1 `pet.json` 생성을 구현하고 경계값을 테스트한다.
- [x] 3.2 `<pet-id>/pet.json`과 `<pet-id>/spritesheet.png`만 포함하는 `.codex-pet.zip` exporter를 구현한다.
- [x] 3.3 ZIP 경로, manifest, PNG signature/geometry, 사용 cell alpha와 미사용 cell 투명도를 독립적으로 검사하는 validator를 구현한다.
- [x] 3.4 정상 package, unsafe entry, 잘못된 manifest/geometry, 빈 사용 cell과 불투명 미사용 cell 테스트를 추가한다.

## 4. 웹 builder 통합

- [x] 4.1 preview session 활성화와 동일한 시점에 runtime 독립 active export source를 교체하고 실패·unmount에서 정리한다.
- [x] 4.2 ready animation 목록으로 9개 상태 매핑을 표시하고 상태별 select 및 left mirror override를 제공한다.
- [x] 4.3 pet 이름·설명, export progress·취소, package 생성·재검증과 실제 ZIP download UI를 구현한다.
- [x] 4.4 validator가 복원한 atlas로 Codex 좌표를 재현하는 상태별 installed preview와 frame 순환을 구현한다.
- [x] 4.5 source 교체, 매핑 override, export 성공/오류/취소, download와 preview 접근성을 컴포넌트 테스트로 검증한다.

## 5. 실제 Airi 다운로드·설치·렌더링 검증

- [x] 5.1 `assets/prsk/sd_07airi_normal`의 atlas/PNG로 Playwright 업로드 ZIP을 생성하고 실제 공통 스켈레톤을 선택하는 fixture를 추가한다.
- [x] 5.2 Playwright에서 자동 매핑 확인, package 생성, download event와 실제 ZIP bytes 검증을 구현한다.
- [x] 5.3 download ZIP을 `testInfo.outputPath()`의 격리 Codex pets root에 안전하게 설치하고 설치된 manifest/PNG를 다시 검증한다.
- [x] 5.4 9개 상태 renderer의 실제 Airi pixel과 animation frame 변화를 screenshot/pixel 검사로 확인한다.
- [x] 5.5 명시적인 `CODEX_PET_INSTALL_ROOT`로 실제 Codex pets 디렉터리 설치 smoke를 실행하고 앱에서 refresh·선택·wake 렌더링을 확인한다.

## 6. 문서와 전체 품질 게이트

- [x] 6.1 README와 결정 기록에 v1 선택 이유, ZIP 설치 방법, 상태 매핑과 privacy/build 제외 계약을 문서화한다.
- [x] 6.2 `pnpm typecheck`, `pnpm lint`, `pnpm test`, 신규/전체 Playwright와 `pnpm build`를 모두 통과시킨다.
- [x] 6.3 in-app Browser에서 builder shell의 console·visual 오류가 없음을 확인하고, client가 차단하는 `.atlas` 입력 이후 생성·download·installed preview는 실제 Chromium Playwright와 native Codex renderer에서 재확인한다.
- [x] 6.4 `openspec validate add-livesd-codex-pet-exporter --type change --strict`와 task 완료 상태를 확인한다.
