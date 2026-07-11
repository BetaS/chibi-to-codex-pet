## MODIFIED Requirements

### Requirement: WebGL 미리보기 구성
시스템은 runtime 독립 `LiveSDAtlasBundle`의 atlas 페이지로 texture를 생성하고 `TextureAtlas`, `AtlasAttachmentLoader`, `SkeletonBinary`, `Skeleton`, `AnimationStateData`, `AnimationState`를 구성해 alpha가 활성화되고 depth와 stencil이 비활성화된 WebGL canvas에 렌더링해야 한다(MUST). 미리보기는 선택 animation의 첫 frame을 보수적인 coarse bounds로 렌더링한 실제 alpha pixel bounds를 world 좌표로 역변환해 framing을 보정해야 하며(MUST), texture가 투명한 attachment를 포함하는 raw `Skeleton.getBounds()`를 최종 framing 근거로 사용해서는 안 된다(MUST NOT). 매 frame draw 전에 depth test와 depth write 및 cull, scissor, stencil state를 비활성화하고(MUST), attachment를 임의 z 값이나 이름으로 재정렬하지 않은 채 현재 `skeleton.drawOrder`와 alpha blending으로 겹침 순서를 결정해야 한다(MUST). 세션은 보정된 첫 frame draw까지 성공한 뒤에만 ready가 되어야 한다(MUST).

#### Scenario: 미리보기 생성 성공
- **WHEN** 공통 스켈레톤과 유효한 `LiveSDAtlasBundle` 및 WebGL canvas가 주어지고 첫 frame draw가 성공한다
- **THEN** 시스템은 투명 배경에서 첫 coarse render의 실제 alpha bounds 기준으로 모델을 중앙 정렬해 다시 그리고 ready 세션을 반환한다

#### Scenario: 투명 texture placeholder
- **WHEN** 현재 pose에 world geometry는 크지만 texture pixel이 완전 투명한 Region 또는 Mesh attachment가 있다
- **THEN** 시스템은 coarse render의 alpha bounds 보정으로 해당 placeholder를 최종 framing에서 제외하고 보이는 캐릭터를 축소하지 않는다

#### Scenario: animation 전환 framing
- **WHEN** 사용자가 다른 animation으로 재생을 전환한다
- **THEN** 시스템은 새 animation의 첫 pose를 coarse render해 실제 alpha bounds로 framing을 다시 보정한다

#### Scenario: draw order 기반 겹침
- **WHEN** 동일 평면의 둘 이상의 attachment가 겹치거나 animation draw-order timeline이 순서를 변경한다
- **THEN** renderer는 depth 판정이나 임의 z offset 없이 현재 `skeleton.drawOrder` 순서로 합성한다

#### Scenario: 오염된 depth state 복구
- **WHEN** 첫 frame 또는 후속 frame 전에 WebGL depth test나 depth write state가 활성화되어 있다
- **THEN** renderer는 draw 전에 depth test와 depth write를 다시 비활성화해 같은 입력을 같은 순서로 렌더링한다

#### Scenario: WebGL 미지원
- **WHEN** 브라우저가 필요한 WebGL context를 생성하지 못한다
- **THEN** 시스템은 `WEBGL_UNSUPPORTED`를 표시하고 부분 생성된 자원을 정리한다

#### Scenario: runtime 파싱 실패
- **WHEN** 정상 헤더를 가진 스켈레톤을 고정 LiveSD 3.6 runtime이 파싱하지 못한다
- **THEN** 시스템은 실제 입력 version과 runtime `3.6`을 포함한 `SKELETON_PARSE_FAILED`를 표시하고 compatibility label 없이 자원을 정리한다

#### Scenario: 첫 frame 렌더 실패
- **WHEN** runtime 객체 구성은 성공했지만 첫 frame의 update, apply 또는 draw가 실패한다
- **THEN** 미리보기 생성은 `PREVIEW_RENDER_FAILED`로 실패하고 animation frame과 모든 부분 생성 자원을 정리하며 ready 상태를 노출하지 않는다

#### Scenario: 지속 렌더 실패
- **WHEN** ready 세션의 후속 animation frame에서 update, apply 또는 draw가 실패한다
- **THEN** 세션은 `PREVIEW_RENDER_FAILED`를 한 번 알리고 반복 렌더링과 소유 자원을 정리한다

## ADDED Requirements

### Requirement: 사용자 조절 가능한 Pet 크기 미리보기
ready WebGL preview는 자동 안전 fit 대비 `80%–100%`, 기본 `100%`, 1% 단위의 Pet 크기 range control을 제공해야 한다(MUST). control은 보이는 label, 현재 백분율 output, keyboard 조작과 `aria-valuetext`를 제공해야 하며(MUST), preview가 없을 때 비활성화되어야 한다(MUST). 배율 변경은 CSS transform이 아니라 cached alpha-calibrated WebGL projection에 즉시 적용하고(MUST), 재-calibration이나 animation 재시작 없이 현재 pose를 다시 그려야 한다(MUST). 선택 배율은 animation 변경과 canvas resize에서 유지하고(MUST), 새 source가 성공적으로 ready가 되면 100%로 초기화해야 한다(MUST).

#### Scenario: 슬라이더로 크기 축소
- **WHEN** 사용자가 ready preview의 Pet 크기를 100%에서 80%로 변경한다
- **THEN** 같은 pose의 가시 최대축은 raster 반올림 오차 안에서 약 0.8배가 되고 preview의 하단 anchor는 유지된다

#### Scenario: keyboard와 접근 가능한 현재값
- **WHEN** 사용자가 Pet 크기 range에 focus하고 방향키를 누른다
- **THEN** 값은 1%씩 변경되고 보이는 백분율 output과 `aria-valuetext`가 같은 값을 표시한다

#### Scenario: animation과 resize에서 배율 유지
- **WHEN** 80%를 선택한 뒤 animation을 전환하거나 preview canvas를 resize한다
- **THEN** session은 80%를 유지하고 새 pose 보정 또는 resize projection에 동일 배율을 적용한다

#### Scenario: 새 source의 기본 배율
- **WHEN** 다른 local 또는 remote source가 첫 frame까지 성공해 active source가 된다
- **THEN** Pet 크기는 100%로 초기화되고 이전 source가 loading 또는 실패한 동안에는 기존 active 배율을 바꾸지 않는다

#### Scenario: 잘못된 session 배율
- **WHEN** session API가 0.80 미만, 1.00 초과 또는 유한하지 않은 배율을 받는다
- **THEN** session은 값을 적용하지 않고 범위 오류를 반환한다
