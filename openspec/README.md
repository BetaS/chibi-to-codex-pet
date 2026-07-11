# OpenSpec 안내

이 디렉터리는 LiveSD Pet Builder의 제품 계약과 변경 기록을 관리합니다. 처음 참여하는 사람은 이 문서, 관련 capability의 main spec, 구현 코드 순서로 읽으면 됩니다.

## 디렉터리 역할

| 경로 | 내용 |
|---|---|
| `specs/<capability>/spec.md` | 배포된 제품이 충족하는 현재 동작 계약 |
| `changes/<change-name>/` | 구현 중인 제안, 설계, delta spec과 task |
| `changes/archive/` | 완료된 변경과 당시의 결정 기록 |
| `config.yaml` | 프로젝트 공통 용어와 명세 작성 규칙 |

Main spec은 현재 시점의 정답을 제공하고 archive는 그 계약이 만들어진 과정을 보관합니다. 제품 동작을 이해하는 데 과거 맥락이 필요할 때만 archive를 참고합니다.

## 명세 읽는 방법

각 `spec.md`는 다음 구조를 사용합니다.

1. **Purpose** — capability가 해결하는 문제와 결과
2. **Requirement** — 구현이 충족해야 하는 규범 계약
3. **Scenario** — 입력 또는 사용자 행동과 관찰 가능한 결과

`MUST`는 필수, `SHOULD`는 강한 권고, `MAY`는 허용 동작을 뜻합니다. Scenario의 `WHEN`은 조건, `THEN`과 `AND`는 검증할 결과입니다.

## 핵심 용어

| 용어 | 의미 |
|---|---|
| LiveSD | 이 프로젝트에서 Spine 계열 모델, runtime, import와 rendering 기능을 가리키는 제품 용어 |
| Source | Skeleton, atlas와 texture를 제공하는 local upload 또는 remote provider |
| Integration | 특정 게임의 source 규칙과 기본 동작을 공통 LiveSD pipeline에 연결하는 module |
| Preview session | 한 source를 parse하고 animation을 WebGL로 재생하는 활성 browser session |
| Framing | `192 × 208` output cell 안의 scale과 X/Y offset |
| Mapping | Codex Pet의 9개 상태를 source animation과 방향 설정에 연결한 값 |
| Recipe | Remote source와 rendering 설정을 기록해 CLI에서 같은 pet을 다시 만드는 JSON 계약 |
| Package | `<pet-id>/pet.json`과 `<pet-id>/spritesheet.png`로 구성된 Codex custom pet v2 결과 |
| Provided source | 앱이 정의한 canonical PRSK viewer snapshot provider |
| Custom provider | 사용자가 입력한 asset base URL의 `catalog.json` provider |
| PRSK | 프로세카 integration의 안정적인 내부 ID |

## Capability map

| Capability | 담당 계약 |
|---|---|
| `web-app-foundation` | Toolchain, 공통 combobox, browser 지원, persistence와 GitHub Pages 배포 |
| `web-ui-localization` | Locale 감지, 선택, 번역과 상태 보존 |
| `game-source-selection` | 게임 registry, 탭과 integration routing |
| `resource-source-selection` | Provided, upload, custom source의 사용자 workflow |
| `prsk-integration-boundary` | PRSK module 소유권과 공통 LiveSD 경계 |
| `prsk-character-archive-import` | Local skeleton과 character ZIP 검증 |
| `prsk-remote-resource-source` | Remote catalog, model URL, 보안과 request lifecycle |
| `livesd-36-preview` | Spine 3.6 parse, WebGL preview와 interaction |
| `livesd-frame-sampling` | 결정적 frame sampling, framing과 alpha 합성 |
| `codex-pet-animation-mapping` | 9개 상태 추천, 검색, 방향과 preview shortcut |
| `codex-pet-look-direction-rendering` | 16방향 pointer look 생성과 선택 |
| `codex-pet-package-export` | Atlas, manifest, ZIP, validator와 package preview |
| `pet-settings-presets` | Browser-local 설정 preset과 session 복원 |
| `npx-pet-installation` | Recipe 기반 rendering과 Codex home 설치 |
| `npm-pet-bundle` | 공개 CLI tarball과 web/CLI 배포 경계 |

## 변경 workflow

```bash
# Main spec 목록
openspec list --specs

# 특정 spec 읽기
openspec show <capability> --type spec

# Main spec 전체 검증
openspec validate --specs --strict

# 변경 검증
openspec validate <change-name> --strict
```

제품 계약을 바꾸는 작업은 새 change에서 시작합니다. 구현과 검증이 완료되면 delta를 main spec에 반영하고 change를 archive합니다. Main spec을 편집할 때는 다음 기준을 적용합니다.

- 현재 지원 동작, 입력, 출력과 오류만 남깁니다.
- 대안 비교, 회의 과정과 일회성 migration 설명은 archive에 둡니다.
- 부정형 비교보다 허용되는 값과 성공 조건을 먼저 정의합니다.
- 보안, 개인정보, 파일 무결성 제한은 허용 범위와 거부 결과를 함께 명시합니다.
- 특정 캐릭터 fixture로 발견한 문제는 renderer 전체에 적용되는 시각 품질 계약으로 일반화합니다.
