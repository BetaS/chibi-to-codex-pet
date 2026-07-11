## MODIFIED Requirements

### Requirement: 구분 가능한 가져오기 오류
`PrskCharacterArchiveImporter`는 실패 조건을 다음 `PrskArchiveImportErrorCode` 값 중 하나와 문제 해결에 필요한 경로를 포함할 수 있는 진단 정보로 반환해야 한다(MUST). enum 값은 안정적인 공개 계약이며 임의의 다른 문자열을 사용해서는 안 된다(MUST NOT). browser UI는 stable code와 진단 정보를 현재 locale의 해결 안내로 표시해야 한다(MUST).

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

#### Scenario: 안정적인 code와 localized message
- **WHEN** importer가 알려진 검증 실패를 반환한다
- **THEN** UI는 위 enum 중 해당 code와 현재 locale의 message를 함께 표시해야 한다
- **AND** 관련 경로가 있으면 번역하지 않은 기술 token으로 message 또는 구조화된 오류 정보에 제공해야 한다
