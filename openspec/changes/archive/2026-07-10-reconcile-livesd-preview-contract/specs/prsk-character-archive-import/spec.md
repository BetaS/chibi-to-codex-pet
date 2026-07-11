## MODIFIED Requirements

### Requirement: PRSK 캐릭터 ZIP 입력 계약
시스템은 브라우저에서 사용자가 선택한 단일 PRSK 캐릭터 ZIP을 가져와야 하며(MUST), ZIP에는 `.skel` 없이 정확히 하나의 `sekai_atlas.atlas`와 해당 atlas가 참조하는 모든 PNG 페이지가 있어야 한다. 암호화된 파일 항목은 지원하지 않아야 한다(MUST NOT). atlas와 참조 PNG 이외의 여분 파일은 결과에 포함하거나 사용자에게 경고하지 않고 무시해야 하지만(MUST), 모든 아카이브 검증과 자원 제한에는 계속 포함해야 한다(MUST).

#### Scenario: 중첩 디렉터리의 유효한 캐릭터 ZIP
- **WHEN** 사용자가 한 디렉터리 아래에 `sekai_atlas.atlas`와 모든 참조 PNG를 포함한 ZIP을 선택한다
- **THEN** 시스템은 중첩 경로와 관계없이 atlas bundle을 성공적으로 가져온다

#### Scenario: development 기본 캐릭터
- **WHEN** development에서 사용자가 캐릭터 ZIP을 선택하지 않았고 `public/assets` symlink의 `sd_mob003` atlas와 참조 PNG가 존재한다
- **THEN** 시스템은 같은 출처의 링크 자산을 정규화된 기본 atlas bundle로 읽고 자동 미리보기를 시작한다

#### Scenario: production 입력 미선택
- **WHEN** production에서 사용자가 캐릭터 ZIP을 선택하지 않는다
- **THEN** 시스템은 기본 링크 자산을 요청하지 않고 캐릭터 ZIP 선택을 요구한다

#### Scenario: 스켈레톤이 포함된 캐릭터 ZIP
- **WHEN** 캐릭터 ZIP 안에 대소문자와 관계없이 확장자가 `.skel`인 파일이 포함되어 있다
- **THEN** 시스템은 `ARCHIVE_SKEL_FORBIDDEN`으로 가져오기를 거부한다

#### Scenario: 암호화된 ZIP 항목
- **WHEN** 캐릭터 ZIP에 암호화된 파일 항목이 하나라도 있다
- **THEN** 시스템은 비밀번호를 요청하거나 내용을 해제하지 않고 `ARCHIVE_ENCRYPTED_ENTRY`로 전체 가져오기를 거부한다

#### Scenario: 여분 파일
- **WHEN** 유효한 atlas와 참조 PNG 외에 README, thumbnail 또는 기타 미사용 파일이 있다
- **THEN** 시스템은 여분 파일을 bundle에 포함하거나 경고하지 않고 성공하며 해당 파일도 경로·충돌·자원 제한 검사에 포함한다

### Requirement: atlas 이미지 페이지 해석
시스템은 atlas를 strict UTF-8 텍스트로 읽고(MUST), 하나 이상의 이미지 페이지를 찾아야 한다(MUST). 선언된 페이지 경로는 atlas 파일의 디렉터리를 기준으로 해석하고 모든 참조가 ZIP 안의 PNG 항목과 일치하는지 검증해야 하며(MUST), 정규화 후 동일한 페이지를 두 번 참조해서는 안 된다(MUST NOT).

#### Scenario: 모든 atlas 페이지가 존재함
- **WHEN** atlas가 하나 이상의 PNG 페이지를 참조하고 모든 파일이 상대 경로에 존재한다
- **THEN** 시스템은 정규화된 페이지 경로와 `image/png` Blob을 연결한 읽기 전용 map을 생성한다

#### Scenario: atlas가 유효한 UTF-8이 아님
- **WHEN** `sekai_atlas.atlas` 바이트를 strict UTF-8 텍스트로 해석할 수 없다
- **THEN** 시스템은 `ATLAS_INVALID_TEXT`로 가져오기를 거부한다

#### Scenario: atlas 페이지 목록이 비어 있음
- **WHEN** atlas에서 유효한 이미지 페이지 선언을 하나도 찾을 수 없다
- **THEN** 시스템은 `ATLAS_PAGE_LIST_EMPTY`로 가져오기를 거부한다

#### Scenario: 참조 이미지가 누락됨
- **WHEN** atlas가 참조하는 PNG 페이지 중 하나가 ZIP에 없다
- **THEN** 시스템은 누락된 정규화 경로를 포함한 `ATLAS_PAGE_MISSING`을 반환한다

#### Scenario: PNG가 아닌 페이지를 참조함
- **WHEN** atlas의 페이지 참조 확장자가 대소문자와 관계없이 `.png`가 아니다
- **THEN** 시스템은 `ATLAS_UNSUPPORTED_PAGE_FORMAT`으로 가져오기를 거부한다

#### Scenario: 동일한 페이지를 중복 참조함
- **WHEN** 서로 다른 atlas 페이지 표기가 정규화 후 동일한 PNG 경로가 된다
- **THEN** 시스템은 `ATLAS_DUPLICATE_PAGE`로 가져오기를 거부한다

### Requirement: 안전한 아카이브 경로
시스템은 ZIP 항목과 atlas 페이지 경로의 역슬래시를 슬래시로 바꾼 뒤 `.`과 `..` segment를 정규화해야 한다(MUST). 루트 밖을 가리키는 경로, 절대 경로, 드라이브 문자, NUL, 빈 정규화 경로 및 정규화 후 중복 경로를 거부해야 한다(MUST). 이 검사는 결과에 사용하지 않는 여분 파일에도 동일하게 적용해야 한다(MUST).

#### Scenario: Windows 경로 구분자
- **WHEN** 유효한 ZIP 항목 또는 atlas 페이지가 `character\\textures\\page.png`처럼 역슬래시를 사용한다
- **THEN** 시스템은 이를 `character/textures/page.png`로 정규화한 뒤 나머지 검증을 수행한다

#### Scenario: 상위 디렉터리 탈출
- **WHEN** ZIP 항목 또는 atlas 페이지가 `../`를 사용해 아카이브 루트 밖을 가리킨다
- **THEN** 시스템은 `ARCHIVE_UNSAFE_PATH`로 전체 가져오기를 중단한다

#### Scenario: 정규화 경로 충돌
- **WHEN** 서로 다른 ZIP 항목이 구분자와 segment 정규화 후 동일한 경로가 된다
- **THEN** 시스템은 `ARCHIVE_PATH_COLLISION`으로 전체 가져오기를 거부한다

#### Scenario: 여분 파일의 안전하지 않은 경로
- **WHEN** 미리보기에 사용하지 않는 파일의 경로가 안전한 경로 계약을 위반한다
- **THEN** 시스템은 해당 파일을 조용히 무시하지 않고 `ARCHIVE_UNSAFE_PATH`로 전체 가져오기를 거부한다

### Requirement: ZIP 자원 제한
시스템은 압축 ZIP 32MiB, 압축 해제 후 모든 파일 합계 64MiB, 디렉터리를 제외한 파일 항목 32개의 제한을 모두 적용해야 한다(MUST). atlas와 참조 PNG에 사용하지 않는 여분 파일도 파일 수와 압축 해제 합계에 포함해야 한다(MUST).

#### Scenario: 압축 파일 크기 초과
- **WHEN** 선택한 ZIP의 크기가 32MiB를 초과한다
- **THEN** 시스템은 압축 해제 전에 `ARCHIVE_TOO_LARGE`를 반환한다

#### Scenario: 압축 해제 합계 초과
- **WHEN** ZIP metadata에 따른 모든 파일 크기 합계가 64MiB를 초과한다
- **THEN** 시스템은 파일 내용을 모두 메모리에 적재하기 전에 `ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED`로 중단한다

#### Scenario: 항목 수 초과
- **WHEN** ZIP이 디렉터리를 제외하고 32개보다 많은 파일을 포함한다
- **THEN** 시스템은 `ARCHIVE_ENTRY_LIMIT_EXCEEDED`를 반환한다

#### Scenario: 여분 파일로 제한 초과
- **WHEN** atlas·참조 PNG는 제한 안이지만 여분 파일을 포함한 전체 파일 수 또는 해제 합계가 제한을 초과한다
- **THEN** 시스템은 여분 파일을 제외해 성공시키지 않고 해당 자원 제한 오류를 반환한다

### Requirement: 정규화된 가져오기 결과
`PrskCharacterArchiveImporter`는 source 이름, atlas 경로와 원문 및 페이지별 Blob map을 포함한 runtime 독립 `LiveSDAtlasBundle`을 반환해야 한다(MUST). 가져오기 과정은 사용자의 파일 바이트나 metadata를 외부로 전송하지 않아야 한다(MUST NOT).

```ts
interface LiveSDAtlasBundle {
  sourceName: string;
  atlasPath: string;
  atlasText: string;
  atlasPages: ReadonlyMap<string, Blob>;
}
```

#### Scenario: 가져오기 성공
- **WHEN** 캐릭터 ZIP이 모든 계약과 검증을 통과한다
- **THEN** `sourceName`은 ZIP 파일명이고 `atlasPath`와 page key는 ZIP 루트 기준 정규화 경로이며 map에는 참조된 `image/png` Blob만 존재한다

#### Scenario: runtime 독립 결과
- **WHEN** importer가 `LiveSDAtlasBundle`을 반환한다
- **THEN** 결과에는 여분 파일, warning 목록, object URL 또는 WebGL·LiveSD runtime 객체가 포함되지 않는다

#### Scenario: 외부 네트워크 차단
- **WHEN** 캐릭터 ZIP을 검사하고 압축 해제한다
- **THEN** 시스템은 외부 도메인에 어떤 요청도 보내지 않는다

### Requirement: 구분 가능한 가져오기 오류
`PrskCharacterArchiveImporter`는 실패 조건을 다음 `PrskArchiveImportErrorCode` 값 중 하나와 문제 해결에 필요한 경로를 포함할 수 있는 한국어 메시지로 반환해야 한다(MUST). enum 값은 안정적인 공개 계약이며 임의의 다른 문자열을 사용해서는 안 된다(MUST NOT).

```text
ARCHIVE_CORRUPT
ARCHIVE_ENCRYPTED_ENTRY
ARCHIVE_ENTRY_LIMIT_EXCEEDED
ARCHIVE_PATH_COLLISION
ARCHIVE_SKEL_FORBIDDEN
ARCHIVE_TOO_LARGE
ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED
ARCHIVE_UNSAFE_PATH
ATLAS_DUPLICATE_PAGE
ATLAS_INVALID_TEXT
ATLAS_MISSING
ATLAS_MULTIPLE
ATLAS_PAGE_LIST_EMPTY
ATLAS_PAGE_MISSING
ATLAS_UNSUPPORTED_PAGE_FORMAT
```

#### Scenario: 손상된 ZIP
- **WHEN** 선택한 파일을 ZIP으로 해석할 수 없거나 ZIP metadata가 유효하지 않다
- **THEN** 시스템은 다른 검증 오류와 구분되는 `ARCHIVE_CORRUPT`를 반환한다

#### Scenario: 안정적인 code와 한국어 message
- **WHEN** importer가 알려진 검증 실패를 반환한다
- **THEN** UI는 위 enum 중 해당 code와 한국어 message를 함께 표시하고 관련 경로가 있으면 message 또는 구조화된 오류 정보로 제공한다
