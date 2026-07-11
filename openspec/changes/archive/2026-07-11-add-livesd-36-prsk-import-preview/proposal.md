## Why

기존 로드맵은 Live2D (Cubism) 가져오기를 첫 단계로 두고 있지만, 현재 확보한 PRSK 리소스와 검증된 LiveSD (Spine 3.6) WebGL 런타임을 활용하면 실제 애니메이션 미리보기까지 더 빠르게 검증할 수 있다. 첫 구현 단위를 LiveSD 우선으로 전환해 이후 샘플링과 Codex Pet 내보내기 파이프라인의 런타임 경계를 먼저 확정한다.

## What Changes

- 제품의 첫 지원 대상을 LiveSD로 변경하고 Live2D 지원은 후속 로드맵으로 이동한다.
- PRSK 캐릭터 ZIP에서 정확히 하나의 `sekai_atlas.atlas`와 참조 이미지 페이지를 안전하게 가져오고 검증한다.
- production에서는 사용자가 선택한 공통 `.skel`을 캐릭터 ZIP과 결합하고, 개발 환경에서는 `/assets/prsk/base_model/sekai_skeleton.skel`을 편의 fallback으로 사용할 수 있다.
- development에서는 `public/assets` symlink의 `sd_mob003` atlas/PNG를 입력 미선택 시 기본 캐릭터로 자동 표시하며 production build에는 symlink 대상을 포함하지 않는다.
- LiveSD 3.6 계열 버전을 런타임 호출 전에 확인하고, 실제 header `3.6.53`인 검증된 `3.6.53D4` 호환 프로필 외 버전은 실험적 호환으로 표시한다.
- esterTion의 수정된 LiveSD 3.6 WebGL 런타임을 고정 커밋에서 재사용해 `SkeletonBinary` 파싱과 WebGL 미리보기를 제공한다.
- 애니메이션 목록, 기본 애니메이션 선택, 반복 재생, 애니메이션 전환 및 자원 해제를 제공한다.
- 런타임을 추가하기 전에 저장소를 비공개로 전환하고, 개발·통합 시점의 유효한 Spine 라이선스를 확인한 뒤 원문 라이선스와 저작권·fork 고지를 포함해 production 배포를 허용한다.
- **BREAKING**: README와 Issue 1의 MVP 범위를 범용 Live2D ZIP 가져오기에서 PRSK용 LiveSD 3.6 가져오기·미리보기로 대체한다.

## Capabilities

### New Capabilities

- `prsk-character-archive-import`: PRSK 분리 구조의 캐릭터 ZIP을 브라우저에서 검증하고 정규화된 atlas 및 이미지 페이지 집합으로 가져오는 동작을 정의한다.
- `livesd-36-preview`: 공통 LiveSD 3.6 스켈레톤과 캐릭터 리소스를 결합해 애니메이션을 WebGL로 미리보는 동작을 정의한다.

### Modified Capabilities

없음.

## Impact

- 향후 브라우저 애플리케이션의 가져오기, 런타임 어댑터, 미리보기 UI 경계가 새로 정의된다.
- 저장소 비공개 전환과 개발·통합 시점의 Spine 라이선스 확인 후 esterTion `spine-runtimes` fork의 고정 빌드 산출물, 타입 선언 및 원문 라이선스가 추가된다.
- `assets/prsk/`는 로컬 스모크 테스트에만 사용하며 계속 Git에서 제외된다.
- 제품 문서, 결정 기록 및 GitHub Issue 1이 LiveSD 우선 로드맵과 라이선스 확인 후 production 배포 정책에 맞게 변경된다.
- 프런트엔드 기술 스택과 앱 스캐폴딩은 별도 OpenSpec 변경에서 결정한다.
