## Context

PRSK preview toolbar는 스켈레톤의 실제 animation을 검색·재생하고, `CodexPetBuilder`는 9개 상태의 현재 mapping을 소유한다. 상태 select focus와 변경은 이미 builder callback을 통해 같은 활성 Spine session을 재생하지만, preview toolbar는 현재 mapping을 알지 못해 명시적인 상태 바로가기를 제공할 수 없다.

## Goals / Non-Goals

**Goals:**

- preview toolbar에서 9개 Codex Pet 상태를 고정 순서의 아이콘 button으로 제공한다.
- 각 button이 builder의 최신 mapping을 사용해 같은 활성 Spine session을 즉시 재생한다.
- 직접 animation 검색과 상태 바로가기의 현재 선택을 구분하고 다국어 접근성을 제공한다.
- shortcut interaction이 mapping, mirror, metadata, package 결과, export 또는 network를 변경하지 않게 한다.

**Non-Goals:**

- 새 preview renderer, spritesheet 또는 별도 상태 animation을 만들지 않는다.
- shortcut에서 mapping이나 mirror를 편집하지 않는다.
- Codex Pet 9개 표준 상태 ID·row·순서 또는 추천 알고리즘을 변경하지 않는다.

## Decisions

### Builder mapping은 소유권을 유지하고 read-only snapshot만 상위로 알린다

`CodexPetBuilder`에 `onMappingsChange` callback을 추가해 초기 추천과 사용자 수정 뒤의 mapping을 `PrskIntegration`에 알린다. mapping을 완전히 상위로 lift하면 builder의 source-key reset과 export 상태까지 controlled state로 바꿔야 하므로 변경 범위가 커진다. read-only snapshot은 기존 단일 소유권을 보존하면서 preview toolbar가 최신 animation 이름만 소비하게 한다.

### 상태 바로가기는 preview toolbar의 별도 접근 가능한 group으로 렌더링한다

`CodexPetStateShortcuts`는 `CODEX_PET_STATES` 순서, 고정 glyph icon, 현재 locale의 상태 copy와 현재 선택 ID를 입력으로 받는다. button은 native keyboard activation, localized `aria-label`·`title`, `aria-pressed`를 제공한다. 텍스트 mapping editor 안에만 action을 두는 대안은 사용자가 preview를 보면서 상태를 빠르게 비교하려는 목적을 충족하지 못한다.

### 직접 animation과 상태 preview mode를 명시적으로 구분한다

shortcut 또는 mapping row focus·변경은 해당 state ID를 현재 선택으로 설정한다. 직접 animation combobox에서 이름을 선택하면 state 선택을 해제하고 animation 이름만 재생한다. 두 경로는 모두 기존 `LiveSDPreviewSession.play()`를 사용하며 새 request나 session을 만들지 않는다.

### source lifecycle에 맞춰 snapshot과 선택을 초기화한다

active source가 사라지거나 교체되면 상위의 mapping snapshot과 선택 state를 먼저 비운다. 새 builder가 추천 mapping을 알리면 shortcut이 다시 활성화된다. locale 변경은 source identity를 바꾸지 않으므로 mapping과 선택을 유지한다.

### 모바일 toolbar는 단일 column 흐름과 3×3 shortcut grid를 사용한다

36rem 이하에서는 toolbar의 `flex-direction`이 column으로 바뀌므로 desktop의 `flex-wrap`과 shortcut `flex-basis: 100%`를 그대로 유지하지 않는다. 모바일에서는 toolbar wrapping을 끄고 shortcut을 `width: 100%`인 intrinsic-height item으로 재설정한다. 내부 grid는 `repeat(3, minmax(0, 1fr))`를 사용해 긴 locale이나 좁은 viewport에서도 패널 content box 밖으로 열이 확장되지 않게 한다.

## Risks / Trade-offs

- [Risk] builder effect와 source 교체 순서 사이에 이전 shortcut이 잠시 남을 수 있다. → active source identity 변경 effect에서 mapping과 선택을 즉시 초기화한다.
- [Risk] glyph icon만으로 상태 의미가 모호할 수 있다. → localized tooltip과 accessible name을 필수로 제공하고 선택 상태를 시각·programmatic하게 표시한다.
- [Risk] 직접 선택한 animation이 우연히 특정 state mapping과 같아도 state가 선택된 것으로 오해될 수 있다. → 직접 combobox 경로는 항상 state 선택을 해제한다.
- [Risk] desktop의 row wrapping 규칙을 column toolbar에 그대로 적용하면 shortcut이 오른쪽의 새 flex column으로 밀릴 수 있다. → 모바일 breakpoint에서 `flex-wrap: nowrap`, shortcut의 flex basis와 width를 명시하고 실제 390px viewport에서 containment를 검증한다.

## Migration Plan

새 callback은 optional로 추가해 기존 builder 소비자와 테스트 호환성을 유지한다. 배포 후 문제가 있으면 shortcut component와 callback 연결만 제거해 기존 직접 animation 및 mapping focus preview로 되돌릴 수 있다.

## Open Questions

없음.
