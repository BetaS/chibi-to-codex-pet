## Why

production에서 매번 공통 `.skel`과 캐릭터 ZIP을 준비해야 하는 현재 흐름은 PRSK 호환 리소스 서버를 이미 보유한 사용자의 빠른 미리보기를 어렵게 한다. 원격 URL만 받으면 사용 가능한 캐릭터를 알 수 없고 앱에 복사한 고정 목록은 배포 상태와 쉽게 어긋난다. 사용자가 명시적으로 불러온 custom catalog 또는 `prsk-chibi-viewer` 배포 snapshot에서 얻은 검증된 option과, 실제 모델 파싱 결과를 검색 가능한 dropdown으로 탐색할 수 있어야 한다.

## What Changes

- 입력 소스를 `로컬 파일`과 `리소스 서버`로 분리하고 `로컬 파일`을 기본 모드로 유지한다.
- 리소스 서버 모드에서 사용자가 base URL 또는 preset을 확인하고 `목록 불러오기`를 실행한 뒤에만 catalog를 요청한다.
- custom provider는 base URL 아래의 versioned `catalog.json`을 유지한다.
- `prsk-chibi-viewer` preset은 `https://prsk-chibi-viewer.vercel.app/` HTML을 가져와 딱 하나의 same-origin `/static/js/main.[0-9a-f]{8}.js` bundle을 찾고, bundle text에 든 raw 또는 quote-escaped exact `{ "value": "sd_*", "label": "sd_*" }` record를 데이터로만 scan한다. bundle은 `eval`, `Function`, dynamic import, script 주입 또는 어떤 방식으로도 실행하지 않는다.
- `sd_` ID이고 `label === id`인 record만 dedupe·검증해 최대 1,000개의 공통 catalog option으로 정규화한다. `base_model`과 animation 등 비-캐릭터 record는 `sd_` 규칙으로 제외하며 앱 bundle·생성 catalog·이전 응답을 fallback으로 합치지 않는다.
- preset 모델 리소스는 API·proxy·viewer 중계 없이 `https://assets.pjsek.ai/file/pjsekai-assets/startapp/area_sd`에서 브라우저가 직접 요청한다. `api.pjsek.ai` catalog 요청은 계약에서 제거한다.
- 캐릭터 dropdown의 option은 가장 최근에 성공한 custom manifest 또는 viewer deployment snapshot에서만 파생한다. snapshot이 asset server의 실시간 listing이 아니므로 오래될 수 있음을 UI와 문서에 고지한다.
- viewer HTML·bundle 구조가 바뀌거나 strict option record를 더 이상 찾을 수 없으면 기존 `REMOTE_CATALOG_INVALID`, `REMOTE_CATALOG_ORIGIN_INVALID` 또는 `REMOTE_CATALOG_EMPTY`로 중단한다. snapshot에 있는 캐릭터의 direct asset이 없으면 status를 포함한 `REMOTE_MODEL_HTTP`를 표시하고 다른 목록으로 fallback하지 않는다.
- 캐릭터 dropdown에서 option을 선택하면 공통 스켈레톤, 선택 캐릭터의 atlas 및 atlas가 참조하는 PNG를 브라우저가 직접 요청하고 미리보기를 시작한다.
- 선택 모델의 `.skel`을 기존 LiveSD 3.6 어댑터로 파싱해 실제 애니메이션 이름만 검색 가능한 animation dropdown에 표시한다. viewer bundle의 animation 목록은 사용하지 않는다.
- 두 dropdown의 검색어는 현재 option의 label과 value를 클라이언트에서만 필터링한다. 검색과 결과 없음 상태는 원격 요청이나 선택 변경을 만들지 않으며 자유 입력 text는 option 선택으로 인정하지 않는다.
- HTTPS, URL 자격 증명, redirect, 사설 네트워크 주소, CORS/네트워크 실패, timeout, HTML과 bundle 합계 1MiB, 모델 응답 크기와 atlas 페이지 수에 대한 원격 입력 검증 및 구분 가능한 오류를 추가한다.
- **BREAKING**: 제품 전체의 “외부 네트워크 요청 없음” 보장을 “로컬 모드에서는 외부 요청 없음, 원격 모드에서는 사용자가 승인하고 실행한 서버에만 요청”으로 변경한다. 암묵적인 원격 fallback 금지는 유지한다.

## Capabilities

### New Capabilities

- `prsk-remote-resource-source`: 사용자가 승인한 custom catalog 또는 `prsk-chibi-viewer` deployment snapshot의 안전한 text scan, 검색 가능한 캐릭터 dropdown, direct asset URL 계약, 명시적 요청 흐름, 원격 자원 제한·보안 검증과 기존 typed catalog·model 오류를 정의한다.

### Modified Capabilities

- `prsk-character-archive-import`: production 입력 미선택 동작을 선택한 소스 모드 기준으로 한정하고, 로컬 ZIP 가져오기의 외부 요청 차단 보장을 명확히 한다.
- `livesd-36-preview`: production 공통 스켈레톤 입력에 사용자 승인 원격 소스를 추가하고, 원격 `.skel`에서 파싱한 애니메이션을 검색 가능한 dropdown과 재생 계약에 연결하며, 외부 CDN 금지를 암묵적 원격 fallback 금지로 좁힌다.

## Impact

- `src/App.tsx`의 provider preset·요청 origin·상태 안내가 viewer deployment snapshot origin과 direct asset origin을 모두 표시하도록 바뀌며 snapshot의 진부화 가능성을 고지한다.
- custom `catalog.json` adapter는 유지하고, 기존 pjsek.ai asset API adapter는 viewer HTML·same-origin hashed JS·strict embedded option text adapter로 대체한다.
- preset 모델 loader는 스켈레톤·atlas·PNG를 `assets.pjsek.ai`에서 직접 읽으며, `api.pjsek.ai`나 앱 서버를 사용하지 않는다.
- 로컬 ZIP importer의 `LiveSDAtlasBundle` 및 `LiveSD36Adapter` 공개 계약은 유지되며 고정 캐릭터·애니메이션 목록, 새 런타임 또는 ZIP 의존성은 추가하지 않는다.
- 단위 테스트와 Chromium 브라우저 테스트는 실제 viewer 배포와 `assets.pjsek.ai`에 의존하지 않고 HTML·hashed bundle·direct asset 요청을 모두 intercept한다. production build에 snapshot에서 파싱한 목록을 포함하지 않는지 검증한다.
- README와 `DECISIONS.md`는 API catalog 계약을 대체하는 snapshot 계약, 스크립트 미실행 보장, 구조 변경·진부화 위험을 명시한다.
