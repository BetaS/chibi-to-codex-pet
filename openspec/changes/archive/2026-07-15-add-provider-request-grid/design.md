## Context

`AppContent`는 `GAME_SOURCES`를 하나의 ARIA tablist로 렌더링하고 CSS에서 정확히 3열을 지정한다. 현재 registry에는 세 provider가 있지만 향후 항목이 추가되면 열 수와 줄바꿈 정책이 코드·명세에 없으며, 게임 지원 요청은 앱에서 GitHub Issue 작성 화면으로 이동할 수 없다.

지원 요청은 provider 선택이 아니라 외부 repository action이다. 따라서 keyboard와 보조 기술이 이를 tab으로 해석하거나 현재 tabpanel routing에 포함해서는 안 된다. Grid는 registry 항목 수에 맞춰 현재 폭을 채우면서도 한 행에 네 개를 초과하지 않아야 한다.

## Goals / Non-Goals

**Goals:**

- Provider tab을 desktop에서 현재 항목 수에 맞는 1–4열 grid로 표시하고 이후 항목을 다음 행으로 배치한다.
- 좁은 화면에서 2열, mobile에서 1열로 줄여 label과 상태의 가독성을 유지한다.
- 모든 provider 선택 상태에서 tablist 하단에 locale별 새 게임 지원 요청 링크를 제공한다.
- 외부 링크와 game tab의 semantic·routing 경계를 자동 test로 고정한다.

**Non-Goals:**

- GitHub Issue를 앱 내부에서 작성하거나 GitHub API·인증을 사용하지 않는다.
- Issue template, query parameter, label 또는 사용자 입력을 자동으로 추가하지 않는다.
- Game source registry ID, 순서, 지원 상태나 integration lifecycle을 변경하지 않는다.

## Decisions

### 지원 요청은 tablist 다음의 독립 anchor로 렌더링한다

`AppContent`의 navigation 안에서 `role="tablist"`가 끝난 직후 `https://github.com/BetaS/chibi-to-codex-pet/issues/new` anchor를 렌더링한다. Link는 `target="_blank"`와 `rel="noreferrer"`를 사용하고 locale별 visible label과 새 browsing context를 알리는 accessible name을 가진다. Tab role이나 `aria-controls`를 부여하지 않으므로 활성 provider와 tabpanel state를 변경하지 않는다.

지원 요청을 disabled 또는 pseudo game tab으로 registry에 추가하는 대안은 selection model과 외부 navigation을 혼합하고 available provider count를 왜곡하므로 채택하지 않는다. JavaScript `window.open()` 대신 native anchor를 사용해 링크 의미, keyboard activation과 browser 새 창 정책을 유지한다.

### Registry 길이를 1–4 범위의 CSS grid column 값으로 전달한다

순수 helper는 provider 수를 최소 1, 최대 4로 clamp한다. `AppContent`는 결과를 tablist의 `--game-source-columns` custom property로 전달하고 CSS는 `repeat(var(--game-source-columns), minmax(0, 1fr))`를 사용한다. Provider가 다섯 개 이상이면 CSS grid의 자동 placement가 다음 행을 만든다. `max-width: 58rem`에서는 2열, `max-width: 36rem`에서는 1열로 property 기반 desktop 값을 덮어쓴다.

항상 4열을 선언하는 대안은 현재 세 provider에서 빈 cell을 만들고 탭 폭을 불필요하게 줄인다. `auto-fit`만 사용하는 대안은 viewport와 label 길이에 따라 한 행에 다섯 개 이상이 들어갈 수 있어 명시적 상한을 보장하지 못하므로 채택하지 않는다.

### Markup, column cap과 locale catalog를 단위 test로 검증한다

App test는 지원 링크가 navigation의 마지막 요소이면서 tablist 밖의 link인지, 정확한 URL·새 창·관계 속성과 locale accessible name을 가지는지 확인한다. Grid helper는 provider 수가 네 개를 넘을 때도 4를 반환하는지 검증하고 현재 tablist custom property가 registry 길이를 반영하는지 확인한다. 기존 tab 전환 test는 외부 링크 추가 뒤에도 provider routing이 유지되는지 계속 검증한다.

## Risks / Trade-offs

- [새 창 링크가 tab으로 오인될 수 있음] → tablist 밖의 native anchor와 명시적인 accessible name을 사용하고 role·DOM 경계를 test한다.
- [Inline column 수가 mobile media query를 이길 수 있음] → `grid-template-columns` 자체가 아니라 CSS custom property만 inline으로 전달하고 media query에서 실제 property를 override한다.
- [향후 provider 수가 증가해 첫 행과 마지막 행의 폭이 달라 보일 수 있음] → 모든 행이 같은 최대 4열 track을 사용해 위치를 안정적으로 유지한다.

## Migration Plan

Data migration은 없다. App markup, locale catalog와 CSS를 함께 배포한다. Rollback은 지원 link와 custom property를 제거하고 기존 3열 rule로 되돌리면 되며 provider state에는 영향이 없다.

## Open Questions

없음.
