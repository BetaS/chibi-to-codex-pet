## Why

PRSK 캐릭터 selector가 canonical ID token을 영문으로 가공해 표시하므로 앱 locale과 공식 서비스의 캐릭터 표기가 일치하지 않는다. 또한 provided PRSK source의 catalog·asset origin을 UI에 직접 노출하는 행은 선택 workflow에 필요하지 않아 화면을 복잡하게 만든다.

## What Changes

- canonical PRSK 캐릭터 token을 `ko`, `en`, `ja`, `zh-CN`별 공식 캐릭터 이름으로 투영한다.
- `sd_mobNNN`과 `sd_staffNNN` leaf를 각각 `Mob`과 `Staff` 캐릭터 그룹 아래의 모델로 투영한다.
- locale 변경 시 캐릭터 selector의 visible label과 검색 대상만 즉시 갱신하고 canonical selection과 network state는 유지한다.
- 실제 PRSK Akito leaf가 locale별 공식 이름으로 투영됨을 고정하고 provider romanization alias도 canonical roster로 정규화한다.
- 공용 searchable selector popup을 clipping ancestor 밖에 렌더링하고 viewport 여유 공간에 따라 위·아래로 배치한다.
- PRSK resource panel에서 catalog/request-origin URL 표시 행을 제거하되 custom asset base URL 입력과 외부 서버 연결 고지는 유지한다.
- 공식 roster에 없는 custom·미확인 token은 기존 ID 기반 fallback label로 계속 선택할 수 있게 한다.

## Capabilities

### New Capabilities

- 없음.

### Modified Capabilities

- `catalog-character-model-selection`: 카탈로그형 provider의 캐릭터 label이 현재 locale의 공식 이름을 사용하고 locale 전환 시 selection을 보존하는 계약을 추가한다.
- `prsk-remote-resource-source`: PRSK UI의 catalog/request-origin 직접 노출을 제거하고 custom URL 입력과 외부 연결 고지 경계를 명확히 한다.

## Impact

- `src/features/livesd/prsk/remote/characterModelCatalog.ts`의 PRSK 캐릭터 label projection과 관련 테스트가 변경된다.
- `src/features/livesd/ui/SearchableCombobox.tsx`가 viewport-aware popup layer를 사용한다.
- `src/features/livesd/prsk/PrskIntegration.tsx`가 locale을 projection에 전달하고 request-origin 표시 행을 렌더링하지 않게 된다.
- PRSK UI 통합 테스트와 두 main capability의 delta spec이 갱신된다.
