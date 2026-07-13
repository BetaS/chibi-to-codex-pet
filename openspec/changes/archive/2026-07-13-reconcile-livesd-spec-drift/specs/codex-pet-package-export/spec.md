## MODIFIED Requirements

### Requirement: 사용자 framing과 package 결과 일관성

웹은 현재 preview의 `framingScale`과 X/Y offset을 package sampling 시작 시 snapshot해 PNG pixel에 bake해야 한다(MUST). V2 manifest는 정의된 metadata와 spritesheet 필드만 사용하며 framing은 raster 결과로 표현해야 한다(MUST). Framing 값이 변경되면 진행 중인 export와 완료된 download·validation·installed preview를 무효화하고(MUST), 사용자가 입력한 metadata와 animation mapping은 유지해야 한다(MUST). 기본 framing은 strict 70% 점유율과 4px 안전 여백을 통과해야 하고(MUST), custom framing은 edge crop을 허용하면서 empty·점유율·geometry 검사를 통과해야 한다(MUST).

#### Scenario: framing 변경 후 이전 결과 무효화
- **WHEN** 검증된 ZIP과 installed preview가 있는 상태에서 사용자가 scale 또는 X/Y offset을 변경한다
- **THEN** 이전 download와 installed preview는 제거되고 metadata와 animation mapping은 유지된 채 새 framing으로 다시 생성할 수 있다

#### Scenario: 진행 중 framing 변경
- **WHEN** sampling 또는 packaging 중 사용자가 scale 또는 offset을 변경한다
- **THEN** 이전 framing 작업은 취소되어 결과를 노출하지 않고 다음 생성은 변경된 framing snapshot을 사용한다

#### Scenario: V2 manifest와 raster framing
- **WHEN** custom framing package를 만든다
- **THEN** `pet.json`은 v2 schema의 필드를 사용하고 선택 scale과 offset은 `spritesheet.png`의 raster 결과로 표현된다

#### Scenario: preview와 package 일치
- **WHEN** 150%, X `12px`, Y `8px` framing으로 package를 생성한다
- **THEN** LiveSD preview와 export는 모두 100% 대비 1.5배, 오른쪽 12px, 아래쪽 8px라는 같은 control 의미를 사용한다
- **AND** animation mapping 완료 뒤 LiveSD preview와 export는 같은 57개 표준 pose의 sample time과 raw bounds 합집합으로 canonical projection을 계산한다
- **AND** installed preview는 같은 projection으로 export한 57개 표준 pose 합집합의 실제 raster 결과를 정확히 표시한다
