## MODIFIED Requirements

### Requirement: 고정 cell geometry와 공통 framing
sampler는 모든 출력 frame을 `192x208` RGBA cell로 만들어야 하며(MUST), raw 57-pose geometry 합집합의 coarse projection으로 57개 표준 상태를 먼저 렌더링하고 실제 alpha pixel bounds를 world 좌표로 역변환해야 한다(MUST). sampler는 각 측정 bounds에 coarse pixel 1개의 world guard를 더한 합집합과 고정 8px inset으로 자동 안전 projection을 계산한 뒤 snapshot된 `framingScale`과 `framingOffset`을 적용해 하나의 canonical projection을 만들어야 한다(MUST). `framingScale`은 `0.80–1.50`, 기본 `1.00`, offset은 최종 cell pixel 기준 X `-96..96`, Y `-104..104`, 기본 `0,0`의 정수여야 하며(MUST), `+X`는 오른쪽, `+Y`는 아래쪽 이동이어야 한다(MUST). texture가 투명한 attachment를 포함하는 raw `Skeleton.getBounds()`를 최종 framing 근거로 사용해서는 안 된다(MUST NOT). 계산한 projection은 같은 export의 표준 cell과 16개 look cell에 동일하게 적용하고(MUST), 배경은 alpha 0이어야 한다(MUST).

#### Scenario: 표준 pose 실제 alpha bounds 합집합
- **WHEN** 서로 다른 표준 상태 pose의 bounds가 다르다
- **THEN** sampler는 57개 전체의 pixel-edge world bounds와 1px guard 합집합을 고정 8px inset에 맞춘 뒤 선택한 scale과 offset으로 canonical projection을 계산한다

#### Scenario: 투명 texture placeholder 제외
- **WHEN** 표준 pose에 world geometry는 크지만 실제 texture pixel이 완전 투명한 Region 또는 Mesh attachment가 있다
- **THEN** sampler는 coarse render의 alpha bounds에 나타나지 않는 해당 geometry를 final canonical bounds에서 제외한다

#### Scenario: calibration pixel 역변환
- **WHEN** top-down coarse RGBA에서 inclusive alpha bbox를 world 좌표로 환산한다
- **THEN** sampler는 오른쪽·아래 pixel edge의 `+1`과 WebGL Y축 반전을 반영하고 좌표를 반올림하지 않는다

#### Scenario: 빈 calibration frame
- **WHEN** 57개 표준 사용 frame 중 하나의 coarse render alpha가 모두 0이다
- **THEN** sampler는 해당 state와 frame을 포함한 `FRAME_BOUNDS_FAILED`로 중단한다

#### Scenario: look projection 재사용
- **WHEN** rows 9–10의 16개 eye-offset pose를 렌더링한다
- **THEN** sampler는 rows 0–8의 크기와 위치를 변경하지 않도록 표준 pose에서 얻은 canonical projection을 look pose에도 사용한다

#### Scenario: 투명 배경
- **WHEN** WebGL frame을 RGBA cell로 readback한다
- **THEN** 모델 바깥 pixel은 alpha 0이며 canvas 배경색이나 checkerboard가 포함되지 않는다

#### Scenario: 기본 framing의 cell 경계
- **WHEN** scale이 100%, offset이 `0,0`이고 표준 pose가 canonical bounds 안에 있다
- **THEN** padding을 포함한 모델 pixel은 `192x208` cell 밖으로 잘리지 않는다

#### Scenario: custom framing의 의도적 crop
- **WHEN** scale이 100%를 넘거나 offset이 0이 아니어서 alpha가 cell edge에 닿는다
- **THEN** sampler는 cell 밖 pixel을 투명 출력 경계로 crop하고 같은 crop을 표준 57개와 look 16개에 적용한다

#### Scenario: 결정적인 framing
- **WHEN** 같은 source, 상태 매핑, metadata, scale, offset과 눈 이동 배율로 export를 반복한다
- **THEN** sampler는 같은 canonical projection과 cell-local alpha bounds를 생성한다

#### Scenario: 150% 공통 배율
- **WHEN** 같은 입력을 `framingScale: 1.50`으로 export한다
- **THEN** sampler는 100% 대비 projection width와 height를 2/3로 만들고 가시 sprite를 약 1.5배로 렌더링하며 같은 projection을 표준 57개와 look 16개에 적용한다

#### Scenario: offset projection
- **WHEN** sampling input이 offset X `12`, Y `8`을 포함한다
- **THEN** 100% offset `0,0` 결과 대비 모든 cell의 sprite가 오른쪽 12px, 아래쪽 8px 이동한다

#### Scenario: 잘못된 sampling framing
- **WHEN** sampling input이 범위 밖, 비정수 또는 유한하지 않은 scale·offset을 포함한다
- **THEN** sampler는 WebGL 자원을 만들기 전에 `FRAMING_SCALE_INVALID` 또는 `FRAMING_OFFSET_INVALID`로 거부한다

#### Scenario: 잘못된 눈 이동 배율
- **WHEN** sampling input이 0.50 미만, 1.50 초과 또는 유한하지 않은 `lookMovementScale`을 포함한다
- **THEN** sampler는 WebGL 자원을 만들기 전에 `LOOK_MOVEMENT_SCALE_INVALID`로 거부한다
