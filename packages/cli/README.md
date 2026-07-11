# chibi-to-codex-pet

`chibi-to-codex-pet`은 LiveSD Pet Builder가 만든 remote recipe를 Codex custom pet v2로 렌더링하고 Codex home에 설치하는 CLI입니다.

## 요구 사항

- Node.js `22.13.0` 이상
- Chromium 또는 Chrome
- Recipe가 참조하는 HTTPS provider에 대한 network 접근

Browser 자동 탐색이 실패하면 `CHIBI_TO_CODEX_PET_CHROMIUM`에 executable의 절대 경로를 지정합니다.

## 사용법

```bash
npx -y chibi-to-codex-pet install --recipe <recipe>
```

`<recipe>`는 base64url JSON, raw JSON 또는 recipe JSON을 반환하는 HTTPS URL을 사용할 수 있습니다. Recipe에는 remote source, Pet metadata, framing, pointer look 이동량과 9개 상태의 animation·mirror mapping이 들어갑니다. CLI는 이 설정으로 source를 불러와 `pet.json`과 `spritesheet.png`를 생성하고 검증합니다.

기본 설치 위치는 `${CODEX_HOME:-$HOME/.codex}/pets/<pet-id>`입니다. 다른 Codex home은 절대 경로로 지정합니다.

```bash
npx -y chibi-to-codex-pet install \
  --recipe <recipe> \
  --codex-home /absolute/path/to/.codex
```

### 설치 전 검증

`--dry-run`은 recipe loading, rendering, package validation과 대상 경로 검사를 실행하고 설치 계획을 출력합니다.

```bash
npx -y chibi-to-codex-pet install --recipe <recipe> --dry-run
```

### 기존 Pet 교체

같은 ID와 동일한 결과는 변경 없이 성공합니다. 같은 ID에 다른 Pet이 있으면 `--force`를 명시해 검증된 결과로 교체할 수 있습니다.

```bash
npx -y chibi-to-codex-pet install --recipe <recipe> --force
```

전체 option은 다음 명령으로 확인합니다.

```bash
npx -y chibi-to-codex-pet --help
```

## 보안과 개인정보

- Remote model은 recipe에 기록된 provider에서 local renderer로 전달됩니다.
- 생성 파일은 선택한 Codex home의 `pets/<pet-id>`에 기록됩니다.
- Package install lifecycle script는 사용하지 않으며 rendering과 filesystem write는 `install` 명령에서 시작됩니다.
- Recipe schema는 metadata와 rendering 설정을 허용하고 binary image, ZIP과 local source path를 입력 범위에서 제외합니다.

## 라이선스

CLI 코드는 [MIT License](LICENSE)로 배포됩니다. Renderer에 포함된 Spine runtime은 package의 third-party notice와 원문 license를 따릅니다.
