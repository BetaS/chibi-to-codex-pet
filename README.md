# LiveSD Pet Builder

LiveSD Pet Builder는 LiveSD (Spine 3.6/4.0) 캐릭터를 브라우저에서 확인하고 Codex custom pet v2 패키지로 만드는 오픈 소스 도구입니다. 모델 불러오기, WebGL preview, frame sampling과 atlas 생성은 사용자의 브라우저에서 실행됩니다.

이 프로젝트는 [@BetaS](https://github.com/BetaS)의 hermes bot인 [@hambugi_bot](https://t.me/hambugi_bot) 이 작업했습니다.

## 지원 범위

| 영역 | 지원 내용 |
|---|---|
| 정식 게임 integration | 프로세카 (`prsk`), 레뷰 스타라이트 (`strr`), BanG Dream! (`garupa`) |
| STRR 기본 provider | commit에 고정된 `clyerick/res-pak` 정적 미러 |
| 모델 형식 | LiveSD (Spine 3.6/4.0) binary skeleton, atlas, PNG texture |
| 출력 형식 | Codex custom pet v2 (`pet.json`, `spritesheet.png`) |
| UI 언어 | 한국어, 영어, 일본어, 중국어 간체 |
| 검증 브라우저 | Desktop Chromium |

기본·production 설정에서 세 integration을 모두 선택할 수 있습니다. `garupa`는 local canonical ZIP 또는 검증된 pinned snapshot을 명시적으로 불러와 Spine 4.0 preview와 Codex Pet package를 만들 수 있습니다. `strr`는 검증한 Git commit에 고정된 팬 아카이브 미러에서 catalog와 사용자가 선택한 모델만 읽으며, 실행 중 Karth 또는 공식 종료 서버에는 요청하지 않습니다.

## 주요 기능

- 기본 제공 PRSK catalog, local ZIP, custom HTTPS provider에서 모델 불러오기
- STRR 고정 미러에서 캐릭터→에디션, Garupa pinned snapshot에서 캐릭터→모델 선택
- 실제 skeleton animation 검색, 재생과 Codex Pet 9개 상태 매핑
- 전체 캐릭터와 좌·우 이동 상태의 독립적인 수평 반전
- `192 × 208` output border를 기준으로 한 `80%–150%` scale과 X/Y offset
- pointer를 따르는 16방향 눈 이동과 `50%–150%` 이동량
- 같은 렌더링 계약을 사용하는 LiveSD preview와 Codex Pet preview
- Codex Pet v2 `1536 × 2288` atlas, manifest와 설치용 ZIP 생성
- recipe를 다시 렌더링하는 공개 `npx` CLI
- 게임 runtime별로 격리된 브라우저 설정 preset과 명시적 원격 캐릭터 복원

## 시작하기

### 요구 사항

- Node.js `22.13.0` 이상
- Corepack과 pnpm `11`
- WebGL을 지원하는 Chromium 기반 브라우저

### 개발 서버

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Vite가 출력한 localhost 주소를 브라우저에서 여세요. 외부 catalog와 모델 요청은 사용자가 **불러오기** 또는 local preview 동작을 실행할 때 시작됩니다.

## 사용 흐름

1. 상단에서 게임 integration을 선택합니다. 기본값은 **프로세카**입니다.
2. 저장 preset을 선택했다면 바로 아래의 **프리셋 불러오기**를 누릅니다. 새 모델을 고를 때는 **새 세션**을 선택합니다.
3. 새 세션에서 Resource source를 선택하고 캐릭터 catalog와 모델을 불러옵니다.
4. LiveSD preview에서 animation, 수평 반전, scale과 X/Y offset을 확인합니다.
5. 9개 Codex Pet 상태의 animation과 좌·우 이동 방향을 설정합니다.
6. Pointer look과 눈 이동량을 확인합니다.
7. Pet 이름과 설명을 입력하고 package를 생성합니다.
8. 검증된 ZIP을 내려받거나 remote recipe용 `npx` 설치 명령을 사용합니다. 표시된 명령은 **CLI 바로가기 복사**로 그대로 복사할 수 있습니다.

Scale과 offset은 최종 `192 × 208` cell pixel을 기준으로 합니다. `+X`는 오른쪽, `+Y`는 아래쪽이며, 큰 scale이나 offset은 output border에서 캐릭터를 crop할 수 있습니다.

## Resource source

| 게임 | Source | 용도 | 입력 |
|---|---|---|---|
| PRSK | 기본 제공 | viewer snapshot에서 캐릭터 선택 | **불러오기** 동작 |
| PRSK | Local upload | 사용자가 보유한 모델을 브라우저에서 처리 | 공통 `.skel`, 캐릭터 ZIP |
| PRSK | Custom provider | 별도 HTTPS asset host 사용 | Asset base URL |
| STRR | 고정 미러 | 보존 catalog에서 캐릭터와 에디션 선택 | **캐릭터 목록 불러오기** 동작 |
| Garupa | Pinned snapshot | 캐릭터와 Spine SD 모델 선택 | **라이브 리소스 목록 불러오기** 동작 |
| Garupa | Local upload | 사용자가 보유한 canonical pack을 브라우저에서 처리 | 고급 기능의 ZIP 입력 |

Garupa pinned model의 기본 Pet 이름은 `모델 bundle 이름 - 현재 언어의 캐릭터 이름`이며 전체 캐릭터 수평 반전은 기본으로 꺼집니다. PRSK·STRR·Garupa preset catalog와 마지막 선택은 서로 다른 저장 key를 사용하므로 게임 탭 사이에서 설정이나 반전 값이 섞이지 않습니다.

### Local upload 계약

공통 skeleton과 캐릭터별 파일을 분리해서 선택합니다.

- Skeleton: LiveSD (Spine 3.6) binary `.skel` 한 개
- Character ZIP: `sekai_atlas.atlas` 한 개와 atlas가 참조하는 PNG page
- 제한: ZIP 32 MiB, 압축 해제 후 64 MiB, 최대 32개 entry

모든 local asset byte는 해당 browser session 안에서 처리됩니다.

### Custom provider 계약

Asset base URL을 `B`, character ID를 `C`라고 할 때 provider는 다음 경로를 제공합니다.

```text
B/catalog.json
B/base_model/sekai_skeleton.skel
B/C/sekai_atlas.atlas
B/C/<atlas가 참조하는 PNG page>
```

Production provider는 HTTPS를 사용합니다. Development에서는 localhost의 HTTP endpoint도 사용할 수 있습니다. Browser는 선택한 provider로 직접 요청하므로 provider는 IP 주소, User-Agent, 요청 시각과 같은 일반적인 network metadata를 수신할 수 있습니다.

### STRR 기본 미러와 local 운영 경계

STRR 기본 provider는 다음 immutable commit root입니다.

```text
https://raw.githubusercontent.com/clyerick/res-pak/866b72570450d6e38d0d441d387d0a230d2cb70e/strr
```

앱은 먼저 `catalog.json`을 읽고 캐릭터→에디션 선택 뒤 해당 캐릭터의 skeleton과 선택한 에디션의 atlas·PNG만 가져옵니다. 배포 bundle에는 모델 파일을 넣지 않습니다. GitHub raw mirror는 브라우저의 IP 주소, User-Agent, 요청 시각 같은 일반적인 network metadata를 받을 수 있습니다. 검증한 commit을 사용하므로 `19f03de2` branch가 나중에 이동해도 기본 provider가 조용히 바뀌지 않습니다.

Karth API는 캐릭터·에디션 표시 이름을 보완하는 acquisition source일 뿐 runtime dependency가 아닙니다. Karth 응답 백업, 보존한 Spine archive 변환과 snapshot 설치 도구는 operator-local 파일로만 유지하며 Git, npm package와 CI에 포함하지 않습니다. 원본 응답·key table·texture decoder·model asset도 repository 밖에서만 보관합니다. STRR runtime은 위 고정 원격 미러만 사용하고 GitHub Pages artifact에는 Karth 응답이나 로컬 모델을 복사하지 않습니다.

## Codex Pet 설치

다운로드되는 ZIP의 구조는 다음과 같습니다.

```text
<pet-id>/
  pet.json
  spritesheet.png
```

수동 설치는 ZIP 안의 `<pet-id>` 디렉터리를 `${CODEX_HOME:-$HOME/.codex}/pets/` 아래에 풀고 Codex의 custom pet 목록을 새로 고친 뒤 선택하는 순서로 진행합니다.

Recipe를 지원하는 PRSK·STRR remote source에서 만든 package는 같은 renderer와 설정으로 pet을 다시 생성하는 명령과 **CLI 바로가기 복사** 버튼을 제공합니다.

```bash
npx -y chibi-to-codex-pet install --recipe <recipe>
```

설정 preset에는 PRSK character ID, STRR character·edition ID 또는 Garupa pinned bundle ID가 저장되어 **프리셋 불러오기** 시 해당 모델과 설정을 복원합니다. Recipe에는 CLI renderer가 지원하는 PRSK·STRR provider 식별자, scale·offset, 눈 이동량, metadata와 animation mapping이 기록됩니다. 모델과 생성 이미지 byte는 포함하지 않으며 실행 시 검증된 provider에서 읽고 local renderer가 생성합니다.

CLI package allowlist를 저장소에서 검증하려면 다음 명령을 사용합니다.

```bash
pnpm --filter chibi-to-codex-pet build
pnpm --filter chibi-to-codex-pet verify:pack
```

## 개발과 검증

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm verify:repository-boundary
pnpm build
pnpm verify:runtime
pnpm verify:garupa-manifest
openspec validate --specs --strict
```

기본 `pnpm test:e2e`는 synthetic/intercepted fixture만 사용하는 CI-safe suite입니다. 실제 provider 자료가 필요한 ignored `*.local.spec.ts`가 개발자 worktree에 있을 때만 `pnpm test:e2e:local`로 명시 실행합니다. Repository boundary와 production build 검사기는 provider API 응답, 모델 asset, local script·smoke와 사용자 provider URL이 추적 파일, CI 또는 배포 산출물에 섞이지 않았는지 확인합니다.

### Garupa 디버그 snapshot

Garupa Spine SD 조사는 `bangdream-live2d`의 고정된 full commit만 사용합니다. runtime metadata manifest는 개발 서버와 build에서 deployment base 아래의 `manifests/garupa/bangdream-live2d.v1.json`으로 제공되며 repository, commit, catalog hash와 요청 정책만 포함합니다. 원본 모델 byte와 provider 라이선스 상태는 포함하지 않습니다.

Exact `sdchara` snapshot 확보, private fixture 검증, model-family probe와 compatibility evidence 생성은 ignored operator-local script와 repository 밖 저장소에서만 수행합니다. 이 도구와 evidence는 root package script, Git 및 CI에 포함하지 않습니다. 추적되는 자료는 immutable repository·commit·delivery URL, catalog digest, runtime provenance와 license 고지뿐입니다. Production web에는 공식 Spine 4.0 runtime JavaScript와 고정 provider metadata가 포함되지만 Garupa API response와 원본 asset은 포함되지 않습니다.

## 정적 배포

공개 버전은 GitHub Pages에서 제공됩니다.

- [LiveSD Pet Builder](https://betas.github.io/chibi-to-codex-pet/)
- `main` 브랜치에 push하면 `.github/workflows/deploy-pages.yml`이 자동으로 build와 배포를 수행합니다.
- 같은 workflow는 GitHub Actions의 수동 실행도 지원합니다.

```bash
pnpm install --frozen-lockfile
pnpm build
```

GitHub Pages에는 `dist/client/`을 배포합니다. Repository 하위 경로는 workflow가 전달하는 `DEPLOY_BASE_PATH`로 계산되며 애플리케이션 asset, vendored runtime과 license URL에 동일하게 적용됩니다. 배포 산출물에는 모델 asset과 개인 `.env`가 포함되지 않으며, 모델은 사용자 또는 provider가 runtime에 공급합니다.

외부 hostname에서 development server를 열 때는 `.env.example`을 `.env.local`로 복사하고 `DEV_ALLOWED_HOSTS`에 허용할 정확한 hostname을 쉼표로 구분해 입력합니다.

### 비공개 GA4 분석

GA4 분석은 선택 사항이며 measurement ID가 없으면 Google script를 요청하지 않습니다. 운영자가 방문, 주요 UI 사용, 캐릭터·모델 선택과 Pet ZIP 다운로드 관심도를 개인 GA4 dashboard에서 확인하려면 다음과 같이 설정합니다.

1. 운영 배포는 기본 measurement ID `G-Q7HKZM36RP`를 사용합니다.
2. 다른 GA4 property로 교체하려면 GitHub repository의 **Settings → Secrets and variables → Actions → Variables**에 `GA_MEASUREMENT_ID` repository variable을 추가합니다. 이 값이 기본 ID보다 우선합니다. Measurement ID는 공개 client 식별자이며 service-account key나 API secret을 넣지 않습니다.
3. `main`을 다시 배포한 뒤 GA4 Realtime 또는 DebugView에서 방문과 `game_select`, `button_click`, `character_select`, `model_select`, `pet_zip_download` event를 확인합니다.

Local build에서만 확인하려면 `.env.local`의 `VITE_GA_MEASUREMENT_ID`에 같은 값을 설정할 수 있습니다. `gtag('config', ...)`가 최초 `page_view`를 측정합니다. 게임 탭, 주요 버튼, 캐릭터와 모델 선택은 안정적인 `game_id`, `button_id`, `button_value`, `character_id`, `model_id`, `source_type`으로 기록되며, Event count가 각 행동의 횟수 metric이 됩니다. 선택값별 보고서가 필요하면 이 event parameter를 GA4의 event-scoped custom dimension으로 등록합니다.

`pet_zip_download`는 검증된 ZIP의 다운로드 링크를 누른 경우에만 전송되며 실제 OS 저장 완료가 아니라 클릭 횟수를 뜻합니다. Pet 이름·설명·파일명, 로컬 경로, 사용자가 입력한 URL·label·검색어와 animation mapping은 어떤 custom event에도 포함하지 않습니다. 캐릭터·모델 event에는 검증된 기본 또는 pinned provider catalog ID만 포함하고, 사용자 지정 provider의 raw ID는 `custom`으로 대체합니다. 앱에는 방문자 수나 다운로드 수를 공개 표시하지 않으며 reporting credential도 포함하지 않습니다.

GA4 기본 측정은 browser 정보와 client ID를 처리할 수 있습니다. 운영자는 공개 배포 전에 적용 지역과 사용자에게 필요한 개인정보 고지·동의 요건을 검토해야 합니다.

## 저장소 구조

```text
src/features/livesd/       LiveSD model, runtime, preview와 sampling
src/features/livesd/prsk/  PRSK integration과 resource source
src/features/livesd/garupa/  BanG Dream! canonical pack, pinned provider와 Spine 4.0 integration
src/features/codex-pet/    상태 매핑, preset, recipe, exporter와 validator
packages/cli/              공개 recipe renderer와 설치 CLI
openspec/specs/            현재 제품 동작 계약
openspec/changes/archive/  완료된 변경과 결정 이력
third_party/               vendored runtime과 원문 license
```

명세를 처음 읽는 경우 [OpenSpec 안내](openspec/README.md)에서 용어와 capability map을 확인하세요.

## 기여

버그 보고, 문서 개선과 코드 기여를 환영합니다. 개발 환경, OpenSpec 적용 기준, asset·보안 경계와 PR checklist는 [CONTRIBUTING.md](CONTRIBUTING.md)에 정리되어 있습니다.

## 라이선스와 자산

이 저장소에서 직접 작성한 코드와 문서는 [MIT License](LICENSE)로 배포됩니다. Vendored runtime은 각 디렉터리의 원문 license를 따르며 세부 출처와 hash는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 기록되어 있습니다.

사용자가 선택하는 PRSK, BanG Dream! 및 기타 모델 asset은 각 asset의 권리 조건을 따릅니다. 저장소의 production 산출물은 해당 모델 asset을 배포 대상으로 삼지 않습니다. Project SEKAI, BanG Dream!, pjsek.ai, prsk-chibi-viewer, Spine과 Codex를 포함한 제품명·서비스명·상표는 각 권리자에게 귀속되며, LiveSD Pet Builder는 커뮤니티가 관리하는 오픈 소스 프로젝트입니다.

이 프로젝트는 provider 또는 provider가 참조하는 asset의 라이선스 상태를 심사·보증하거나 runtime 가용성 조건으로 사용하지 않습니다. 앱은 공개된 upstream 오픈 소스 저장소의 commit에 고정된 resource를 참조하며, 원본 모델 asset을 재배포하지 않습니다. 생성된 Pet 설치는 사용자의 개인 사용 흐름으로 취급하고 provider 라이선스 상태나 법적 판단을 UI에 표시하지 않습니다.
