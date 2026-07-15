## Why

Garupa의 pinned remote source는 browser에서 재현 가능한 source identity를 보존하지만 CLI recipe에서 제외되어 Pet 생성 뒤 설치 명령이 사라진다. 또한 기존 GitHub Star 명세는 ZIP 다운로드 뒤 modal만 정의해 사용자가 기대한 상단의 항상 보이는 저장소 진입점이 없고, Pet을 생성하고도 다운로드하지 않으면 contextual 안내를 볼 수 없다.

## What Changes

- `garupa-pinned`을 strict Codex Pet recipe source로 추가하고 안전한 `sdAssetBundleName`만 직렬화한다.
- Garupa pinned build가 검증되면 PRSK·STRR와 같은 `npx -y chibi-to-codex-pet install --recipe <recipe>` 명령과 복사 action을 표시한다. Local ZIP source는 재현 가능한 remote identity가 없으므로 명령을 표시하지 않는다.
- CLI headless renderer가 동일한 frozen Garupa manifest와 acquisition adapter, LiveSD (Spine 4.0) sampler로 recipe를 재현하게 한다.
- Available provider registry가 지원하는 recipe provider를 선언하고 development harness가 누락·미지원 provider ID를 거부해 새 provider의 CLI capability drift를 막는다.
- 앱 header에 locale별 GitHub Star 인디케이터를 항상 표시하고 repository를 native anchor의 새 탭으로 연다.
- 상단 Star 인디케이터는 외부 widget, 추적 script, GitHub API 또는 mount 시 network request를 사용하지 않는다.
- Star modal은 검증된 Pet 생성 완료 직후 같은 빌더 세션에서 한 번만 표시하고, 다운로드 클릭은 기존 ZIP 동작과 분석 이벤트만 담당한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `npx-pet-installation`: Garupa pinned recipe와 runtime routing, available provider의 재현 가능한 remote CLI surface 및 registry harness 계약을 추가한다.
- `github-star-prompt`: Pet 생성 완료 직후 한 번 표시되는 modal과 header에서 항상 접근 가능한 Star 인디케이터 계약을 추가한다.

## Impact

- Shared recipe schema·parser, settings preset source type와 CLI recipe renderer runtime routing이 변경된다.
- Garupa integration이 active pinned source를 공통 builder의 `recipeSource`로 전달하고 provider registry·harness에 recipe metadata가 추가된다.
- `AppContent`, 지원 locale message, header style과 App·builder·Star modal·recipe·renderer·Garupa·harness test가 변경된다.
- CLI renderer bundle을 다시 생성하지만 provider API response나 skeleton·atlas·texture·ZIP asset은 repository와 package에 추가하지 않는다.
- 기존 recipe schema version, `livesd36-codex-pet@1` protocol token, PRSK·STRR command, CLI filesystem install과 외부 dependency는 변경하지 않는다.
