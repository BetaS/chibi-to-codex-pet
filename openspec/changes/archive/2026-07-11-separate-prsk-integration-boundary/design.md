## Context

현재 `src/features/livesd/`에는 범용 LiveSD (Spine 3.6) 처리와 PRSK source 통합이 혼재한다.

```text
livesd/
├── adapter/       범용 런타임 + 일부 PRSK profile 상수
├── export/        범용 frame sampling, importer 타입에 의존
├── importer/      PRSK ZIP + 공용 LiveSDAtlasBundle/path 처리
├── input/         PRSK 개발 fallback + 공용 skeleton 입력
├── remote/        전부 PRSK provider
├── rendering/     범용
├── runtime/       범용
└── ui/            범용 UI가 PRSK 오류들을 직접 판별
```

`LiveSDAtlasBundle` 및 atlas page path 해석은 local PRSK ZIP, remote PRSK source뿐 아니라 adapter와 exporter도 소비한다. 따라서 기존 `importer/`를 통째로 `prsk/`로 이동하면 범용 계층이 PRSK 폴더에 의존하는 역방향 결합이 남는다. 폴더 정리와 함께 source 독립 계약을 먼저 추출해야 한다.

## Goals / Non-Goals

**Goals:**

- PRSK에만 해당하는 구현과 테스트를 `src/features/livesd/prsk/` 아래에서 찾을 수 있게 한다.
- 범용 LiveSD 계층이 PRSK 계층을 import하지 않는 단방향 의존성을 만든다.
- 앱과 recipe renderer가 안정적인 PRSK 공개 진입점만 사용하게 한다.
- 기존 local/remote 입력, preview, exporter, recipe와 오류 표현을 동작 변경 없이 이전한다.
- PRSK의 기본 왼쪽 방향을 전체 반전으로 보정하면서 좌·우 이동 row를 각각 조정할 수 있게 한다.
- 게임 source registry와 상단 탭을 통해 선택된 integration만 가져오기·미리보기·빌드 흐름에 연결한다.
- 기본 제공 manifest를 우선하는 PRSK resource selector와 명시적인 단일 load trigger를 제공한다.
- 상태 매핑 선택과 포인터 시선 이동을 이미 활성화된 Spine preview session에서 실시간으로 검증할 수 있게 한다.
- 후속 source 또는 Live2D 통합이 PRSK 내부 규칙을 복제하지 않고 독립된 경계를 가질 수 있게 한다.

**Non-Goals:**

- PRSK 네트워크 provider, ZIP 계약, resource limit 또는 UI 흐름 변경
- Spine runtime 교체나 Live2D 구현
- ZIP/pet manifest 형식 변경
- URL, 오류 코드, 사용자 문구의 의도적 변경
- `assets/prsk/` 개발 자산 자체의 이동
- STRR 또는 Garupa importer, runtime profile, remote provider와 recipe 구현

## Decisions

### 1. `livesd/prsk/`를 source 통합 경계로 사용한다

목표 구조는 다음과 같다.

```text
src/features/livesd/
├── model/                 source 독립 데이터와 atlas path 계약
├── adapter/               LiveSD 3.6 runtime adapter
├── export/
├── rendering/
├── runtime/
├── input/                 source 독립 shared skeleton 입력만 유지
├── ui/                    source 독립 UI만 유지
└── prsk/
    ├── archive/           ZIP importer, archive path, PRSK 오류·제한
    ├── development/       PRSK 개발 fallback
    ├── remote/            catalog/resource/provider/network
    └── index.ts           외부 소비용 공개 진입점
```

`archive`, `development`, `remote`의 세부 이름은 구현 중 파일 수에 맞게 조정할 수 있지만, 모든 PRSK 전용 production 코드와 대응 unit test가 `prsk/` 하위에 있어야 한다. 단순히 기존 세 폴더를 한 단계 감싸는 방식보다 source 소유권이 명확하다.

대안으로 `src/features/prsk/`를 최상위 feature로 두는 방식을 고려했으나, 현재 PRSK 통합은 LiveSD용 모델 source이고 adapter/export 계약을 직접 소비한다. 이번 변경에서는 `livesd/prsk/`가 관계를 더 정확히 표현한다.

### 2. source 독립 모델 계약을 `livesd/model/`로 추출한다

다음 요소는 PRSK 이름과 오류를 제거한 범용 모듈이 소유한다.

- `LiveSDAtlasBundle`
- atlas text에서 page reference를 읽는 기본 처리
- atlas 기준 상대 page path 정규화·해석

PRSK archive와 remote 계층은 이 계약을 생산하며, adapter와 exporter는 동일 계약을 소비한다.

```text
              ┌───────────────────┐
PRSK archive ─┤                   │
PRSK remote  ─┤ LiveSD model API  ├─▶ adapter ─▶ preview
future source ┤                   ├─▶ exporter
              └───────────────────┘
```

범용 path parser가 발견한 저수준 실패를 어떤 공개 오류 코드로 변환할지는 PRSK 경계가 책임진다. 이를 통해 범용 모델 모듈이 `PrskArchiveImportError` 또는 `PrskRemoteError`를 알지 않는다.

### 3. 의존성 방향을 구조 검증 대상으로 만든다

허용 방향은 다음과 같다.

```text
composition roots (App, recipe renderer)
              │
       ┌──────┴──────┐
       ▼             ▼
   livesd/prsk    livesd generic
       │             │
       └──────▶ model ◀──────┘
```

- `livesd/prsk/**`는 범용 `model`, `adapter` 공개 계약을 사용할 수 있다.
- `livesd/{model,adapter,export,rendering,runtime,input,ui}/**`는 `livesd/prsk/**`를 import할 수 없다.
- `App.tsx`와 `codex-pet/recipeRenderer.ts` 같은 composition root는 `livesd/prsk/index.ts`만 import한다.
- PRSK 하위 폴더 밖에서는 `prsk/archive/*`나 `prsk/remote/*` 같은 내부 경로를 deep import하지 않는다.

이 규칙은 단순 파일 위치 검사와 import scan을 production artifact 검증 또는 별도 구조 테스트에 추가해 회귀를 차단한다.

### 4. 오류 정규화는 source별 adapter와 범용 표시 계층으로 나눈다

현재 범용 `livesd/ui/previewError.ts`가 PRSK archive, development, remote 오류 클래스를 직접 import한다. PRSK 오류 판별과 안정적 표시 정보 변환은 `prsk` 공개 API가 담당하고, 범용 UI는 이미 정규화된 preview error 또는 source 독립 오류만 처리한다. composition root가 두 결과를 결합한다.

대안으로 범용 UI에서 `prsk/index.ts`만 import하는 방식은 구현량이 적지만 의존성 역전을 남기므로 채택하지 않는다.

### 5. 이전은 경로 단위로 수행하고 각 단계에서 동등성을 검증한다

먼저 source 독립 계약을 추출하고 adapter/export import를 전환한 뒤, archive → development → remote 순서로 PRSK 내부를 이동한다. 마지막으로 composition root와 오류 정규화를 전환한다. 각 단계에서 타입 검사와 관련 unit test를 실행해 대규모 이동으로 인한 원인 추적 어려움을 줄인다.

### 6. 전체 방향 보정과 상태별 반전은 두 단계 설정으로 유지한다

PRSK 방향 설정은 다음 두 값을 구분한다.

- `globalMirrorX`: PRSK source 전체를 추가 반전하는 사용자 선택. PRSK ready source의 초기 추천값은 `false`다.
- `mapping[state].mirrorX`: 특정 표준 상태 row의 추가 반전. `running-right`와 `running-left`에서 각각 독립적으로 편집할 수 있다.

최종 표준 cell의 반전은 `globalMirrorX XOR mapping[state].mirrorX`로 계산한다. PRSK 원본이 왼쪽을 보는 일반적인 경우 초기값은 다음 의미를 가진다.

```text
                        global    state     effective
일반 상태                 false     false       false
running-right            false     true        true
running-left             false     false       false
```

이 조합은 PRSK 원본의 왼쪽 facing을 일반 상태와 왼쪽 row의 기준으로 유지하고 오른쪽 row만 뒤집는다. 사용자는 이후 전체와 각 방향을 독립적으로 바꿀 수 있다. `mirrorX`를 단일 최종 boolean으로 덮어쓰는 대안은 전체 보정 값을 바꿀 때 좌·우 사용자 선택의 의도가 사라지므로 채택하지 않는다.

전체 반전은 rows 0–10의 캐릭터 전체에 적용한다. 다만 look rows는 단순 pixel 반전만 하면 좌·우 방향 cell의 의미가 뒤바뀐다. sampler는 수평 방향 성분을 반대로 입력하거나 좌우 look slot을 대응 교환해, 설치된 Pet에서 같은 pointer 방향을 계속 바라보도록 해야 한다. 위·아래 방향과 row/column 계약은 유지한다.

`globalMirrorX`는 UI 상태에만 두지 않고 strict recipe에 명시적으로 직렬화한다. 웹 exporter와 headless recipe renderer가 같은 합성 함수를 사용해야 하며, 누락된 기존 recipe를 허용할지 여부는 schema version 정책에 맞춰 구현 전에 결정한다. 현재 방향은 schema version을 유지하면서 누락값을 `false`로 읽고 새 recipe에는 값을 항상 쓰는 하위 호환 방식이다.

### 7. 상단 게임 탭은 단일 game source registry에서 렌더링하고 routing한다

게임 선택은 표시 문자열을 조건문으로 비교하지 않고 다음 의미를 가진 안정적인 registry entry로 정의한다.

```text
GameSourceDefinition
├── id: "prsk" | "strr" | "garupa"
├── label: "프로세카" | "레뷰 스타라이트" | "BanG Dream!"
├── status: "available" | "coming-soon"
└── integration: available 항목만 실제 builder adapter 보유
```

초기 registry는 다음과 같다.

| 순서 | 표시명 | ID | 상태 | 동작 |
|---:|---|---|---|---|
| 1 | 프로세카 | `prsk` | `available` | `livesd/prsk` integration으로 local/remote source와 build UI 제공 |
| 2 | 레뷰 스타라이트 | `strr` | `coming-soon` | `준비중`, 비활성 |
| 3 | BanG Dream! | `garupa` | `coming-soon` | `준비중`, 비활성 |

탭 UI와 builder routing은 같은 registry를 사용한다. 따라서 표시상 `프로세카`인데 다른 integration이 실행되는 불일치를 만들 수 없다. `strr`, `garupa`는 future routing key를 선점하지만 빈 구현 폴더나 가짜 loader를 만들지 않는다.

상단 탭은 기본적으로 `prsk`가 선택된 tablist로 렌더링한다. `coming-soon` 항목은 label과 `준비중` 상태를 노출하되 사용자 activation, keyboard selection, URL/resource request, 기존 PRSK 상태 폐기와 build를 유발하지 않는다. HTML `disabled` 또는 동등한 `aria-disabled` 동작을 사용하고 자동화 테스트에서는 상태와 무부작용을 함께 검증한다.

선택 가능한 게임을 향후 추가하면 App은 해당 entry의 integration boundary를 mount하고 이전 게임의 request/session을 dispose해야 한다. 현재는 PRSK만 available이므로 cross-game migration과 recipe schema 확장은 이번 구현 범위가 아니다.

### 8. PRSK resource 입력은 기본 제공 manifest 우선의 selector로 단순화한다

현재 UI는 초기 `local` mode이고 remote mode에서 사용자가 `prsk-chibi-viewer 사용`을 누른 다음 다시 `목록 불러오기`를 눌러야 한다. provider 선택과 실행이 버튼 두 개에 분산되어 있어 기본 경로가 불필요하게 길고, 개발 환경에서는 별도 mount effect가 기본 local asset을 즉시 import해 페이지 진입 자체가 resource 새로고침처럼 보인다.

새 상태 모델은 다음과 같다.

```text
PRSK resource source
├── provided (기본)
│   └── prsk-chibi-viewer manifest + 고정 asset base
├── upload (선택)
│   └── local shared skeleton + character ZIP
└── custom (선택)
    └── 사용자가 입력한 HTTPS asset base + catalog.json
```

페이지 진입 시 `provided`가 선택되어 있고 provider 설명과 요청 origin을 표시하지만 요청은 시작하지 않는다. 사용자가 `불러오기`를 누르면 현재 source가 `provided` 또는 `custom`일 때 provider를 resolve하고 catalog를 요청한다. 별도의 `prsk-chibi-viewer 사용` 버튼은 제거한다. `upload`에서는 동일 위치의 primary action이 선택한 local 파일을 검증하고 preview를 만든다.

“업로드가 선택”이라는 요구는 local 파일 입력을 제거하는 것이 아니라 기본 경로에서 대체 source로 이동한다는 의미로 적용한다. Production에서도 provided manifest가 기본이고, 사용자가 upload를 고르면 기존 `.skel`/ZIP 필수 조건과 browser-only 처리 계약을 그대로 사용한다.

페이지 mount/remount는 source 기본값과 idle 안내만 초기화하며 다음을 자동 실행하지 않는다.

- development `public/assets` 기본 모델 import
- provided/custom catalog fetch
- 이전 character의 model fetch
- preview session 생성

따라서 hard refresh나 route 재진입 뒤에도 네트워크·WebGL 작업은 명시적인 사용자 action 전까지 발생하지 않는다. Catalog 응답 또는 사용자 파일 bytes를 persistent storage에 저장해 새로고침을 숨기는 방식은 기존 privacy 경계를 바꾸므로 채택하지 않는다.

### 9. 상태별 preview와 포인터 시선은 하나의 Spine session에서 합성한다

상단 preview와 Codex Pet 상태 매핑은 별도 canvas 또는 생성된 spritesheet를 사용하지 않는다. 상태 row의 animation select가 focus되거나 값이 변경되면 현재 활성 `LiveSDPreviewSession`의 `play(animationName)`을 호출해 실제 Spine animation을 즉시 재생한다. 이렇게 하면 mapping 검증과 독립 animation picker가 동일한 skeleton, atlas, projection과 animation state를 사용한다.

preview canvas의 포인터 위치는 중심 기준 정규화 벡터로 변환하고 단위 원 안으로 제한한다. 이 벡터와 눈 이동량 slider를 export의 16방향 frame에 사용하는 동일한 pixel radius 및 world-to-local bone 변환에 전달한다. 포인터가 canvas를 벗어나거나 취소되면 target을 제거해 눈을 현재 animation pose의 원위치로 복원한다.

눈 offset은 animation state가 pose를 적용한 뒤 `eye_scale` bone에 합성한다. 다음 frame 전에 이전 offset을 제거한 후 새 pose와 target으로 다시 계산하므로 animation timeline이 eye bone을 갱신해도 누적 drift가 생기지 않는다. projection calibration은 offset 없는 pose를 기준으로 유지하며, 눈 rig이 유효하지 않으면 기존 preview 자체를 폐기하지 않고 시선 입력 오류로 처리한다.

Builder의 눈 이동량 값은 preview 전용 복사본과 export 값으로 갈라지지 않는다. 한 slider 변경이 현재 포인터 target을 즉시 다시 적용하고, package build에도 같은 canonical 값을 전달한다.

## Risks / Trade-offs

- [파일 이동으로 Git diff가 커지고 실제 동작 변경을 식별하기 어려움] → 계약 추출과 각 하위 모듈 이동을 분리하고 rename 중심으로 진행한다.
- [공용 atlas helper가 기존 PRSK 오류 의미를 잃음] → 저수준 오류와 PRSK 공개 오류의 매핑을 명시적으로 테스트한다.
- [테스트가 이전 경로를 deep import해 경계를 다시 노출함] → production과 test 파일 모두 동일한 public entrypoint 규칙을 적용한다.
- [App이 계속 PRSK 상태와 UI를 크게 소유해 완전한 feature 분리가 아님] → 이번 범위는 source 구현과 의존성 경계에 한정하고, 별도 UI container 추출은 후속 변경으로 남긴다.
- [기존 CLI renderer bundle이 stale 상태가 됨] → source build뿐 아니라 CLI renderer 재빌드와 package contents 검증을 완료 조건에 포함한다.
- [전체 pixel 반전으로 look pointer 방향 의미가 뒤바뀜] → horizontal look vector 또는 slot을 함께 변환하고 16방향 회귀 fixture로 검증한다.
- [전체·상태별 반전 조합이 UI와 CLI에서 다르게 계산됨] → XOR 합성 함수를 공유하고 네 조합의 recipe round-trip을 검증한다.
- [준비중 탭이 CSS만 비활성이고 keyboard 또는 event로 실행됨] → native/ARIA disabled 의미와 request/build 무부작용 테스트를 함께 둔다.
- [탭 label과 실제 integration routing이 별도 조건문에서 어긋남] → 하나의 registry entry가 표시와 adapter resolution을 모두 소유한다.
- [기본 provider를 선택하는 순간 외부 요청이 시작됨] → selection과 execution을 분리하고 단일 `불러오기` event만 request generation을 증가시킨다.
- [StrictMode remount 또는 route 진입으로 중복 catalog/model 요청이 발생함] → mount effect에서 resource 작업을 제거하고 action handler 단위 generation test를 둔다.
- [animation pose 위에 눈 offset이 frame마다 누적됨] → 이전 local offset을 pose 적용 전에 제거하고 animation 적용 후 다시 합성하는 session test를 둔다.
- [preview와 export가 서로 다른 시선 반경 또는 좌표 변환을 사용함] → 방향 벡터, pixel-to-world와 parent-local 변환을 범용 rendering helper로 공유한다.

## Migration Plan

1. 현재 import graph와 PRSK 전용 파일 목록을 구조 테스트의 기준으로 고정한다.
2. source 독립 `livesd/model` 계약을 만들고 adapter/export 및 PRSK producer를 전환한다.
3. local archive importer와 development fallback을 `livesd/prsk` 아래로 이동한다.
4. remote provider 전체를 `livesd/prsk/remote`로 이동하고 공개 barrel을 구성한다.
5. App, recipe renderer와 오류 정규화의 import를 공개 경계로 전환한다.
6. PRSK 전체 반전과 좌·우 상태별 반전 UI, sampler 합성과 recipe 직렬화를 추가한다.
7. game source registry와 상단 탭을 추가하고 `prsk`만 available integration으로 연결한다.
8. PRSK resource selector를 provided 기본값과 upload/custom 선택지로 바꾸고 단일 load action 및 무자동갱신 lifecycle을 적용한다.
9. 상태 매핑과 preview session 재생을 연결하고 pointer look target을 공유 eye transform으로 합성한다.
10. unit, component, E2E, build, CLI renderer와 production artifact 검증을 실행한다.

변경은 내부 TypeScript 경로 리팩터링이므로 배포 데이터 migration은 없다. 문제가 생기면 이동 커밋을 역순으로 되돌릴 수 있으며 외부 파일 형식 rollback은 필요하지 않다.

## Open Questions

- 게임별 integration mount를 명확히 하기 위해 `App.tsx`의 PRSK 전용 상태와 JSX는 `prsk` container 또는 동등한 integration component로 추출한다. STRR/Garupa container는 실제 지원 변경에서 추가한다.
