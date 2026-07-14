## Why

Pet을 완성한 사용자가 프로젝트를 유용하게 느낀 직후 GitHub Star로 가볍게 응원할 수 있는 경로가 없다. 다운로드 흐름을 방해하지 않는 간단한 안내를 제공해 저장소 참여로 자연스럽게 연결한다.

## What Changes

- 검증된 Codex Pet ZIP 다운로드 링크를 처음 누른 직후 GitHub Star 안내 모달을 표시한다.
- 모달에서 저장소로 이동하거나 안내를 닫을 수 있게 한다.
- 같은 빌더 작업 세션에서는 안내를 한 번만 표시하고 다운로드 및 앱 사용은 계속 허용한다.
- 현재 앱의 시각 언어를 따르는 절제된 반응형 스타일과 키보드·스크린 리더 접근성을 제공한다.
- 지원 언어 전체에 안내 문구를 제공한다.

## Capabilities

### New Capabilities

- `github-star-prompt`: Pet ZIP 다운로드 이후 표시되는 비차단형 GitHub Star 안내의 동작과 접근성 계약

### Modified Capabilities

- 없음.

## Impact

- `CodexPetBuilder`의 다운로드 클릭 처리와 상태가 변경된다.
- 재사용 가능한 Star 안내 UI, 다국어 메시지, CSS 및 컴포넌트 테스트가 추가된다.
- 외부 GitHub API나 신규 런타임 의존성은 추가하지 않으며 공개 Star 수는 조회하지 않는다.
