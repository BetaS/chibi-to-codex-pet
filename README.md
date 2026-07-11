# LiveSD Pet Builder

LiveSD Pet Builder는 LiveSD (Spine 3.6) 캐릭터를 브라우저에서 확인하고 Codex custom pet v2 패키지로 만드는 오픈 소스 도구입니다. 모델 불러오기, WebGL preview, frame sampling과 atlas 생성은 사용자의 브라우저에서 실행됩니다.

이 프로젝트는 [@BetaS](https://github.com/BetaS)의 hermes bot인 [@hambugi_bot](https://t.me/hambugi_bot) 이 작업했습니다.

## 지원 범위

| 영역 | 지원 내용 |
|---|---|
| 게임 integration | 프로세카 (`prsk`) |
| 준비 중인 integration | 레뷰 스타라이트 (`strr`), BanG Dream! (`garupa`) |
| 모델 형식 | LiveSD (Spine 3.6) binary skeleton, atlas, PNG texture |
| 출력 형식 | Codex custom pet v2 (`pet.json`, `spritesheet.png`) |
| UI 언어 | 한국어, 영어, 일본어, 중국어 간체 |
| 검증 브라우저 | Desktop Chromium |

`strr`와 `garupa`는 상단에서 로드맵을 확인할 수 있는 비활성 탭으로 제공됩니다. 각 탭은 해당 integration이 source loading부터 package export까지 구현되고 검증된 뒤 활성화됩니다.

## 주요 기능

- 기본 제공 PRSK catalog, local ZIP, custom HTTPS provider에서 모델 불러오기
- 실제 skeleton animation 검색, 재생과 Codex Pet 9개 상태 매핑
- 전체 캐릭터와 좌·우 이동 상태의 독립적인 수평 반전
- `192 × 208` output border를 기준으로 한 `80%–150%` scale과 X/Y offset
- pointer를 따르는 16방향 눈 이동과 `50%–150%` 이동량
- 같은 렌더링 계약을 사용하는 LiveSD preview와 Codex Pet preview
- Codex Pet v2 `1536 × 2288` atlas, manifest와 설치용 ZIP 생성
- recipe를 다시 렌더링하는 공개 `npx` CLI
- 브라우저 `localStorage` 기반 설정 preset과 원격 캐릭터 자동 복원

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
2. Resource source를 선택하고 모델을 불러옵니다.
3. LiveSD preview에서 animation, 수평 반전, scale과 X/Y offset을 확인합니다.
4. 9개 Codex Pet 상태의 animation과 좌·우 이동 방향을 설정합니다.
5. Pointer look과 눈 이동량을 확인합니다.
6. Pet 이름과 설명을 입력하고 package를 생성합니다.
7. 검증된 ZIP을 내려받거나 remote recipe용 `npx` 설치 명령을 사용합니다.

Scale과 offset은 최종 `192 × 208` cell pixel을 기준으로 합니다. `+X`는 오른쪽, `+Y`는 아래쪽이며, 큰 scale이나 offset은 output border에서 캐릭터를 crop할 수 있습니다.

## Resource source

| Source | 용도 | 입력 |
|---|---|---|
| 기본 제공 | PRSK viewer snapshot에서 캐릭터 선택 | **불러오기** 동작 |
| Local upload | 사용자가 보유한 모델을 브라우저에서 처리 | 공통 `.skel`, 캐릭터 ZIP |
| Custom provider | 별도 HTTPS asset host 사용 | Asset base URL |

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

## Codex Pet 설치

다운로드되는 ZIP의 구조는 다음과 같습니다.

```text
<pet-id>/
  pet.json
  spritesheet.png
```

수동 설치는 ZIP 안의 `<pet-id>` 디렉터리를 `${CODEX_HOME:-$HOME/.codex}/pets/` 아래에 풀고 Codex의 custom pet 목록을 새로 고친 뒤 선택하는 순서로 진행합니다.

Remote source에서 만든 recipe는 같은 renderer와 설정으로 pet을 다시 생성하는 명령을 제공합니다.

```bash
npx -y chibi-to-codex-pet install --recipe <recipe>
```

Recipe에는 provider, character ID, scale·offset, 눈 이동량, metadata와 animation mapping이 기록됩니다. 모델과 생성 이미지 byte는 실행 시 provider에서 읽고 local renderer가 생성합니다.

CLI package를 저장소에서 검증하려면 다음 명령을 사용합니다.

```bash
pnpm verify:local-npx -- --no-render
```

## 개발과 검증

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:runtime
pnpm verify:local-npx -- --no-render
openspec validate --specs --strict
```

실제 모델 기반 Playwright 사례는 사용 권리가 확인된 local fixture가 있을 때 실행됩니다. Production build 검사기는 모델 asset, 고정 character catalog와 사용자 provider URL이 배포 산출물에 섞이지 않았는지 확인합니다.

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

## 저장소 구조

```text
src/features/livesd/       LiveSD model, runtime, preview와 sampling
src/features/livesd/prsk/  PRSK integration과 resource source
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

사용자가 선택하는 PRSK 및 기타 모델 asset은 각 asset의 권리 조건을 따릅니다. 저장소의 production 산출물은 해당 모델 asset을 배포 대상으로 삼지 않습니다. Project SEKAI, pjsek.ai, prsk-chibi-viewer, Spine과 Codex를 포함한 제품명·서비스명·상표는 각 권리자에게 귀속되며, LiveSD Pet Builder는 커뮤니티가 관리하는 오픈 소스 프로젝트입니다.
