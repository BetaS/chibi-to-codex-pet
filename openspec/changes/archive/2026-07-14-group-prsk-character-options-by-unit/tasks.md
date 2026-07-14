## 1. PRSK unit projection

- [x] 1.1 Canonical character token을 공식 5개 스토리 유닛, 독립 VIRTUAL SINGER와 other로 분류하는 stable unit·roster order를 구현한다.
- [x] 1.2 Locale별 unit label과 Mob·Staff·custom fallback을 `PrskRemoteCharacterGroup` section metadata에 투영하고 identity·model 값을 보존한다.

## 2. Searchable combobox group UX

- [x] 2.1 `SearchableComboboxOption`에 optional stable group metadata를 추가하고 group key·label 검색을 지원한다.
- [x] 2.2 결과가 있는 group만 non-selectable accessible heading으로 렌더링하며 option active index·pointer·keyboard commit을 보존한다.
- [x] 2.3 PRSK character option에만 unit metadata를 전달하고 section heading·nested option의 시각 스타일을 추가한다.

## 3. 회귀 검증

- [x] 3.1 공식 unit·roster 순서, VIRTUAL SINGER 독립 section, locale label과 other fallback 단위 테스트를 추가한다.
- [x] 3.2 Group 검색, heading 비선택, keyboard·pointer와 기존 flat combobox behavior의 component test를 추가한다.
- [x] 3.3 PRSK Chromium E2E에서 section 순서·검색·selection request 무결성을 검증한다.
- [x] 3.4 OpenSpec strict validation, typecheck, lint, provider harness, 관련 unit/E2E와 production build를 통과시킨다.
