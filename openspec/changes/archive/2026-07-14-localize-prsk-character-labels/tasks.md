## 1. PRSK 공식 캐릭터 이름 projection

- [x] 1.1 26개 canonical PRSK character token의 `ko`, `en`, `ja`, `zh-CN` 공식 이름 map과 unknown token fallback을 구현한다.
- [x] 1.2 PRSK catalog grouping과 preset 복원 경로에 현재 locale을 전달해 stable canonical selection을 유지하며 visible label을 갱신한다.
- [x] 1.3 `sd_mob<digits>`와 `sd_staff<digits>`를 각각 stable character group으로 묶고 leaf 번호 또는 provider label을 모델 선택으로 투영한다.
- [x] 1.4 실제 `11akito` leaf와 provider romanization alias를 canonical roster로 정규화하고 raw Akito label 회귀를 막는다.

## 2. PRSK resource URL 노출 정리

- [x] 2.1 PRSK resource panel의 catalog/request-origin 표시 행과 사용하지 않는 계산·message를 제거하고 custom URL input과 외부 연결 고지를 유지한다.

## 3. 회귀 검증

- [x] 3.1 네 locale 공식 이름, 기본 Pet 이름, unknown fallback과 immutable projection 단위 테스트를 추가한다.
- [x] 3.2 PRSK 통합 테스트에서 URL 비노출과 locale 전환 시 selection·preview·request 보존을 검증한다.
- [x] 3.3 OpenSpec strict validation, typecheck, lint와 관련 unit test를 통과시킨다.
- [x] 3.4 mob·staff 분리, singleton fallback, preset lookup과 character/model selector 흐름의 회귀 테스트를 통과시킨다.
- [x] 3.5 공용 `SearchableCombobox` popup을 body portal에 렌더링하고 viewport 하단에서 위로 flip·clamp한다.
- [x] 3.6 Akito 실제 ID, popup clipping·scroll 재배치, OpenSpec strict validation, typecheck, lint와 관련 테스트를 통과시킨다.
