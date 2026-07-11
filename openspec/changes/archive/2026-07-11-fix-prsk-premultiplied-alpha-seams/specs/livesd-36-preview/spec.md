## ADDED Requirements

### Requirement: PRSK premultiplied-alpha preview 합성

시스템은 PRSK atlas PNG의 color channel이 이미 alpha와 곱해진 PMA source임을 보존해야 하며(MUST), alpha가 활성화되고 `premultipliedAlpha`가 활성화된 WebGL drawing buffer와 PMA Spine renderer로 attachment를 합성해야 한다(MUST). Texture upload 단계에서는 source pixel에 alpha를 다시 곱해서는 안 되며(MUST NOT), normal attachment는 `ONE, ONE_MINUS_SRC_ALPHA` 의미의 blend로 합성되어야 한다(MUST). 같은 pose는 desktop과 높은 device pixel ratio의 mobile viewport에서 attachment polygon 경계를 따라 추가 dark seam을 만들지 않아야 한다(MUST NOT).

#### Scenario: PMA texture upload와 preview draw
- **WHEN** `max(R,G,B) <= A`인 반투명 edge pixel을 가진 PRSK atlas로 preview를 만든다
- **THEN** texture upload는 pixel channel을 추가 premultiply하지 않는다
- **AND** WebGL context와 Spine renderer는 PMA 합성 mode를 사용한다

#### Scenario: Miku 앞머리 mobile 회귀
- **WHEN** `sd_21miku_miko`의 동일 animation pose를 높은 device pixel ratio의 mobile viewport에서 렌더링한다
- **THEN** 앞머리 조각 상단의 attachment 연결 경계는 기준 chibi-viewer와 같이 주변 머리색에 합성된다
- **AND** attachment polygon을 따라 별도의 어두운 border 또는 stroke가 나타나지 않는다

#### Scenario: 기존 2D draw order 보존
- **WHEN** PMA mode로 서로 겹치는 PRSK attachment를 렌더링한다
- **THEN** 시스템은 현재 `skeleton.drawOrder`를 유지한다
- **AND** depth, z-offset 또는 attachment geometry 변경으로 seam을 가리지 않는다
