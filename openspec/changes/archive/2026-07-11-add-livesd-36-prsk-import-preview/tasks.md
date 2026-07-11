## 1. 적용 선행 조건

- [x] 1.1 별도 OpenSpec 변경에서 프런트엔드 기술 스택과 앱 스캐폴딩을 확정하고 이 변경이 사용할 브라우저·테스트 환경을 준비한다
- [x] 1.2 GitHub 저장소를 비공개로 전환하고 개발·통합 시점의 유효한 Spine 라이선스 확인 결정을 기록한다
- [x] 1.3 gitignore된 `/assets/prsk/base_model/sekai_skeleton.skel`과 최소 한 개의 완전한 캐릭터 atlas/PNG 세트를 로컬에 준비한다

## 2. LiveSD 3.6 런타임 공급

- [x] 2.1 esterTion fork 커밋 `8d79291441394b3a279d5d36f054d563dbc15e16`에서 비압축 `spine-webgl.js`, `spine-webgl.d.ts`, `LICENSE`만 byte-for-byte로 vendoring한다
- [x] 2.2 세 파일의 SHA-256을 설계 문서 값과 대조하고 출처·커밋·해시·원문 라이선스를 `THIRD_PARTY_NOTICES.md`에 기록한다
- [x] 2.3 classic script를 한 번만 로드하고 전역 `spine`을 내부로 제한하는 `LiveSD36RuntimeLoader`를 구현한다
- [x] 2.4 런타임 누락, 해시 불일치 및 전역 API 생성 실패를 구분된 오류로 반환한다

## 3. PRSK 캐릭터 아카이브 가져오기

- [x] 3.1 `PrskCharacterArchiveImporter`, `PrskCharacterPack`, 경고 및 오류 코드 계약을 구현한다
- [x] 3.2 ZIP 32MiB, 압축 해제 합계 64MiB, 파일 32개 제한과 안전한 경로 정규화·충돌 검사를 구현한다
- [x] 3.3 `.skel` 부재와 정확히 하나의 `sekai_atlas.atlas` 계약을 검증한다
- [x] 3.4 atlas 페이지를 상대 경로로 해석하고 모든 PNG를 Blob map으로 정규화한다
- [x] 3.5 가져오기 과정에서 외부 네트워크 요청과 런타임 object URL 생성을 하지 않도록 경계를 검증한다

## 4. LiveSD 3.6 어댑터와 미리보기 세션

- [x] 4.1 바이너리 hash/version 헤더 reader와 `3.6` 계열 검사 및 `3.6.53D4` 외 실험적 호환 경고를 구현한다
- [x] 4.2 원본을 보존하면서 마지막 0바이트를 추가한 복사 버퍼를 `SkeletonBinary`에 전달한다
- [x] 4.3 atlas 페이지로 `GLTexture`, `TextureAtlas`, `AtlasAttachmentLoader`와 스켈레톤·animation state를 구성한다
- [x] 4.4 애니메이션 열거, `pose_default` 우선 기본값, 첫 애니메이션 fallback 및 반복 전환을 구현한다
- [x] 4.5 중앙 정렬·bounds 화면 맞춤·resize를 제공하는 투명 WebGL 렌더 루프를 구현한다
- [x] 4.6 animation frame, object URL, texture 및 렌더링 자원을 멱등적으로 해제하는 `LiveSDPreviewSession.dispose()`를 구현한다

## 5. 가져오기·미리보기 UI 연결

- [x] 5.1 공통 `.skel`과 캐릭터 ZIP 선택, 개발 fallback, 진행 상태, 경고와 구분된 오류를 표시하는 최소 UI를 구현한다
- [x] 5.2 WebGL 캔버스와 애니메이션 선택기를 연결하고 현재 애니메이션 상태를 표시한다
- [x] 5.3 새 ZIP 가져오기와 화면 해제 시 기존 세션을 먼저 dispose하도록 수명 주기를 연결한다
- [x] 5.4 공통 스켈레톤 누락과 WebGL 미지원 상태에 파일 선택 및 개발 fallback 준비 방법을 포함한 안내를 표시한다

## 6. 자동 검증

- [x] 6.1 유효·중첩·손상 ZIP, atlas 없음·다중 atlas, `.skel` 포함, 누락·비PNG 페이지 및 안전하지 않은 경로 테스트를 추가한다
- [x] 6.2 압축 파일 크기, 해제 합계 및 항목 수 경계 테스트를 추가한다
- [x] 6.3 검증 프로필의 실제 `3.6.53` 헤더, 다른 3.6, 타 버전 및 손상 헤더에 대한 버전 검사 테스트를 추가한다
- [x] 6.4 mock 런타임으로 NUL 패딩, runtime 구성 순서, 기본 애니메이션, 전환, 중복 dispose를 검증한다
- [x] 6.5 외부 네트워크 요청이 없고 기존 세션 재가져오기 시 자원 정리가 수행되는 브라우저 테스트를 추가한다

## 7. 로컬 스모크와 완료 점검

- [x] 7.1 `assets/prsk`가 있을 때만 실행되는 로컬 스모크 절차로 실제 header `3.6.53`인 `3.6.53D4` 호환 모델 렌더링과 애니메이션 전환을 검증한다
- [x] 7.2 PRSK 자산이 Git 상태와 CI 산출물에 포함되지 않았는지 확인한다
- [x] 7.3 런타임 파일 해시, 원문 라이선스, 비공개 저장소, 라이선스 확인 결정 및 production 사용자 고지를 최종 확인한다
- [x] 7.4 README와 `DECISIONS.md`에 구현 결과 및 검증된 호환 범위를 반영한다

## 8. 개발용 기본 링크 자산

- [x] 8.1 `public/assets` 상대 symlink로 gitignore된 로컬 `assets/`를 development에서만 제공하고 production build 복사를 차단한다
- [x] 8.2 사용자 입력이 없을 때 공통 스켈레톤과 `sd_mob003` atlas/PNG를 자동 미리보는 기본 loader와 UI 상태를 구현한다
- [x] 8.3 기본 loader 단위 테스트, Chromium 자동 미리보기와 production 자산 제외를 검증한다
