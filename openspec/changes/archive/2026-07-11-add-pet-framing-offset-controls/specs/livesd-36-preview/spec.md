## MODIFIED Requirements

### Requirement: 사용자 조절 가능한 Pet framing 미리보기
ready WebGL preview는 최종 `192×208` cell과 같은 aspect ratio의 visible border box를 표시해야 하며(MUST), 자동 안전 fit 대비 `80%–150%`, 기본 `100%`, 1% 단위의 Pet 크기와 최종 cell pixel 기준 X `-96..96`, Y `-104..104`, 기본 `0,0`, 1px 단위 offset control을 제공해야 한다(MUST). `+X`는 오른쪽, `+Y`는 아래쪽 이동이어야 한다(MUST). 각 control은 보이는 label, 현재 값과 단위, keyboard 조작과 접근 가능한 현재값을 제공해야 하며(MUST), preview가 없을 때 비활성화되어야 한다(MUST). 변경은 CSS transform이 아니라 cached alpha-calibrated WebGL projection에 즉시 적용하고(MUST), 재-calibration이나 animation 재시작 없이 현재 pose를 다시 그려야 한다(MUST). 선택 framing은 animation 변경과 canvas resize에서 유지하고(MUST), 새 source가 성공적으로 ready가 되면 `100%, 0, 0`으로 초기화해야 한다(MUST).

#### Scenario: 150% 확대와 border box
- **WHEN** 사용자가 ready preview의 Pet 크기를 100%에서 150%로 변경한다
- **THEN** 같은 pose의 가시 최대축은 raster 반올림 오차 안에서 약 1.5배가 되고 `192×208` border box 밖의 부분은 preview에서 잘린다

#### Scenario: X/Y offset 방향
- **WHEN** 사용자가 X를 `+12px`, Y를 `+8px`로 설정한다
- **THEN** 현재 pose는 export cell 기준 오른쪽 12px, 아래쪽 8px로 이동하고 border box는 움직이지 않는다

#### Scenario: keyboard와 접근 가능한 현재값
- **WHEN** 사용자가 Pet 크기 또는 offset control에 focus하고 방향키를 누른다
- **THEN** 배율은 1%, offset은 1px씩 변경되고 보이는 output과 접근 가능한 현재값이 같은 값을 표시한다

#### Scenario: animation과 resize에서 framing 유지
- **WHEN** 125%, X `-10px`, Y `6px`를 선택한 뒤 animation을 전환하거나 preview canvas를 resize한다
- **THEN** session은 세 값을 유지하고 새 pose 보정 또는 resize projection에 같은 framing을 적용한다

#### Scenario: 새 source의 기본 framing
- **WHEN** 다른 local 또는 remote source가 첫 frame까지 성공해 active source가 된다
- **THEN** framing은 `100%, 0, 0`으로 초기화되고 이전 source가 loading 또는 실패한 동안에는 기존 active framing을 바꾸지 않는다

#### Scenario: 잘못된 session framing
- **WHEN** session API가 범위 밖, 비정수 offset 또는 유한하지 않은 배율·offset을 받는다
- **THEN** session은 값을 적용하지 않고 범위 오류를 반환한다
