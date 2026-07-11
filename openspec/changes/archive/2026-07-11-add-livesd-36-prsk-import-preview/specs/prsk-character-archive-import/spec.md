## ADDED Requirements

### Requirement: PRSK 캐릭터 ZIP 입력 계약
시스템은 브라우저에서 사용자가 선택한 단일 PRSK 캐릭터 ZIP을 가져와야 하며(MUST), ZIP에는 `.skel` 없이 정확히 하나의 `sekai_atlas.atlas`와 해당 atlas가 참조하는 모든 PNG 페이지가 있어야 한다.

#### Scenario: 중첩 디렉터리의 유효한 캐릭터 ZIP
- **WHEN** 사용자가 한 디렉터리 아래에 `sekai_atlas.atlas`와 모든 참조 PNG를 포함한 ZIP을 선택한다
- **THEN** 시스템은 중첩 경로와 관계없이 캐릭터 팩을 성공적으로 가져온다

#### Scenario: development 기본 캐릭터
- **WHEN** development에서 사용자가 캐릭터 ZIP을 선택하지 않았고 `public/assets` symlink의 `sd_mob003` atlas와 참조 PNG가 존재한다
- **THEN** 시스템은 같은 출처의 링크 자산을 정규화된 기본 캐릭터 팩으로 읽고 자동 미리보기를 시작한다

#### Scenario: production 입력 미선택
- **WHEN** production에서 사용자가 캐릭터 ZIP을 선택하지 않는다
- **THEN** 시스템은 기본 링크 자산을 요청하지 않고 캐릭터 ZIP 선택을 요구한다

#### Scenario: 스켈레톤이 포함된 캐릭터 ZIP
- **WHEN** 캐릭터 ZIP 안에 확장자가 `.skel`인 파일이 포함되어 있다
- **THEN** 시스템은 공통 스켈레톤 분리 계약을 위반했다는 오류로 가져오기를 거부한다

### Requirement: 단일 atlas 검증
시스템은 파일명이 정확히 `sekai_atlas.atlas`인 항목이 하나일 때만 가져오기를 허용해야 한다(MUST).

#### Scenario: atlas가 없음
- **WHEN** ZIP 안에 `sekai_atlas.atlas`가 없다
- **THEN** 시스템은 필요한 atlas가 없다는 오류를 반환한다

#### Scenario: atlas가 여러 개임
- **WHEN** ZIP 안에 서로 다른 경로의 `sekai_atlas.atlas`가 두 개 이상 있다
- **THEN** 시스템은 하나의 캐릭터만 지원한다는 오류를 반환한다

### Requirement: atlas 이미지 페이지 해석
시스템은 atlas에 선언된 페이지 경로를 atlas 파일의 디렉터리를 기준으로 해석하고, 모든 참조가 ZIP 안의 PNG 항목과 일치하는지 검증해야 한다(MUST).

#### Scenario: 모든 atlas 페이지가 존재함
- **WHEN** atlas가 하나 이상의 PNG 페이지를 참조하고 모든 파일이 상대 경로에 존재한다
- **THEN** 시스템은 페이지 이름과 Blob을 연결한 읽기 전용 map을 생성한다

#### Scenario: 참조 이미지가 누락됨
- **WHEN** atlas가 참조하는 PNG 페이지 중 하나가 ZIP에 없다
- **THEN** 시스템은 누락된 정규화 경로를 포함한 오류를 반환한다

#### Scenario: PNG가 아닌 페이지를 참조함
- **WHEN** atlas의 페이지 참조 확장자가 `.png`가 아니다
- **THEN** 시스템은 지원하지 않는 이미지 형식 오류로 가져오기를 거부한다

### Requirement: 안전한 아카이브 경로
시스템은 ZIP 항목과 atlas 페이지 경로를 정규화하고 루트 밖을 가리키는 경로, 절대 경로, 드라이브 문자, NUL 및 정규화 후 중복 경로를 거부해야 한다(MUST).

#### Scenario: 상위 디렉터리 탈출
- **WHEN** ZIP 항목 또는 atlas 페이지가 `../`를 사용해 아카이브 루트 밖을 가리킨다
- **THEN** 시스템은 안전하지 않은 경로 오류로 전체 가져오기를 중단한다

#### Scenario: 정규화 경로 충돌
- **WHEN** 서로 다른 ZIP 항목이 정규화 후 동일한 경로가 된다
- **THEN** 시스템은 모호한 파일 해석을 방지하기 위해 전체 가져오기를 거부한다

### Requirement: ZIP 자원 제한
시스템은 압축 ZIP 32MiB, 압축 해제 후 파일 합계 64MiB, 파일 항목 32개의 제한을 모두 적용해야 한다(MUST).

#### Scenario: 압축 파일 크기 초과
- **WHEN** 선택한 ZIP의 크기가 32MiB를 초과한다
- **THEN** 시스템은 압축 해제 전에 크기 제한 오류를 반환한다

#### Scenario: 압축 해제 합계 초과
- **WHEN** ZIP 메타데이터에 따른 파일 크기 합계가 64MiB를 초과한다
- **THEN** 시스템은 파일 내용을 모두 메모리에 적재하기 전에 가져오기를 중단한다

#### Scenario: 항목 수 초과
- **WHEN** ZIP이 디렉터리를 제외하고 32개보다 많은 파일을 포함한다
- **THEN** 시스템은 항목 수 제한 오류를 반환한다

### Requirement: 정규화된 가져오기 결과
`PrskCharacterArchiveImporter`는 archive 이름, atlas 경로와 원문, 페이지별 Blob map 및 경고 목록을 포함한 `PrskCharacterPack`을 반환해야 한다(MUST). 가져오기 과정은 사용자의 파일 바이트나 메타데이터를 외부로 전송하지 않아야 한다(MUST NOT).

#### Scenario: 가져오기 성공
- **WHEN** 캐릭터 ZIP이 모든 계약과 검증을 통과한다
- **THEN** 시스템은 런타임 객체나 object URL을 포함하지 않는 정규화된 `PrskCharacterPack`을 반환한다

#### Scenario: 외부 네트워크 차단
- **WHEN** 캐릭터 ZIP을 검사하고 압축 해제한다
- **THEN** 시스템은 외부 도메인에 어떤 요청도 보내지 않는다

### Requirement: 구분 가능한 가져오기 오류
시스템은 손상 ZIP, 입력 계약 위반, 안전하지 않은 경로, 자원 제한 및 누락 atlas 페이지를 서로 구분할 수 있는 오류 코드와 사용자 메시지로 반환해야 한다(MUST).

#### Scenario: 손상된 ZIP
- **WHEN** 선택한 파일을 ZIP으로 해석할 수 없다
- **THEN** 시스템은 다른 검증 오류와 구분되는 손상 ZIP 오류를 반환한다
