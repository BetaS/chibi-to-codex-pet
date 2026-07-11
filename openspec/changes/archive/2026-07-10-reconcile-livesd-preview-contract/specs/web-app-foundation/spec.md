## MODIFIED Requirements

### Requirement: 후속 기능 확장 경계
Vite와 React 기반은 후속 LiveSD 변경이 개발 middleware와 feature 컴포넌트를 추가할 수 있어야 한다(MUST). foundation 계층은 LiveSD runtime, 전역 `spine` API 또는 PRSK 모델 자산을 직접 소유하거나 접근해서는 안 되지만(MUST NOT), LiveSD feature 계층은 고정 runtime과 필수 배포 고지를 production에 포함할 수 있어야 한다(MUST). production build는 어떤 경우에도 PRSK 모델 파일을 포함해서는 안 된다(MUST NOT).

#### Scenario: foundation 계층 검사
- **WHEN** foundation shell과 공통 설정의 source dependency를 검사한다
- **THEN** foundation 계층은 vendoring된 runtime이나 전역 `spine` API를 직접 import·참조하지 않고 feature 경계를 통해 확장된다

#### Scenario: LiveSD feature가 활성화된 production build
- **WHEN** LiveSD 미리보기 feature를 포함해 production build를 만든다
- **THEN** build는 feature가 공급하는 고정 `spine-webgl.js`, 원문 LICENSE와 third-party notices를 포함한다

#### Scenario: production 모델 자산 제외
- **WHEN** development에서 `public/assets` symlink와 로컬 PRSK 자산을 사용한 뒤 production build를 만든다
- **THEN** build 산출물에는 `.skel`, `sekai_atlas.atlas` 또는 PRSK PNG 모델 파일이 포함되지 않는다
