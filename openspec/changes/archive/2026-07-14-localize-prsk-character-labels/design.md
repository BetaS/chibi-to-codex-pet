## Context

PRSK provided catalog은 `sd_<character-token>_<model-suffix>` ID만 신뢰 가능한 character identity로 제공하며, 현재 projection은 token을 단순 humanize해 모든 locale에서 같은 영문 label을 만든다. 앱은 `ko`, `en`, `ja`, `zh-CN`을 지원하고 canonical selection과 preset identity는 visible label이 아니라 ID에 이미 귀속되어 있다. `PrskRemoteCatalog`의 request origin은 URL 검증과 model request에 필요하지만 제품 UI에 직접 표시할 필요는 없다.

## Goals / Non-Goals

**Goals:**

- 알려진 26개 PRSK canonical character token을 네 app locale의 공식 이름으로 표시한다.
- 번호형 `mob`과 `staff` leaf를 각각 하나의 stable family group으로 묶고 번호를 모델 선택으로 제공한다.
- 실제 provider ordinal token과 romanization alias를 canonical roster token으로 정규화한다.
- selector가 스크롤·viewport 경계나 overflow container 안에서도 popup 전체를 탐색할 수 있게 한다.
- locale 변경 시 label과 검색 결과만 다시 계산하고 캐릭터·모델 선택, preview, request generation을 유지한다.
- 공식 roster 밖의 유효한 leaf를 기존 fallback label로 보존한다.
- provided/custom PRSK resource panel의 별도 request-origin 표시 행을 제거하면서 custom URL 입력과 외부 연결 고지를 유지한다.
- 공식 이름 표는 사람이 검토 가능한 source code metadata로만 두고 provider API 응답이나 asset snapshot을 저장하지 않는다.

**Non-Goals:**

- 모델·의상 suffix의 번역이나 provider catalog 응답 자체의 변경은 범위에 포함하지 않는다.
- 개별 mob·staff 또는 custom character identity의 고유 이름을 추측하지 않는다.
- `PrskRemoteCatalog` 내부 provenance와 URL 보안 검증을 제거하지 않는다.

## Decisions

### canonical token 기반 정적 locale map

숫자 ordinal을 제거하고 소문자로 정규화한 character token을 26개 공식 roster map에서 찾는다. 각 entry는 `ko`, `en`, `ja`, `zh-CN` 네 label을 모두 가져 compile-time 누락을 막는다. Provider catalog에서 추가 API나 localization payload를 요청하는 방식은 응답 drift와 repository boundary 위험이 있어 사용하지 않는다.

### projection 함수에 locale을 명시적으로 전달

`groupPrskRemoteCharacterModels`가 `AppLocale`을 입력받아 group label과 기본 Pet 이름을 계산한다. React `useMemo`는 locale을 dependency로 사용하므로 locale 전환은 stable character key를 유지한 채 visible option만 재계산한다. 전역 mutable locale이나 번역 message key에 캐릭터 roster를 섞는 대안은 pure projection 테스트와 provider 경계를 약화하므로 사용하지 않는다.

### 알 수 없는 token의 기존 fallback 보존

공식 map에 없는 canonical token과 singleton leaf는 기존 `humanizeToken` 결과를 사용한다. 이 방식은 custom provider와 향후 catalog 확장을 차단하지 않으며 캐릭터를 임의의 공식 인물로 오인하지 않는다.

### 번호형 mob과 staff family의 명시적 그룹

검증된 leaf ID가 정확히 `sd_mob<digits>` 또는 `sd_staff<digits>` 형식이면 각각 stable key `character:mob`, `character:staff`로 묶는다. 캐릭터 selector는 `Mob`, `Staff`를 표시하고 모델 selector는 family prefix를 제외한 번호를 표시한다. Provider가 ID와 다른 label을 제공하면 그 label은 모델 label로 보존한다. 다른 `sd_*` singleton을 family로 추측하거나 canonical model ID를 변경하지 않는다.

### 실제 provider token과 canonical roster alias 분리

숫자 ordinal을 제거한 provider token은 canonical roster key 또는 명시적 alias를 통해 locale map으로 해석한다. 실제 Akito token `11akito`는 canonical `akito`로, provider가 사용하는 `touya`는 roster key `toya`로 정규화한다. Visible label만 canonical map에서 가져오며 source model ID와 preset identity는 원문을 유지한다.

### popup은 body portal에서 viewport-aware 배치

공용 `SearchableCombobox` listbox는 component ancestor의 `overflow`에 잘리지 않도록 `document.body` portal에 fixed layer로 렌더링한다. 열릴 때 input rect와 viewport 위·아래 여유 공간을 계산해 더 안전한 방향을 선택하고, 선택한 공간으로 max-height를 제한한다. Capture scroll과 resize 중 위치를 다시 계산하며 기존 ARIA ownership, keyboard highlight, commit semantics는 유지한다.

### request provenance는 내부 유지, UI URL 행만 제거

`requestOrigins`, canonical viewer URL과 asset base는 loader의 검증·요청 계약에 남긴다. UI에서는 별도 `remote-origin` 행을 렌더링하지 않고 custom source의 필수 asset URL input과 외부 서버 연결 warning만 표시한다. URL을 DTO에서 제거하는 대안은 security validation과 진단 정보를 손상하므로 사용하지 않는다.

## Risks / Trade-offs

- [공식 서비스가 표기를 변경할 수 있음] → locale map을 한 파일과 단위 테스트에 집중시키고 공식 페이지 링크를 근거로 유지한다.
- [새 canonical character가 fallback 영문으로 보일 수 있음] → 알 수 없는 identity를 안전하게 보존하며 roster 추가 시 네 locale을 동시에 요구하는 타입과 테스트로 갱신한다.
- [향후 유사한 NPC prefix가 추가될 수 있음] → 현재 확인된 정확한 `mob`·`staff` 번호 패턴만 묶고 나머지는 기존 singleton fallback으로 보존한다.
- [portal popup이 input과 분리되어 보일 수 있음] → input 너비와 viewport 좌표를 동기화하고 scroll·resize 시 즉시 재배치한다.
- [URL 비노출로 연결 대상의 세부 투명성이 줄어듦] → 외부 서버 연결 warning과 사용자가 직접 입력하는 custom URL은 유지하고, 요청 policy와 provenance는 내부 계약으로 검증한다.

## Migration Plan

Persistent schema 변경은 없다. 배포 시 projection과 UI를 함께 교체하며, rollback은 locale argument와 URL 행 렌더링을 이전 구현으로 되돌리면 된다.

## Open Questions

없음.
