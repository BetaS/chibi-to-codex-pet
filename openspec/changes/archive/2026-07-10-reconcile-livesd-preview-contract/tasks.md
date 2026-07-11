## 1. 공개 계약 정리

- [x] 1.1 `PrskCharacterPack`을 `LiveSDAtlasBundle`로 교체하고 `archiveName`을 `sourceName`으로 변경하며 warning 관련 공개 타입과 필드를 제거한다.
- [x] 1.2 importer의 `PrskArchiveImportErrorCode`를 명세의 15개 값으로 고정하고 각 알려진 실패가 해당 code와 실행 가능한 한국어 message를 반환하게 한다.
- [x] 1.3 공통 스켈레톤 입력에 `SHARED_SKELETON_REQUIRED`, `SHARED_SKELETON_INVALID_TYPE`을 적용하고 대소문자를 무시한 `.skel` 검증을 구현한다.
- [x] 1.4 runtime loader와 preview 오류 union을 명세 값으로 축소·확장하고 제거된 integrity/version/warning code의 모든 소비 지점을 정리한다.
- [x] 1.5 `LiveSDSkeletonCompatibility`, header, adapter input과 session의 generic 공개 타입을 갱신하고 `onError()` 구독 계약을 추가한다.

## 2. ZIP importer와 atlas 검증

- [x] 2.1 모든 ZIP 파일 entry를 먼저 열거해 암호화 여부, `.skel`, 파일 수와 uncompressed 합계를 검사하고 여분 파일도 동일 제한에 포함한다.
- [x] 2.2 ZIP entry와 atlas page의 역슬래시를 슬래시로 바꾼 뒤 안전 경로와 정규화 collision을 검사하도록 공통 path 정규화를 보완한다.
- [x] 2.3 atlas를 fatal UTF-8로 decode하고 빈 page 목록, PNG 이외 format, 정규화 후 duplicate와 누락 page를 구분된 오류로 거부한다.
- [x] 2.4 importer가 참조된 `image/png` Blob만 담은 `LiveSDAtlasBundle`을 반환하고 유효한 여분 파일을 warning 없이 조용히 무시하게 한다.
- [x] 2.5 중첩 ZIP, Windows separator, silent extra, `.skel`, encrypted/corrupt ZIP과 path escape·collision을 importer 단위 테스트로 검증한다.
- [x] 2.6 invalid UTF-8, 빈·중복·누락·비PNG page와 압축 32MiB·해제 64MiB·파일 32개 경계를 importer 단위 테스트로 검증한다.

## 3. 스켈레톤 헤더와 runtime loader

- [x] 3.1 header reader에서 1024-byte 문자열 상한과 3.6 version gate를 제거하고 varint·입력 경계·fatal UTF-8·빈 version 검증을 유지한다.
- [x] 3.2 `3.6.53`·`3.6.53D4`, 다른 3.6과 다른 major/minor를 각각 `verified`, `experimental`, `best_effort`로 분류하되 warning 배열을 만들지 않는다.
- [x] 3.3 정상적인 1024-byte 초과 header와 3.3·3.6·3.7 fixture, truncated/invalid varint·UTF-8 fixture로 header 검사 계약을 자동 검증한다.
- [x] 3.4 `LiveSD36RuntimeLoader`를 고정 same-origin URL의 direct classic script 방식으로 교체하고 유효한 기존 global과 동시 load promise를 재사용하게 한다.
- [x] 3.5 browser fetch·SHA-256·Blob URL 경로와 `expectedSha256` option을 제거하고 script 실패·global shape 누락 후 재시도 가능한 정리를 구현한다.
- [x] 3.6 loader 단위 테스트로 기존 global 재사용, 단일 script·동시 promise, `RUNTIME_SCRIPT_LOAD_FAILED`, `RUNTIME_GLOBAL_MISSING`과 실패 후 retry를 검증한다.
- [x] 3.7 모든 정상 header version의 parser 입력이 원본을 변경하지 않은 `byteLength + 1` 복사본과 마지막 NUL을 받는지 단위 테스트로 고정한다.

## 4. Adapter와 preview session 수명 주기

- [x] 4.1 `LiveSD36Adapter`가 `LiveSDAtlasBundle`만 소비하도록 image·atlas 경로와 runtime 객체 구성 코드를 일반화한다.
- [x] 4.2 어떤 정상 header version도 고정 3.6 `SkeletonBinary`로 전달하고 parse 실패를 실제 input version과 runtime `3.6`이 포함된 `SKELETON_PARSE_FAILED`로 정규화한다.
- [x] 4.3 session 자동 예약을 분리한 내부 start 흐름을 추가하고 delta 0의 첫 update·apply·draw가 성공한 뒤에만 adapter가 ready session을 반환하게 한다.
- [x] 4.4 첫 frame 실패를 `PREVIEW_RENDER_FAILED`로 반환하고 부분 생성된 image, atlas, texture, shader, batcher와 animation frame을 정확히 한 번 정리한다.
- [x] 4.5 후속 frame callback을 오류 경계로 감싸 `PREVIEW_RENDER_FAILED`를 구독자에게 한 번 전달한 뒤 세션을 idempotent하게 dispose한다.
- [x] 4.6 `play()`의 기본 `pose_default`·첫 animation 선택, `ANIMATION_MISSING`, 현재 재생을 유지하는 `ANIMATION_UNKNOWN`과 resize 동작을 유지·검증한다.
- [x] 4.7 mock runtime으로 generic bundle 구성, cross-version parse 성공·실패, 첫 draw ready 판정과 모든 초기화 실패의 역순 cleanup을 adapter 테스트에 추가한다.
- [x] 4.8 mock scheduler와 throw하는 render 객체로 후속 frame 오류 알림, unsubscribe, unmount를 대신한 dispose와 중복 dispose를 session 테스트로 검증한다.

## 5. 앱 입력·상태·오류 UI

- [x] 5.1 앱 상태와 화면 표기를 `sourceName` 기준으로 갱신하고 importer 및 preview warning·compatibility badge/message를 제거한다.
- [x] 5.2 알려진 importer·input·runtime·preview 오류는 stable code와 한국어 message를 함께 표시하고 관련 path/version을 보존한다.
- [x] 5.3 알 수 없는 예외를 raw message·stack 없이 `PREVIEW_UNKNOWN_ERROR`와 일반 한국어 message로 바꾸는 단일 UI 정규화 함수를 적용한다.
- [x] 5.4 새 preview session을 받은 즉시 `onError()`를 구독하고 새 source 성공 교체, 재가져오기, 비동기 render 실패와 component unmount에서 구독·session을 누수 없이 정리한다.
- [x] 5.5 production 공통 스켈레톤 누락·잘못된 확장자, code+message 표시, compatibility 비표시와 unknown fallback을 component 테스트로 검증한다.
- [x] 5.6 기존 development symlink 기본 모델과 production 사용자 입력 흐름이 이번 변경으로 바뀌지 않았는지 회귀 테스트로 확인한다.

## 6. Production 산출물과 문서 정합성

- [x] 6.1 production build가 same-origin `spine-webgl.js`, 원문 `LICENSE`, `THIRD_PARTY_NOTICES.md`를 포함하고 UI link로 접근할 수 있게 유지한다.
- [x] 6.2 production 산출물에 `.skel`, `sekai_atlas.atlas`, PRSK PNG 또는 `public/assets` symlink 대상이 없음을 자동 검사한다.
- [x] 6.3 세 vendored 원본 파일의 SHA-256을 재계산해 설계와 `THIRD_PARTY_NOTICES.md`의 provenance 값이 일치하는지 확인하되 browser 실행 gate로 사용하지 않는다.
- [x] 6.4 `THIRD_PARTY_NOTICES.md`에서 license-confirmation 결정 참조를 제거하고 원문 LICENSE, copyright, fork와 고정 commit 출처를 유지한다.
- [x] 6.5 README를 generic LiveSD source 경계, all-version best-effort 파싱, 첫-frame ready, stable 오류와 production runtime 고지·모델 제외 계약에 맞춘다.
- [x] 6.6 `DECISIONS.md`에서 repository visibility와 license-confirmation 정책 및 참조를 제거하고 version gate·warning 결정을 best-effort metadata-only 결정으로 대체한다.
- [x] 6.7 `add-prsk-remote-resource-source` 아래 파일을 수정하지 않았음을 확인하고, 해당 미래 변경의 generic bundle 재정렬은 이번 변경 archive 이후 작업으로 남긴다.

## 7. 통합 검증

- [x] 7.1 `pnpm typecheck`와 `pnpm lint`를 실행해 공개 type 교체와 제거된 enum 참조가 남지 않았는지 확인한다.
- [x] 7.2 `pnpm test`를 실행해 importer, header, loader, adapter, session과 component 회귀 테스트를 모두 통과시킨다.
- [x] 7.3 `pnpm build`를 실행하고 runtime·고지 포함 및 모델 자산 제외 산출물 검사를 통과시킨다.
- [x] 7.4 `pnpm test:e2e`를 desktop Chromium에서 실행해 사용자 입력, preview ready, animation 전환과 오류 표시 흐름을 검증한다.
- [x] 7.5 gitignore된 `assets/prsk` fixture가 존재할 때만 실제 모델 local smoke test를 실행하고 fixture가 없으면 자동 검증 실패로 취급하지 않는다.
- [x] 7.6 현재 구현과 세 delta spec을 다시 비교해 미해결 drift가 없음을 확인하고 `openspec validate reconcile-livesd-preview-contract --strict`를 통과시킨다.
