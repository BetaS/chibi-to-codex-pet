## Context

현재 앱은 production에서 사용자가 선택한 공통 `.skel`과 캐릭터 ZIP을 결합하고, development에서는 `public/assets` symlink의 기본 모델을 같은 출처에서 자동 로드한다. `PrskCharacterArchiveImporter`는 ZIP을 `LiveSDAtlasBundle`로 정규화하고, `LiveSD36Adapter`는 해당 bundle과 스켈레톤 `ArrayBuffer`만 소비하므로 입력 원본과 런타임 경계는 이미 분리되어 있다. 어댑터가 실제 스켈레톤에서 추출한 애니메이션 이름은 `LiveSDPreviewSession`과 animation dropdown으로 전달된다.

`prsk-chibi-viewer`의 공개 배포 `https://prsk-chibi-viewer.vercel.app/`는 entry HTML에서 same-origin hashed main JavaScript를 로드하고, 현재 bundle에 searchable character dropdown용 `{ value, label }` JSON option snapshot을 문자열로 포함한다. 이는 `assets.pjsek.ai`의 실시간 directory listing이 아니며 viewer 배포 시점의 snapshot이다. 따라서 목록이 오래될 수 있고 viewer 빌드 구조가 바뀌면 adapter가 실패할 수 있다.

이 변경은 이전의 `api.pjsek.ai` directory API 계약을 폐기하고, viewer HTML에서 안전한 hashed main bundle을 찾은 뒤 bundle을 **실행하지 않고 text로만** 파싱하는 명시적 deployment snapshot adapter로 대체한다. 모델 바이트는 viewer나 앱 proxy를 거치지 않고 `assets.pjsek.ai`에서 브라우저로 직접 읽는다.

## Goals / Non-Goals

**Goals:**

- 로컬 파일을 기본 입력으로 유지하면서 명시적으로 선택 가능한 원격 PRSK 리소스 모드를 제공한다.
- custom provider의 versioned manifest와 `prsk-chibi-viewer` deployment snapshot을 공통 catalog option 계약으로 정규화한다.
- viewer entry HTML에서 same-origin hashed main JS만 선택하고, 비신뢰 JavaScript를 실행하지 않은 채 strict option object payload를 추출한다.
- snapshot option으로 선택한 모델을 `assets.pjsek.ai` 고정 배치에서 직접 로드하고 기존 런타임 독립 입력으로 정규화한다.
- 선택한 `.skel`의 실제 파싱 결과만 animation dropdown의 option으로 사용한다.
- 자동 fallback 없이 catalog 로드와 검증된 option commit에 해당하는 요청만 실행하고, query·highlight는 요청 trigger로 사용하지 않는다.
- viewer 구조 변경, snapshot과 asset의 불일치, 안전하지 않은 URL, 과대·손상 응답을 기존 stable catalog·model error로 구분한다.
- 새 요청, 모드 전환과 unmount에서 진행 중 요청을 취소하고 기존 미리보기의 원자적 교체를 유지한다.

**Non-Goals:**

- HTML directory index scraping, asset ID brute-force, 또는 여러 asset URL의 존재 probe
- `api.pjsek.ai` 또는 다른 directory/catalog API 사용
- viewer JavaScript의 `eval`, `Function`, dynamic import, `<script>` 주입, sandbox 실행 또는 AST 전체 해석
- viewer bundle에 포함된 animation snapshot 사용
- 앱에 특정 시점의 PRSK 캐릭터·애니메이션 목록을 복사하거나 production bundle에 생성 catalog를 포함하는 방식
- viewer snapshot mirror, 앱 서버 proxy, 캐시 목록 fallback 또는 viewer가 바뀌었을 때의 숨은 API fallback
- viewer snapshot과 `assets.pjsek.ai` 사이의 실시간 일치·가용성 보장
- 사용자 URL, token, catalog 또는 원격 리소스의 영구 저장
- 원격 리소스의 저작권·라이선스 권한 판정

## Decisions

### 1. remote mode를 catalog 탐색과 모델 파싱의 명시적 흐름으로 만든다

UI 상태에 `local | remote` source mode를 두고 초기값은 항상 `local`로 둔다. development의 `public/assets` 자동 미리보기도 local mode에서만 동작한다.

```text
custom base URL 입력 또는 viewer snapshot preset 선택
               ↓ 요청 없음
        목록 불러오기 클릭
               ↓ custom JSON 또는 viewer HTML → hashed JS text
        검색 가능한 캐릭터 dropdown
               ↓ query·highlight: local-only
               ↓ 검증된 option commit
       direct asset 스켈레톤·atlas·PNG 요청
               ↓ 기존 adapter의 실제 스켈레톤 파싱
        검색 가능한 animation dropdown
               ↓ option commit만 session.play()
```

빈 URL의 `https://assets.pjsek.ai/file/pjsekai-assets/startapp/area_sd`는 placeholder로만 표시한다. `prsk-chibi-viewer 사용` preset은 viewer entry와 asset base를 설정하지만 요청을 시작하지 않는다. 페이지 진입, preset, local 입력 실패, catalog 첫 option, query 입력·삭제와 keyboard highlight는 원격 요청 trigger가 아니다.

### 2. provider catalog와 model loader를 별도 계약으로 둔다

`PrskRemoteCatalogSource`는 custom manifest 또는 viewer deployment snapshot을 읽어 공통 `PrskRemoteCatalog`으로 정규화한다. `PrskRemoteResourceSource`는 현재 catalog의 검증된 ID로 모델 바이트를 준비한다.

```ts
interface PrskRemoteCharacterOption {
  id: string;
  label: string;
}

interface PrskRemoteCatalog {
  providerLabel: string;
  assetBaseUrl: string;
  requestOrigins: readonly string[];
  characters: readonly PrskRemoteCharacterOption[];
}

interface PrskRemoteModelInput {
  skeletonData: ArrayBuffer;
  atlasBundle: LiveSDAtlasBundle;
  sourceOrigin: string;
}
```

두 source 결과는 object URL, JavaScript 실행 결과, WebGL·LiveSD runtime 객체 또는 animation 목록을 포함하지 않는다. 모델 결과는 기존 `LiveSD36Adapter.createPreview()`로 전달한다.

### 3. custom manifest와 prsk-chibi-viewer deployment snapshot adapter를 지원한다

custom provider는 사용자가 입력한 정규화 base URL `B`와 같은 origin·base path의 `B/catalog.json`을 사용한다. `version: 1`, 최대 1,000개의 `{ id, label }`, 중복 거부와 공통 ID·label 검증은 유지한다.

viewer snapshot preset은 다음 고정 경계를 사용한다.

```text
viewer entry  https://prsk-chibi-viewer.vercel.app/
asset base    https://assets.pjsek.ai/file/pjsekai-assets/startapp/area_sd
main JS path  ^/static/js/main\.[0-9a-f]{8}\.js$
```

각 명시적 catalog 로드는 viewer entry HTML을 다시 요청한다. HTML은 inert document로만 파싱하고 DOM에 삽입하지 않는다. `script[src]` 중 pathname이 위 hashed main JS 규칙을 만족하고 username·password·query·fragment가 없으며 viewer entry와 origin이 같은 candidate가 **정확히 하나**일 때만 bundle을 요청한다. relative `src`는 viewer entry를 기준으로 해석한 후 같은 경계를 적용한다.

bundle은 fatal UTF-8 text로만 읽고 다음 한정된 snapshot grammar을 사용한다.

- 공백이나 추가 key가 없는 raw `{"value":"...","label":"..."}` 또는 quote-escaped `{\"value\":\"...\",\"label\":\"...\"}` record만 scan한다.
- `value`가 안전한 최대 128자 `sd_` ID이고 `label === value`인 record만 받는다.
- 같은 ID와 label의 반복 record는 dedupe하고, 서로 다른 label·잘못된 ID·1,000개 초과는 거부한다.
- `base_model`과 현재 viewer animation record는 `sd_` ID 규칙을 만족하지 않으므로 option에서 제외한다.
- `eval`, `Function`, `JSON.parse`를 포함한 JavaScript 평가, dynamic import, script element, Blob URL 또는 viewer code 실행은 금지한다.

HTML 구조, hashed bundle URL 또는 embedded option grammar가 바뀌면 구조 변경으로 실패하며 API, asset directory, 이전 snapshot 또는 앱 번들 목록으로 fallback하지 않는다. preset 적용 후 asset base를 편집하면 viewer 연결을 즉시 해제하고 custom `B/catalog.json` provider로 전환한다.

### 4. snapshot option은 최근 성공 generation에만 속하며 실시간 asset listing으로 간주하지 않는다

캐릭터 dropdown의 canonical option set은 현재 catalog generation에서 성공적으로 파싱한 custom manifest 또는 viewer deployment snapshot과 1:1로 일치한다. 첫 option은 자동 선택하지 않고, 빈 목록은 `REMOTE_CATALOG_EMPTY`로 거부한다.

viewer snapshot은 배포 시점의 정보이므로 `assets.pjsek.ai`의 현재 상태보다 느리거나 앞선 수 있다. 앱은 목록 생성 시 모든 ID를 probe하지 않고, 사용자가 commit한 캐릭터만 direct asset URL에서 검증한다. snapshot option에 대응하는 모델 리소스가 없거나 실패하면 status를 포함한 기존 `REMOTE_MODEL_HTTP` 또는 model content 오류로 안내하고 현재 세션과 dropdown을 유지한다.

고정·bundled·generated list, 이전 성공 snapshot, `api.pjsek.ai`, custom provider 또는 임의 remote source를 실패 대체제로 합치지 않는다.

### 5. searchable dropdown은 검증된 option만 commit한다

캐릭터와 animation dropdown은 label이 연결된 accessible combobox/listbox다. query는 현재 option의 label 또는 value에 대한 대소문자 무시 substring match로 visible subset만 만든다. 빈 query는 전체 option을 복원하고, 일치 항목이 없으면 `검색 결과 없음`을 표시한다.

query·highlight는 underlying option, 현재 선택, request generation, 네트워크 상태 또는 재생을 바꾸지 않는다. visible canonical option의 명시적 선택만 ID 또는 animation으로 commit한다. provider·base URL·catalog invalidation, 새 catalog 성공, ready session 교체와 source mode 전환은 해당 query를 초기화한다.

### 6. 선택한 option은 고정된 PRSK area_sd 배치로 해석한다

catalog의 asset base URL을 `B`, 선택·재검증한 character ID를 `C`라고 할 때 다음 URL만 사용한다.

```text
공통 스켈레톤  B/base_model/sekai_skeleton.skel
캐릭터 atlas   B/C/sekai_atlas.atlas
atlas 페이지   B/C/<atlas가 참조한 상대 PNG 경로>
```

viewer preset의 `B`는 항상 `https://assets.pjsek.ai/file/pjsekai-assets/startapp/area_sd`이다. model fetch는 viewer origin이나 앱 서버를 거치지 않는다. atlas 페이지는 정규화 후 같은 asset origin의 `B/C/` 아래 PNG여야 하며 경로 탈출, 절대 URL, drive letter, NUL과 중복을 거부한다.

### 7. animation option은 실제 스켈레톤 파싱 결과에서만 만든다

`PrskRemoteResourceSource`는 원본 skeleton `ArrayBuffer`와 `LiveSDAtlasBundle`만 반환한다. `LiveSD36Adapter`가 스켈레톤을 파싱하면 ready session의 `animations`를 순서 그대로 animation dropdown option으로 사용한다. viewer bundle의 애니메이션 snapshot은 사용하지 않는다.

`pose_default`가 있으면 기본값으로, 없으면 첫 animation을 반복 재생한다. query·highlight는 `session.play()`를 호출하지 않고, 현재 option commit만 추가 네트워크 요청 없이 재생을 전환한다. 이전 세션 option은 `ANIMATION_UNKNOWN`으로 거부한다.

### 8. viewer entry, hashed bundle과 asset origin을 닫힌 경계로 검증한다

custom asset base URL은 username·password·query·fragment가 없는 URL이어야 한다. production은 HTTPS만 허용하고 localhost 계열 이름과 문법적으로 판별 가능한 loopback·private·link-local IP literal을 거부한다. development에서만 `localhost`, `127.0.0.1`, `[::1]`의 HTTP를 허용한다.

custom manifest는 asset base와 같은 origin·base path의 `catalog.json`으로 고정한다. viewer preset에서만 `https://prsk-chibi-viewer.vercel.app` catalog origin과 `https://assets.pjsek.ai` asset origin을 별도로 허용한다. HTML이 지시한 main bundle은 viewer와 same-origin이어야 한다. UI는 catalog 요청 전에 viewer/catalog origin과 asset origin을 모두 표시한다.

HTML, JS, custom JSON, skeleton, atlas와 PNG 모두 redirect를 따라가지 않는다. `api.pjsek.ai`는 허용 origin 및 요청 대상이 아니다.

### 9. catalog과 model 요청에 fetch 정책, 자원 제한과 typed error를 적용한다

모든 원격 요청은 `mode: 'cors'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `redirect: 'error'`와 현재 작업 `AbortSignal`을 사용한다. CDN과 배포 snapshot의 실시간 일치는 보장하지 않으며 HTTP cache 동작은 provider 응답과 브라우저 정책을 따른다.

catalog 작업 전체와 model 작업은 각각 20초 timeout을 갖는다.

- custom JSON: fatal UTF-8 1MiB, option 최대 1,000개
- viewer entry HTML과 hashed JS: 각각 fatal UTF-8이며 두 응답 합계 1MiB
- viewer character option: dedupe 후 최대 1,000개
- 공통 skeleton: 8MiB
- atlas text: fatal UTF-8 1MiB
- atlas page: 최대 32개, PNG 합계 64MiB, PNG signature 필수

`Content-Length`를 선제 검사하고 stream을 누적 제한으로 읽는다. main bundle 부재·복수 candidate·strict record 위반과 option schema 변경은 `REMOTE_CATALOG_INVALID`, cross-origin·query·fragment bundle은 `REMOTE_CATALOG_ORIGIN_INVALID`, HTML+JS 합계 초과는 `REMOTE_CATALOG_TOO_LARGE`, usable option 부재는 `REMOTE_CATALOG_EMPTY`로 구분한다. direct asset HTTP 실패는 기존 `REMOTE_MODEL_HTTP`를 사용한다. URL, redirect, content, timeout, selection, path와 `REMOTE_NETWORK_OR_CORS` 계약도 유지하며 abort는 사용자 오류로 표시하지 않는다.

### 10. generation과 원자적 session 교체를 유지한다

catalog와 model 요청은 독립 generation과 `AbortController`를 갖는다. 새 catalog 로드, provider·base URL 변경, source mode 전환과 unmount는 HTML과 hashed JS를 포함한 catalog 작업 및 model 작업을 취소한다. 새 character commit은 현재 catalog를 유지한 채 model 작업만 취소한다. query·highlight는 generation을 발급하거나 요청을 취소하지 않는다.

모델 입력, skeleton 파싱과 첫 frame이 모두 성공한 뒤에만 기존 session을 dispose하고 새 session·animation option으로 교체한다. catalog·model 실패 시 기존 session, 현재 animation과 두 dropdown의 option·query·선택을 유지한다.

## Risks / Trade-offs

- [Risk] viewer bundle은 catalog API가 아니며 배포 구조가 언제든 바뀔 수 있다. → same-origin hashed path와 strict record grammar만 허용하고 구조 변경을 기존 catalog 오류로 즉시 노출한다. 숨은 fallback은 두지 않는다.
- [Risk] viewer snapshot은 direct asset 서버보다 오래될 수 있다. → 목록 생성 때 대량 probe하지 않고, 선택한 모델의 HTTP 실패를 표시해 사용자가 목록을 다시 불러오거나 custom provider를 선택하게 한다.
- [Risk] remote code text를 다루는 것 자체가 실행으로 오해될 수 있다. → JS는 절대 실행·삽입·평가하지 않고 strict record scanner만 사용하며 이 보장을 테스트로 고정한다.
- [Risk] viewer deployment과 asset host는 서로 다른 제3자 요청 경계다. → 요청 전 두 origin을 모두 표시하고 non-affiliation, CORS, 가용성, 스냅샷 일치와 리소스 권한을 앱이 보장하지 않음을 고지한다.
- [Risk] 임의 custom HTTPS origin 허용으로 전면적 오프라인 보장이 약해진다. → local를 기본으로 유지하고 catalog와 model 각각을 사용자 동작으로만 시작한다.
- [Risk] `connect-src https:`는 host allowlist보다 넓다. → 실제 fetch 진입점을 provider resolver와 catalog·model source로 제한하고 자동 요청 금지를 테스트한다.

## Migration Plan

1. 기존 `api.pjsek.ai` provider constants, pagination parser와 error/test fixture를 viewer deployment snapshot 계약으로 대체한다.
2. limited reader를 재사용해 viewer HTML과 hashed JS의 fatal UTF-8 및 합계 1MiB 제한을 적용한다.
3. inert HTML에서 unique same-origin hashed main JS를 찾는 parser와 non-executing strict option literal scanner를 구현한다.
4. preset UI, request origin, disclosure와 error mapping을 viewer snapshot·direct asset 계약으로 변경한다.
5. mock HTML·JS·asset fixture와 Playwright interception으로 실제 viewer, `api.pjsek.ai`와 `assets.pjsek.ai`에 의존하지 않고 계약을 검증한다.
6. production build에 snapshot에서 파싱한 캐릭터 목록이 포함되지 않는지 검증한다.

## Open Questions

없음. viewer deployment URL, hashed main path grammar, strict option record grammar과 direct asset base는 이 변경에서 고정한다. viewer가 해당 구조를 바꾸면 자동 추론을 늘리지 않고 새 OpenSpec 변경으로 계약을 재검토한다.
