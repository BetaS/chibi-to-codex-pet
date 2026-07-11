## MODIFIED Requirements

### Requirement: PRSK 캐릭터 ZIP 입력 계약
시스템은 local source mode에서 브라우저로 사용자가 선택한 단일 PRSK 캐릭터 ZIP을 가져와야 하며(MUST), ZIP에는 `.skel` 없이 정확히 하나의 `sekai_atlas.atlas`와 해당 atlas가 참조하는 모든 PNG 페이지가 있어야 한다. 암호화된 파일 항목은 지원하지 않아야 한다(MUST NOT). atlas와 참조 PNG 이외의 여분 파일은 결과에 포함하거나 사용자에게 경고하지 않고 무시해야 하지만(MUST), 모든 아카이브 검증과 자원 제한에는 계속 포함해야 한다(MUST).

#### Scenario: 중첩 디렉터리의 유효한 캐릭터 ZIP
- **WHEN** local mode에서 사용자가 한 디렉터리 아래에 `sekai_atlas.atlas`와 모든 참조 PNG를 포함한 ZIP을 선택한다
- **THEN** 시스템은 중첩 경로와 관계없이 atlas bundle을 성공적으로 가져온다

#### Scenario: development 기본 캐릭터
- **WHEN** development local mode에서 사용자가 캐릭터 ZIP을 선택하지 않았고 `public/assets` symlink의 `sd_mob003` atlas와 참조 PNG가 존재한다
- **THEN** 시스템은 같은 출처의 링크 자산을 정규화된 기본 atlas bundle로 읽고 자동 미리보기를 시작한다

#### Scenario: production local 입력 미선택
- **WHEN** production local mode에서 사용자가 캐릭터 ZIP을 선택하지 않는다
- **THEN** 시스템은 기본 링크 또는 원격 자산을 요청하지 않고 캐릭터 ZIP 선택을 요구한다

#### Scenario: 스켈레톤이 포함된 캐릭터 ZIP
- **WHEN** 캐릭터 ZIP 안에 대소문자와 관계없이 확장자가 `.skel`인 파일이 포함되어 있다
- **THEN** 시스템은 `ARCHIVE_SKEL_FORBIDDEN`으로 가져오기를 거부한다

#### Scenario: 암호화된 ZIP 항목
- **WHEN** 캐릭터 ZIP에 암호화된 파일 항목이 하나라도 있다
- **THEN** 시스템은 비밀번호를 요청하거나 내용을 해제하지 않고 `ARCHIVE_ENCRYPTED_ENTRY`로 전체 가져오기를 거부한다

#### Scenario: 여분 파일
- **WHEN** 유효한 atlas와 참조 PNG 외에 README, thumbnail 또는 기타 미사용 파일이 있다
- **THEN** 시스템은 여분 파일을 bundle에 포함하거나 경고하지 않고 성공하며 해당 파일도 경로·충돌·자원 제한 검사에 포함한다

### Requirement: 정규화된 가져오기 결과
`PrskCharacterArchiveImporter`는 local ZIP의 source 이름, atlas 경로와 원문 및 페이지별 Blob map을 포함한 runtime 독립 `LiveSDAtlasBundle`을 반환해야 한다(MUST). local ZIP 검사와 압축 해제 과정은 사용자의 파일 바이트나 metadata를 외부로 전송하지 않아야 한다(MUST NOT).

```ts
interface LiveSDAtlasBundle {
  sourceName: string;
  atlasPath: string;
  atlasText: string;
  atlasPages: ReadonlyMap<string, Blob>;
}
```

#### Scenario: 가져오기 성공
- **WHEN** local 캐릭터 ZIP이 모든 계약과 검증을 통과한다
- **THEN** `sourceName`은 ZIP 파일명이고 `atlasPath`와 page key는 ZIP 루트 기준 정규화 경로이며 map에는 참조된 `image/png` Blob만 존재한다

#### Scenario: runtime 독립 결과
- **WHEN** importer가 `LiveSDAtlasBundle`을 반환한다
- **THEN** 결과에는 여분 파일, warning 목록, object URL 또는 WebGL·LiveSD runtime 객체가 포함되지 않는다

#### Scenario: local 가져오기 외부 네트워크 차단
- **WHEN** local mode에서 캐릭터 ZIP을 검사하고 압축 해제한다
- **THEN** 시스템은 외부 도메인에 어떤 요청도 보내지 않는다
