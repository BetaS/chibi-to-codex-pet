## 1. Codex Pet v2 계약과 package

- [x] 1.1 8×11 geometry, 16방향 row·column, 표준 57/look 16/전체 73 frame 상수와 방향 계산 함수를 단일 계약으로 추가하고 단위 테스트한다.
- [x] 1.2 새 manifest가 `spriteVersionNumber: 2`를 생성하도록 변경하고 manifest·exporter 테스트를 v2로 갱신한다.
- [x] 1.3 package validator를 `1536x2288`과 rows 9–10의 16개 필수 cell을 검증하도록 확장하고 빈 look cell·잘못된 version·geometry 회귀 테스트를 추가한다.

## 2. atlas 기반 16방향 sampler

- [x] 2.1 idle `time=0`을 기준으로 rows 9–10의 16방향 frame plan을 만들고 방향·순서·독립 출발 pose를 단위 테스트한다.
- [x] 2.2 표준 57개 pose의 canonical projection으로 2px·1.5px world delta를 계산하고 parent 2×2 matrix의 역행렬로 bone local delta를 얻는 순수 함수와 정방향·90도 회전·특이 행렬 테스트를 구현한다.
- [x] 2.3 runtime에서 `eye_scale`과 두 개 이상의 실제 눈 attachment를 검증하고 누락·특이 행렬을 `LOOK_RIG_MISSING`으로 차단한다.
- [x] 2.4 기존 rows 0–8을 같은 canonical projection으로 보존하면서 16개 eye-offset 전체 frame을 추가 렌더링하고, 73개 frame 진행률·취소·자원 정리 테스트를 갱신한다.

## 3. v2 installed preview와 웹 통합

- [x] 3.1 installed preview를 8×11 background 좌표로 전환하고 현재 표준 상태와 look direction index를 독립적으로 렌더링한다.
- [x] 3.2 `atan2(dx, -dy)`·22.5도 반올림·1px dead zone으로 일반 pointer를 16방향에 연결하고 카디널´diagonal´leave´hover 복귀를 component 테스트한다.
- [x] 3.3 builder의 v2·73 frame·1536×2288 표기, 진행 상태와 validated manifest 전달을 갱신하고 통합 테스트한다.
- [x] 3.4 README와 `DECISIONS.md`의 v1-only 설명을 atlas 기반 v2 시선 계약과 native Computer Use cursor 제약으로 갱신한다.

## 4. Airi·Miku 실파일 검증과 설치

- [x] 4.1 Airi와 Miku Playwright가 v2 ZIP, manifest version 2, `1536x2288` PNG, 9개 표준 row와 16개 non-empty look cell을 다운로드·격리 설치·재검증하도록 확장한다.
- [x] 4.2 Playwright에서 모든 look cell의 픽셀 차이, 서로 다른 카디널, 포인터의 정확한 row·column 선택과 dead zone 복귀를 검증한다.
- [x] 4.3 Airi·Miku의 neutral과 16방향 정상 크기 QA 이미지를 검토해 눈 이동 방향, 얼굴 경계, 실루엣·등록 연속성을 확인한다.
- [x] 4.4 검증된 `airi-livesd`와 `miku-livesd` v2 package를 실제 `${CODEX_HOME}/pets`에 재설치하고 설치 manifest·spritesheet hash와 native 렌더링을 확인한다.

## 5. 통합 gate와 OpenSpec 마무리

- [x] 5.1 typecheck, lint, 전체 Vitest, production build와 OpenSpec strict validation을 통과한다.
- [x] 5.2 전체 Chromium Playwright 회귀 스위트를 통과하고 외부 요청·자산 번들링 회귀가 없음을 확인한다.
- [x] 5.3 delta spec을 main spec에 sync하고 완료된 `add-atlas-eye-gaze-v2-pets` 변경을 archive한다.
