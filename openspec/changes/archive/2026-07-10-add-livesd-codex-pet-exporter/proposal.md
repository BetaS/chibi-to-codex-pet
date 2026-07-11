## Why

현재 앱은 선택한 LiveSD 캐릭터를 미리보고 단일 애니메이션을 재생할 수 있지만, Codex Pet이 사용하는 상태별 애니메이션으로 구성하거나 설치 가능한 패키지로 내보낼 수 없다. 브라우저 안에서 선택한 리소스를 그대로 상태 매핑·프레임 샘플링·패키징해 실제 Codex 앱에서 검증할 수 있는 완결된 변환 경로가 필요하다.

## What Changes

- 현재 스켈레톤의 애니메이션 이름을 분석해 Codex Pet의 `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review` 상태에 기본 애니메이션을 자동 추천한다.
- 사용자가 모든 상태 매핑을 확인하고 현재 스켈레톤에 존재하는 다른 애니메이션으로 변경할 수 있는 웹 UI를 추가한다.
- 선택한 LiveSD 모델을 고정된 `192x208` 셀로 결정론적으로 샘플링하고, 상태별 필수 프레임 수와 투명한 미사용 셀을 가진 Codex Pet 스프라이트 시트를 생성한다.
- LiveSD가 제공하는 9개 명명 상태만 source animation으로 충실하게 표현하기 위해 `spriteVersionNumber: 1`의 `pet.json`과 `1536x1872` PNG 스프라이트 시트를 단일 캐릭터 디렉터리에 넣은 설치용 ZIP을 브라우저에서 생성·다운로드한다. v2의 포인터 시선 방향 16셀은 이번 범위에 포함하지 않는다.
- 생성된 ZIP을 다시 읽어 manifest, 경로, 크기, 셀 점유와 투명도를 검증하고 웹에서 Codex Pet 상태 렌더링을 미리 확인할 수 있게 한다.
- gitignore된 로컬 `assets/prsk/sd_07airi_normal` 리소스를 사용하는 단위·통합·Playwright 시나리오를 추가해 실제 ZIP 다운로드, 임시 Codex pets 디렉터리 설치, manifest 로드와 상태 렌더링을 검증한다.

## Capabilities

### New Capabilities

- `codex-pet-animation-mapping`: LiveSD 애니메이션 목록을 Codex Pet 상태에 자동 추천하고 사용자가 유효한 매핑으로 조정하는 계약
- `livesd-frame-sampling`: LiveSD runtime pose를 9개 상태별 고정 셀의 투명 raster frame으로 샘플링하는 계약
- `codex-pet-package-export`: v1 atlas와 manifest를 검증 가능한 설치용 ZIP으로 만들고 다운로드·재설치·렌더링하는 계약

### Modified Capabilities

- `livesd-36-preview`: ready 모델의 runtime 독립 입력을 상태 매핑 및 frame sampling 단계에 안전하게 전달하고 source 교체 시 함께 갱신하는 계약

## Impact

- `src/features/livesd/adapter`에 export 전용 pose sampling 경계와 자원 정리를 추가한다.
- `src/features/codex-pet`에 상태 계약, 매핑 추천, atlas 조립, manifest/ZIP exporter 및 package validator를 추가한다.
- `src/App.tsx`와 `src/styles.css`에 상태 매핑·metadata·생성·설치 미리보기 UI를 통합한다.
- `@zip.js/zip.js`, Canvas 2D, WebGL과 기존 고정 Spine 3.6 runtime을 재사용하며 새 runtime 의존성이나 서버 업로드는 추가하지 않는다.
- Vitest와 Playwright 테스트가 로컬 실제 PRSK 자산이 있을 때 `sd_07airi_normal` end-to-end 변환을 검증하고, production build에는 원본 모델이나 생성된 pet을 포함하지 않는다.
