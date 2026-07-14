## MODIFIED Requirements

### Requirement: 고정 캐릭터와 모델 이중 catalog

Pinned source UI는 사용자가 명시적으로 캐릭터 목록 불러오기를 실행한 generation에서만 manifest에 고정된 `_info.json`과 `characters.all.5.json`을 size·SHA-256 검증과 함께 요청해야 한다(MUST). 시스템은 `_info.json`에 실제 buildData가 존재하는 bundle만 model option으로 만들고(MUST), character metadata의 `sdAssetBundleName`을 locale별 `characterName`과 조인해야 한다(MUST). 시스템은 provider metadata에서 `characterType === "unique"`인 항목을 고유 캐릭터로, 하나 이상의 후보가 모두 non-`unique`인 항목을 Mob으로 분류해야 한다(MUST). UI는 고유 캐릭터와 하나의 `Mob` group을 첫 번째 searchable combobox로 표시하고, 선택된 group에 귀속된 bundle만 두 번째 model combobox에 원본 bundle ID로 표시해야 한다(MUST). Exact character가 하나로 결정되지 않는 공유 bundle은 이름을 추측해서는 안 되고(MUST NOT), 후보가 모두 non-`unique`라면 개별 이름 없이 단일 `Mob` group에 포함해야 한다(MUST). Exact 후보가 없을 때 underscore 앞 base bundle이 정확히 한 primary character로 결정되는 경우에만 같은 이름을 상속할 수 있다(MAY). 여러 고유 캐릭터가 충돌하거나 이름·종류를 안전하게 결정할 수 없는 bundle은 별도 미매핑 character group에서 원본 bundle ID로 검색·선택할 수 있어야 한다(MUST).

#### Scenario: 대표 캐릭터명 매핑
- **WHEN** 검증된 catalog에서 bundle `00001`을 표시한다
- **THEN** 첫 combobox는 현재 locale의 토야마 카스미를 표시하고 두 번째 model combobox에 `00001`을 표시하며 model 선택값은 내부적으로 `00001`을 유지한다
- **AND** model load가 성공하면 Pet 기본 이름은 `00001 - 토야마 카스미`이고 전체 캐릭터 수평 반전은 꺼진 상태여야 한다

#### Scenario: 단일 Mob group
- **WHEN** 서로 다른 non-`unique` character ID에 연결된 bundle과 여러 non-`unique` 후보가 공유하는 bundle이 catalog에 함께 존재한다
- **THEN** 첫 combobox에는 `Mob` option이 정확히 하나만 표시되고 해당 option의 두 번째 combobox에는 모든 원본 bundle ID가 model option으로 표시된다
- **AND** model 선택과 catalog 재조회 뒤 복원은 선택한 원본 bundle ID와 `Mob` group identity를 유지한다

#### Scenario: 공유 또는 미매핑 bundle
- **WHEN** 한 bundle이 여러 고유 캐릭터에 연결되거나 character metadata에 대응값이 없다
- **THEN** option은 임의 character 또는 Mob을 선택하지 않고 별도 미매핑 group 안에서 원본 bundle ID로 검색·선택할 수 있다

#### Scenario: 명시적 2단계 요청
- **WHEN** 사용자가 pinned source를 선택했지만 캐릭터 목록 불러오기를 실행하지 않았다
- **THEN** catalog와 model request는 모두 0건이고 두 combobox는 비활성이다
- **WHEN** 사용자가 목록을 불러와 캐릭터 option을 선택한다
- **THEN** catalog request만 발생하고 model asset request는 0건이다
- **WHEN** 사용자가 두 번째 combobox에서 model을 선택한다
- **THEN** 별도 버튼 없이 해당 model asset request와 preview load가 즉시 시작된다

#### Scenario: preset과 새 세션의 catalog action gate
- **WHEN** 저장 Garupa preset이 대기 선택인 상태다
- **THEN** `프리셋 불러오기`는 활성이고 캐릭터 목록 불러오기는 비활성이어야 한다
- **WHEN** 사용자가 `새 세션`을 선택한다
- **THEN** `프리셋 불러오기`는 비활성이고 캐릭터 목록 불러오기는 다시 활성화되어야 한다
