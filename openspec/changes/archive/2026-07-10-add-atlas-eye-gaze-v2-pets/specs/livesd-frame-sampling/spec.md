## MODIFIED Requirements

### Requirement: 고정 cell geometry와 공통 framing
sampler는 모든 출력 frame을 `192x208` RGBA cell로 만들어야 하며(MUST), 57개 표준 상태 sample pose의 bounds 합집합과 padding으로 하나의 canonical projection을 계산해 같은 export의 표준 cell과 16개 look cell에 동일하게 적용해야 한다(MUST). 배경은 alpha 0이어야 한다(MUST).

#### Scenario: 표준 pose bounds 합집합
- **WHEN** 서로 다른 표준 상태 pose의 bounds가 다르다
- **THEN** sampler는 첫 pass의 57개 표준 pose 전체 합집합으로 canonical projection을 계산한다

#### Scenario: look projection 재사용
- **WHEN** rows 9–10의 16개 eye-offset pose를 렌더링한다
- **THEN** sampler는 rows 0–8의 크기와 위치를 변경하지 않도록 표준 pose에서 얻은 canonical projection을 look pose에도 사용한다

#### Scenario: 투명 배경
- **WHEN** WebGL frame을 RGBA cell로 readback한다
- **THEN** 모델 밖깥 pixel은 alpha 0이며 canvas 배경색이나 checkerboard가 포함되지 않는다

#### Scenario: cell 경계
- **WHEN** 표준 pose가 canonical bounds 안에 있고 look 이동이 검증된 얼굴 경계 안에 있다
- **THEN** padding을 포함한 모델 pixel이 `192x208` cell 밖으로 잘리지 않는다

### Requirement: 상태별 frame 조립
sampler는 상태 계약의 row와 frame 수에 따라 57개 표준 상태 frame을 렌더링하고(MUST), rows 9–10에 각각 8개의 look frame을 추가해 총 73개 사용 cell을 8열×11행 atlas의 정확한 위치에 기록해야 한다(MUST). `mirrorX`는 단일 표준 상태 cell의 수평 pixel 배치만 반전하고 source time 순서를 바꾸어서는 안 된다(MUST NOT).

#### Scenario: 표준 상태별 frame 수
- **WHEN** 유효한 9개 상태 매핑을 export한다
- **THEN** rows 0–8의 사용 cell 수는 6, 8, 8, 4, 5, 8, 6, 6, 6이고 합계는 57이다

#### Scenario: look frame 수
- **WHEN** 검증된 눈 rig으로 v2 look frame을 export한다
- **THEN** rows 9–10은 각각 8개 cell을 모두 사용하고 표준 frame을 포함한 전체 사용 cell 수는 73이다

#### Scenario: running-left mirror
- **WHEN** `running-left`가 `running-right` source와 `mirrorX`를 사용한다
- **THEN** 각 left cell은 같은 index의 right source pose를 수평 반전하며 frame 순서는 유지된다

#### Scenario: 표준 row의 미사용 cell
- **WHEN** rows 0–8의 사용 frame 수가 8보다 작다
- **THEN** 나머지 cell 전체는 RGBA 값이 0인 완전 투명 pixel로 남는다

### Requirement: sampling 자원 수명 주기
export sampler는 preview session과 별도의 runtime rendering 자원을 소유하고(MUST), 성공, 오류와 사용자 취소에서 image, texture, shader, batcher, atlas와 WebGL 참조를 한 번만 정리해야 한다(MUST). 73개 전체 frame에 대한 진행률과 `AbortSignal`을 지원해야 한다(MUST).

#### Scenario: 정상 완료
- **WHEN** 73개 frame과 atlas encoding이 완료된다
- **THEN** sampler는 v2 결과 Blob을 반환하고 export 전용 runtime 자원을 해제한다

#### Scenario: 사용자 취소
- **WHEN** sampling 중 전달된 signal이 abort된다
- **THEN** sampler는 후속 frame을 렌더링하지 않고 부분 결과를 노출하지 않으며 모든 소유 자원을 정리한다

#### Scenario: runtime 오류
- **WHEN** pose apply, eye rig override, WebGL draw 또는 pixel readback이 실패한다
- **THEN** 시스템은 안정적인 export 오류와 한국어 message를 반환하고 부분 생성 자원을 정리한다
