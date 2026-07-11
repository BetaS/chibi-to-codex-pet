# LiveSD 프레임 샘플링 명세

## Purpose

선택된 LiveSD animation을 계산된 sample time에 렌더링하고 `192 × 208` 투명 cell로 조립한다. 모든 상태와 look frame은 같은 canonical projection을 사용해 반복 가능한 atlas를 만든다.

## Requirements

### Requirement: 명시적 animation time sampling
시스템은 선택된 source animation의 duration과 목표 frame 수로 각 sample time을 계산하고 pose를 직접 적용해야 한다(MUST). Sampling 입력은 source, mapping과 설정이며 활성 preview의 wall-clock과 화면 상태는 입력 범위에 포함되지 않는다(MUST). 같은 입력은 같은 pose 순서와 cell 배치를 만들어야 한다(MUST).

#### Scenario: 반복 가능한 sample time
- **WHEN** duration이 `D`이고 frame 수가 `N`인 animation을 export한다
- **THEN** sampler는 각 index `i`에 `D * i / N`을 사용하고 loop endpoint `D`를 별도 frame으로 중복하지 않는다

#### Scenario: preview 재생 상태 독립
- **WHEN** 사용자가 export 직전에 preview에서 다른 animation과 재생 시점을 보고 있다
- **THEN** 생성된 atlas는 preview의 현재 wall-clock pose와 관계없이 상태 매핑의 명시적 sample time을 사용한다

### Requirement: 고정 cell geometry와 공통 framing
sampler는 모든 출력 frame을 `192x208` RGBA cell로 만들어야 하며(MUST), 57개 표준 pose의 coarse render에서 실제 alpha pixel bounds를 측정해 world 좌표로 역변환해야 한다(MUST). 각 측정 bounds에는 coarse pixel 1개의 world guard를 더하고, 전체 합집합과 고정 8px inset으로 자동 안전 projection을 계산한 뒤 snapshot된 `framingScale`과 `framingOffset`을 적용해 하나의 canonical projection을 만들어야 한다(MUST). `framingScale`은 `0.80–1.50`, 기본 `1.00`, offset은 최종 cell pixel 기준 X `-96..96`, Y `-104..104`, 기본 `0,0`의 정수여야 하며(MUST), `+X`는 오른쪽, `+Y`는 아래쪽 이동이어야 한다(MUST). 최종 framing bounds의 기준은 coarse render의 가시 alpha pixel이다(MUST). 계산한 projection은 같은 export의 표준 cell과 16개 look cell에 동일하게 적용하고(MUST), 배경은 alpha 0이어야 한다(MUST).

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
- **THEN** padding을 포함한 모델 pixel이 `192x208` cell 밖으로 잘리지 않는다

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

### Requirement: sampling 2D WebGL state 격리
sampler는 depth와 stencil이 없는 WebGL context를 요청해야 하며(MUST), coarse calibration과 final render의 매 draw 직전에 depth test/write, cull, scissor, stencil 및 polygon offset state를 비활성화해야 한다(MUST). renderer는 attachment를 임의 z 값이나 이름으로 재정렬해서는 안 되며(MUST NOT), 현재 `skeleton.drawOrder`와 alpha blending만으로 layer 순서를 결정해야 한다(MUST).

#### Scenario: 오염된 sampling state 복구
- **WHEN** calibration 또는 final frame 사이에 depth test, cull, scissor 또는 stencil state가 활성화된다
- **THEN** sampler는 다음 draw 전에 2D state를 다시 적용해 clean state와 동일한 silhouette와 layer pixel을 렌더링한다

#### Scenario: 표준·look draw order 일치
- **WHEN** 동일 pose를 표준 cell과 look cell에 렌더링한다
- **THEN** 두 pass는 같은 `skeleton.drawOrder` painter order를 사용하고 depth buffer 판정으로 attachment를 누락하지 않는다

### Requirement: 상태별 frame 조립
sampler는 상태 계약의 row와 frame 수에 따라 57개 표준 상태 frame을 렌더링하고(MUST), rows 9–10에 각각 8개의 look frame을 추가해 총 73개 사용 cell을 8열×11행 atlas의 정확한 위치에 기록해야 한다(MUST). 표준 상태 cell의 최종 수평 반전은 전체 `globalMirrorX`와 해당 상태의 `mirrorX`를 XOR로 합성해야 하며(MUST), source time 순서를 바꾸어서는 안 된다(MUST NOT). 전체 반전이 활성화되어도 look rows의 16방향 의미는 설치된 Pet의 pointer 방향과 일치해야 한다(MUST).

#### Scenario: 표준 상태별 frame 수
- **WHEN** 유효한 9개 상태 매핑을 export한다
- **THEN** rows 0–8의 사용 cell 수는 6, 8, 8, 4, 5, 8, 6, 6, 6이고 합계는 57이다

#### Scenario: look frame 수
- **WHEN** 검증된 눈 rig으로 v2 look frame을 export한다
- **THEN** rows 9–10은 각각 8개 cell을 모두 사용하고 표준 frame을 포함한 전체 사용 cell 수는 73이다

#### Scenario: 전체와 상태별 반전 합성
- **WHEN** 특정 상태에 대해 `globalMirrorX`와 `mirrorX` 조합을 계산한다
- **THEN** 둘 중 정확히 하나만 활성화된 경우에만 최종 cell을 수평 반전해야 한다
- **AND** 둘 다 활성화되거나 둘 다 비활성화된 경우 최종 cell을 추가 반전하지 않아야 한다

#### Scenario: running 방향 독립 반전
- **WHEN** `running-right`와 `running-left`가 같은 source animation을 사용하지만 서로 다른 `mirrorX` 값을 가진다
- **THEN** sampler는 각 row에 전체 반전과 해당 row의 상태별 반전을 독립적으로 합성해야 한다
- **AND** 두 row 모두 source frame 순서를 유지해야 한다

#### Scenario: 전체 반전 시 look 의미 보존
- **WHEN** `globalMirrorX`가 활성화된 상태로 16개 look frame을 생성한다
- **THEN** sampler는 수평 look vector 또는 대응 slot을 보정해 각 cell이 기존과 같은 pointer 방향을 의미하게 해야 한다
- **AND** 위·아래 방향 및 rows 9–10의 16방향 index 계약을 유지해야 한다

#### Scenario: 표준 row의 미사용 cell
- **WHEN** rows 0–8의 사용 frame 수가 8보다 작다
- **THEN** 나머지 cell 전체는 RGBA 값이 0인 완전 투명 pixel로 남아야 한다

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
- **THEN** 시스템은 stable export code와 현재 locale의 message를 반환하고 부분 생성 자원을 정리한다

### Requirement: preview와 export의 시선 변환 일치
실시간 Spine preview와 16방향 look frame sampler는 동일한 눈 이동 pixel radius, projection-to-world 및 eye parent world-to-local 변환을 사용해야 한다(MUST). preview는 포인터 중심 기준 벡터와 현재 눈 이동량을 animation pose 적용 후 `eye_scale` bone에 합성해야 하며(MUST), frame 간 offset을 누적해서는 안 된다(MUST NOT). 포인터가 preview를 벗어나면 eye bone을 현재 animation pose의 원위치로 복원해야 한다(MUST).

#### Scenario: 포인터를 따른 실제 Spine 눈 이동
- **WHEN** 사용자가 활성 Spine preview 위에서 포인터를 중심에서 오른쪽 위로 이동한다
- **THEN** preview는 현재 animation을 계속 재생하면서 `eye_scale` bone을 같은 방향으로 이동해야 한다
- **AND** 이동 반경은 현재 눈 이동량 slider와 export look frame 계산을 사용해야 한다

#### Scenario: 포인터 이탈 시 복원
- **WHEN** 포인터가 preview canvas를 벗어나거나 입력이 취소된다
- **THEN** session은 이전 look offset을 제거해야 한다
- **AND** eye bone은 animation이 정의한 현재 pose로 복원되어야 한다

#### Scenario: 연속 frame에서 offset 비누적
- **WHEN** 같은 포인터 target으로 여러 animation frame을 렌더링한다
- **THEN** 각 frame은 이전 look offset을 제거한 animation pose에서 새 offset을 계산해야 한다
- **AND** 시간 경과에 따라 눈 이동량이 증가해서는 안 된다

### Requirement: PMA frame sampling과 straight RGBA export 경계

LiveSD frame sampler는 PRSK PMA texture를 PMA WebGL drawing buffer와 PMA Spine renderer로 합성해야 한다(MUST). `readPixels`로 얻은 PMA RGBA는 `ImageData`, 2D atlas canvas 또는 PNG encoder에 전달하기 전에 straight RGBA로 정확히 한 번 변환해야 하며(MUST), alpha가 0인 pixel의 RGB는 0이어야 한다(MUST). 변환은 alpha와 pixel 위치를 바꾸거나 edge color에 alpha를 두 번 곱해서는 안 된다(MUST NOT).

#### Scenario: 반투명 pixel readback 변환
- **WHEN** PMA WebGL readback pixel이 `(R, G, B, A)`이고 `0 < A < 255`이다
- **THEN** sampler는 alpha를 유지하고 각 color channel을 `clamp(round(channel * 255 / A), 0, 255)`로 straight RGBA에 기록한다

#### Scenario: 완전 투명 pixel 변환
- **WHEN** PMA WebGL readback pixel의 alpha가 0이다
- **THEN** sampler는 출력 RGB를 모두 0으로 기록한다
- **AND** 나눗셈 오류나 숨은 color byte를 생성하지 않는다

#### Scenario: 겹치는 attachment의 투명 경계
- **WHEN** 반투명 edge가 있는 서로 겹치는 attachment를 표준 및 look frame으로 생성한다
- **THEN** 생성·검증·설치된 sprite의 attachment 연결 경계는 주변 색상과 연속적으로 합성된다
- **AND** alpha bounds, 안전 여백, 점유율과 draw-order 검증을 통과한다
