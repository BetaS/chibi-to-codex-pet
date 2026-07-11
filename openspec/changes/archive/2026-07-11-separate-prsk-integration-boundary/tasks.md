## 1. 현재 경계 고정과 범용 모델 계약 추출

- [x] 1.1 production source, test와 composition root의 현재 PRSK 파일·import graph를 목록화하고 허용·금지 의존성 fixture를 만든다
- [x] 1.2 `LiveSDAtlasBundle`과 source 독립 atlas page reference·relative path 처리를 `src/features/livesd/model/` 공개 API로 추출한다
- [x] 1.3 `adapter`와 `export`가 기존 PRSK importer 대신 범용 model API만 사용하도록 import와 테스트를 전환한다
- [x] 1.4 범용 model 오류를 기존 PRSK archive/remote 오류 코드로 변환하는 adapter와 경계 테스트를 추가한다

## 2. Local PRSK 구현 이동

- [x] 2.1 ZIP importer, archive path, archive 오류·제한·타입과 대응 테스트를 `src/features/livesd/prsk/archive/` 아래로 이동한다
- [x] 2.2 PRSK development character fallback과 대응 테스트를 `src/features/livesd/prsk/development/` 아래로 이동한다
- [x] 2.3 source 독립 shared skeleton 입력만 범용 `livesd/input/`에 유지하고 PRSK 경로 또는 오류 의존성이 없는지 확인한다
- [x] 2.4 local ZIP과 development fallback이 기존 bundle, limit, 오류 코드와 preview 준비 동작을 보존하는 회귀 테스트를 통과시킨다

## 3. Remote PRSK 구현 이동

- [x] 3.1 remote catalog/resource source, provider, parser, model path, network, 오류·타입과 대응 테스트를 `src/features/livesd/prsk/remote/` 아래로 이동한다
- [x] 3.2 remote resource source가 범용 model API를 생산하고 PRSK archive 내부 모듈을 참조하지 않도록 경계를 정리한다
- [x] 3.3 custom provider와 `prsk-chibi-viewer` snapshot의 URL 정책, fetch policy, trigger, limit과 오류 코드 회귀 테스트를 통과시킨다
- [x] 3.4 `src/features/livesd/prsk/index.ts`에서 App과 recipe renderer에 필요한 최소 공개 타입·factory·service·오류 adapter만 export한다

## 4. 소비자와 오류 경계 전환

- [x] 4.1 `App.tsx`가 PRSK 공개 진입점만 사용하도록 local·remote import를 전환하고 내부 deep import를 제거한다
- [x] 4.2 `codex-pet/recipeRenderer.ts`가 PRSK 공개 진입점만 사용하도록 전환하고 recipe schema·render 결과 동등성을 검증한다
- [x] 4.3 PRSK 오류 판별과 표시 정보 변환을 PRSK 경계로 옮기고 범용 `livesd/ui`의 PRSK import를 제거한다
- [x] 4.4 모든 production/test import를 검색해 범용 LiveSD → PRSK 역참조와 PRSK 외부 deep import가 없음을 확인한다

## 5. PRSK 방향 보정과 좌·우 독립 반전

- [x] 5.1 PRSK ready source에 기본 `globalMirrorX: false`, `running-right.mirrorX: true`, `running-left.mirrorX: false`를 추천하고 source 교체 시 재설정하는 방향 설정 계약을 추가한다
- [x] 5.2 Codex Pet Builder에 전체 캐릭터 반전과 `running-right`, `running-left` 각각의 반전 checkbox를 추가하고 세 선택이 독립적으로 갱신되는 component test를 작성한다
- [x] 5.3 표준 상태의 최종 반전을 `globalMirrorX XOR mapping[state].mirrorX`로 계산하는 공유 함수를 구현하고 네 boolean 조합과 frame 순서 보존을 테스트한다
- [x] 5.4 전체 반전 시 rows 9–10의 수평 look vector 또는 slot을 보정해 16개 pointer 방향 의미가 유지되는 sampler test를 추가한다
- [x] 5.5 recipe serializer/parser에 canonical 전체 반전 boolean을 추가하고 기존 schema version 1 누락값 `false`, 좌·우 상태별 설정과 네 조합의 round-trip을 검증한다
- [x] 5.6 웹 exporter와 headless recipe renderer가 동일한 전체·상태별 반전 합성을 사용하고 동일 spritesheet를 생성하는 회귀 테스트를 추가한다

## 6. 게임 source 선택과 integration routing

- [x] 6.1 `prsk`, `strr`, `garupa`의 ID, 표시명, 순서, 지원 상태와 available integration을 함께 정의하는 type-safe game source registry를 추가한다
- [x] 6.2 앱 최상단에 접근 가능한 game tablist를 추가하고 `프로세카`를 초기 선택, `레뷰 스타라이트(준비중)`와 `BanG Dream!(준비중)`을 비활성 상태로 렌더링한다
- [x] 6.3 PRSK 전용 상태와 UI를 `livesd/prsk` 공개 integration container로 연결하고 선택된 `prsk` entry가 local/remote preview와 Codex Pet Builder를 mount하도록 구성한다
- [x] 6.4 준비중 탭의 pointer, keyboard와 programmatic activation 시도가 선택, PRSK 입력·preview, request generation과 build 상태를 변경하지 않는 component test를 추가한다
- [x] 6.5 Playwright에서 상단 탭 순서·selected/disabled 상태, 프로세카 build 경로와 준비중 탭의 무네트워크·무빌드 동작을 검증한다
- [x] 6.6 integration이 없는 registry entry를 `available`로 만들 수 없도록 type 또는 runtime invariant test를 추가한다

## 7. 기본 resource manifest와 단일 불러오기

- [x] 7.1 PRSK resource source를 `provided | upload | custom`으로 정의하고 provided `prsk-chibi-viewer`를 초기 선택으로 설정한다
- [x] 7.2 기존 local/remote mode UI를 provided 기본, 선택적 upload/custom selector로 교체하고 source 전환 시 catalog·character·request generation을 안전하게 무효화한다
- [x] 7.3 `prsk-chibi-viewer 사용` 버튼을 제거하고 provided/custom provider resolution과 catalog request를 단일 `불러오기` action으로 통합한다
- [x] 7.4 catalog loading 중 불러오기 중복 실행을 차단하고 loading·empty·error 상태와 요청 origin 고지를 유지한다
- [x] 7.5 mount 시 development 기본 local preview를 실행하는 effect를 제거하고 최초 mount, StrictMode remount와 hard refresh fixture에서 resource 요청·preview 생성이 0회인지 테스트한다
- [x] 7.6 upload source가 기존 local 파일 검증과 browser-only 처리를 유지하며 provided/custom으로 자동 fallback하지 않는 component test를 추가한다
- [x] 7.7 provided/custom source가 클릭 전 무네트워크이고 단일 불러오기 클릭당 catalog generation 하나만 생성하는 component 및 Playwright 테스트를 추가한다

## 8. 구조 및 기능 검증

- [x] 8.1 PRSK 전용 파일의 `livesd/prsk/` 소유권, 금지된 역방향 import와 공개 API 우회 deep import를 검사하는 자동 검증을 추가한다
- [x] 8.2 local/remote component test와 Playwright PRSK smoke·remote·Codex Pet export 시나리오의 fixture import, 게임 탭, resource selector 및 방향 선택을 새 경계에 맞추고 전부 통과시킨다
- [x] 8.3 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`를 실행해 동작 회귀가 없음을 확인한다
- [x] 8.4 CLI renderer를 재빌드하고 `pnpm build`, local npx 검증과 production artifact 검사를 통해 PRSK 개발 자산·provider 응답·fixture가 산출물에 포함되지 않음을 확인한다
- [x] 8.5 README와 `DECISIONS.md`의 게임 source registry, 기본 resource manifest, 단일 load trigger, PRSK 아키텍처 및 방향 반전 설명을 갱신한다
- [x] 8.6 `openspec validate separate-prsk-integration-boundary`를 통과시키고 구현 결과와 proposal, design, delta spec, tasks 사이의 차이가 없는지 최종 점검한다

## 9. 상태별 실시간 Spine preview와 포인터 시선

- [x] 9.1 preview와 exporter가 공유하는 눈 이동 방향·projection·world-to-local 변환 helper를 범용 rendering 계층에 추출하고 수치 회귀 테스트를 추가한다
- [x] 9.2 `LiveSDPreviewSession`에 정규화 look target 설정·해제 기능을 추가하고 animation pose 이후 합성, frame 간 비누적과 해제 복원을 session test로 검증한다
- [x] 9.3 Codex Pet 상태 select의 focus·변경을 현재 Spine session 재생에 연결하고 preview canvas 포인터와 눈 이동량 slider를 같은 look target에 연결하는 component test를 추가한다
- [x] 9.4 Miku/Airi fixture에서 실제 Spine motion·pointer look preview를 검증하고 typecheck, lint, unit/component/E2E 및 OpenSpec 검증을 통과시킨다
