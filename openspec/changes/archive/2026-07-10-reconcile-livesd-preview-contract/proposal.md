## Why

현재 구현과 동기화된 누적 명세 사이에는 production runtime 포함 조건, 공개 자료형·오류 enum, ZIP 경계 동작, 버전 처리와 렌더 성공 판정에 차이가 있다. 기존 변경을 archive한 뒤에도 현재 기능과 의도한 best-effort 미리보기를 동일하게 재구현할 수 있도록, 구현에 앞서 세 capability의 계약을 하나의 선행 변경으로 통합 정리해야 한다.

## What Changes

- `web-app-foundation`을 역사적 “foundation-only build” 조건이 아닌 누적 제품 계층 계약으로 바꾼다. foundation은 LiveSD runtime을 직접 소유하지 않지만 LiveSD feature는 고정 runtime과 고지를 production에 포함할 수 있고, PRSK 모델 자산은 포함하지 않는다.
- **BREAKING** runtime-facing `PrskCharacterPack`을 source 독립적인 `LiveSDAtlasBundle`로 교체하고 `archiveName`을 `sourceName`으로 일반화한다. PRSK ZIP importer는 PRSK 입력 규칙을 유지하면서 generic bundle을 반환한다.
- **BREAKING** 여분 ZIP 파일을 조용히 무시하고 importer warning 타입과 `warnings` 필드를 제거한다. 여분 파일도 경로·충돌·파일 수·해제 크기 검사는 계속 적용한다.
- 암호화 ZIP, strict UTF-8 atlas, 빈 페이지 목록과 정규화 후 중복 페이지를 명시적으로 거부하고, importer·input·runtime·preview의 사용자 관찰 가능 오류 enum 전체를 요구사항에 고정한다.
- 브라우저 runtime SHA-256 검증과 관련 오류를 제거하고, same-origin classic script를 한 번만 로드해 API shape를 확인한다. SHA-256과 원본 커밋은 vendoring·재현성 기록으로만 보존한다.
- **BREAKING** 스켈레톤 version gate를 제거하고 정상 헤더의 모든 버전을 LiveSD 3.6 runtime으로 best-effort 파싱한다. compatibility는 `verified | experimental | best_effort` programmatic metadata로만 유지하고 UI warning 타입과 표시는 제거한다.
- `ready` 판정을 첫 WebGL frame draw 성공 이후로 늦추고, 초기·지속 렌더 실패를 `PREVIEW_RENDER_FAILED`로 정리한 뒤 세션 자원을 해제한다.
- 저장소 visibility와 라이선스 확인 정책은 capability 요구사항과 결정 메모에서 제거한다. production runtime 재배포물의 원문 LICENSE·copyright notice, fork 출처·고정 커밋·SHA-256 기록은 유지한다.
- development 기본 source와 local·remote 입력 우선순위는 이 변경에서 수정하지 않는다. 미래 변경 `add-prsk-remote-resource-source`는 이 변경이 archive된 뒤 generic bundle과 새 preview 계약을 기준으로 재정렬한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-app-foundation`: foundation 계층과 LiveSD feature의 production runtime·PRSK 자산 소유 경계를 누적 제품 기준으로 수정한다.
- `prsk-character-archive-import`: generic atlas bundle, silent extra-entry 처리, 엄격한 atlas 검증과 전체 오류 enum 계약을 정의한다.
- `livesd-36-preview`: same-origin runtime loader, cross-version best-effort 파싱, compatibility metadata, 첫 frame 성공 판정, 오류 enum과 배포 고지 계약을 수정한다.

## Impact

- `src/features/livesd/importer/`의 결과 타입, warning 코드와 ZIP 검증 동작이 변경된다.
- `src/features/livesd/adapter/`와 `src/features/livesd/runtime/`의 입력 타입, version 검사, loader와 render error 수명 주기가 변경된다.
- `src/App.tsx`는 generic `sourceName`, 오류 code/message와 비표시 compatibility metadata를 사용하도록 조정된다.
- importer, runtime loader, adapter, 첫 frame·지속 render failure와 production 산출물 회귀 테스트가 추가·수정된다.
- `DECISIONS.md`, `README.md`, `THIRD_PARTY_NOTICES.md`와 누적 OpenSpec 링크·정책 문구가 새 계약에 맞게 정리된다.
- 새로운 npm 의존성, runtime 버전 또는 원격 resource source는 추가하지 않는다.
