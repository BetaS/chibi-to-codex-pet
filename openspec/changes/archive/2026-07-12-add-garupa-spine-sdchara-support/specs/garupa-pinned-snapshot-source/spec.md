## ADDED Requirements

### Requirement: 승인된 bangdream-live2d provider manifest

시스템은 `src/features/livesd/garupa/remote/` 아래의 하나의 frozen typed manifest로 사용자에게 제공할 `bangdream-live2d` snapshot을 정의해야 한다(MUST). Manifest는 `schemaVersion: 1`, stable provider ID, `gameId: "garupa"`, `assetFamily: "sdchara"`, repository URL, 정보용 branch 이름, lowercase 40자리 commit `sourceRevision`, 해당 commit URL, delivery 종류와 base URL, asset index·character metadata path, source region semantics, 예상 runtime profile, catalog SHA-256·byte length와 `licenseStatus`를 포함해야 한다(MUST). `licenseStatus`가 승인 상태가 아닌 manifest는 `experimental`이어야 하고(MUST), 이를 default available game source로 해석해서는 안 된다(MUST NOT).

#### Scenario: 고정 provider manifest
- **WHEN** bundled Garupa provider manifest를 검증한다
- **THEN** repository는 `panxuc/bangdream-live2d`, asset family는 `sdchara`, revision은 정확한 full commit SHA, delivery base는 같은 SHA를 포함한 URL이고 status는 `experimental`이다

#### Scenario: mutable revision 거부
- **WHEN** manifest의 delivery URL이 branch, tag, `latest`, revision 생략 또는 manifest와 다른 commit을 사용한다
- **THEN** provider는 `GARUPA_REMOTE_MANIFEST_INVALID`로 거부되고 catalog request를 시작하지 않는다

#### Scenario: 권리 상태 공개
- **WHEN** 사용자가 pinned Garupa source 설명을 본다
- **THEN** UI는 repository, commit, JP-preferred JP/CN union semantics, 외부 request 발생과 data license 미선언 상태를 manifest에서 표시할 수 있다

### Requirement: Pinned delivery URL과 요청 정책

Provider resolver는 manifest가 승인한 HTTPS origin, repository와 full commit base 아래의 안전한 상대 path만 URL로 만들어야 한다(MUST). Request는 CORS mode, credentials omit, no-referrer, redirect error, timeout·stream byte limit과 명시적 `AbortSignal`을 사용해야 하며(MUST), jsDelivr transport에서는 압축 가능한 파일에 Range header를 보내서는 안 된다(MUST NOT). Manifest에 없는 origin, query, fragment, userinfo, absolute child URL, backslash, 빈·점 segment와 path traversal은 request 전에 거부해야 한다(MUST).

#### Scenario: 승인된 commit URL
- **WHEN** resolver가 `sdchara/_info.json` 또는 선택된 model asset path를 받는다
- **THEN** URL은 manifest와 같은 full commit의 승인된 base 아래에서 생성되고 request는 credentials 없이 전체 body를 읽는다

#### Scenario: 임의 Bestdori URL
- **WHEN** 호출자가 Bestdori, mutable GitHub branch 또는 다른 mirror URL을 child path로 전달한다
- **THEN** resolver는 `GARUPA_REMOTE_URL_INVALID`로 거부하고 해당 origin에 request를 보내지 않는다

### Requirement: 고정 캐릭터와 모델 이중 catalog

Pinned source UI는 사용자가 명시적으로 캐릭터 목록 불러오기를 실행한 generation에서만 manifest에 고정된 `_info.json`과 `characters.all.5.json`을 size·SHA-256 검증과 함께 요청해야 한다(MUST). 시스템은 `_info.json`에 실제 buildData가 존재하는 bundle만 model option으로 만들고(MUST), character metadata의 `sdAssetBundleName`을 locale별 `characterName`과 조인해야 한다(MUST). UI는 고유 캐릭터를 첫 번째 searchable combobox로 표시하고, 선택된 캐릭터에 귀속된 bundle만 두 번째 model combobox에 표시해야 한다(MUST). Exact character가 하나로 결정되지 않는 공유 bundle은 이름을 추측해서는 안 되고(MUST NOT), exact 후보가 없을 때 underscore 앞 base bundle이 정확히 한 primary character로 결정되는 경우에만 같은 이름을 상속할 수 있다(MAY). 이름이 모호하거나 없는 bundle은 별도 미매핑 character group에서 원본 bundle ID로 검색·선택할 수 있어야 한다(MUST).

#### Scenario: 대표 캐릭터명 매핑
- **WHEN** 승인 catalog에서 bundle `00001`을 표시한다
- **THEN** 첫 combobox는 현재 locale의 토야마 카스미를 표시하고 두 번째 model combobox에 `00001`을 표시하며 model 선택값은 내부적으로 `00001`을 유지한다

#### Scenario: 공유 또는 미매핑 bundle
- **WHEN** 한 bundle이 여러 non-primary character에 연결되거나 character metadata에 대응값이 없다
- **THEN** option은 임의 character를 선택하지 않고 별도 미매핑 group 안에서 원본 bundle ID로 검색·선택할 수 있다

#### Scenario: 명시적 2단계 요청
- **WHEN** 사용자가 pinned source를 선택했지만 캐릭터 목록 불러오기를 실행하지 않았다
- **THEN** catalog와 model request는 모두 0건이고 두 combobox는 비활성이다
- **WHEN** 사용자가 목록을 불러와 캐릭터 option을 선택한다
- **THEN** catalog request만 발생하고 model asset request는 0건이다
- **WHEN** 사용자가 두 번째 combobox에서 model을 선택한다
- **THEN** 별도 버튼 없이 해당 model asset request와 preview load가 즉시 시작된다

### Requirement: Snapshot graph materialization

Remote source는 고정 revision의 `_info.json`과 선택 metadata를 검증하고 선택된 `sdAssetBundleName`의 buildData에서 model bundle과 costume texture 연결을 읽어야 한다(MUST). 같은 revision에서 공용 `.skel`, costume `.atlas.txt`와 atlas가 선언한 모든 PNG page를 full GET으로 받아야 하며(MUST), flattened repository filename과 atlas 내부 page 이름의 대소문자·prefix 차이를 안전하게 매핑해 canonical atlas page path로 정규화해야 한다(MUST). 각 file은 size·content type 보조 정보와 format signature를 검증하고 SHA-256을 계산한 뒤 기존 canonical Garupa source handoff를 사용해야 한다(MUST).

#### Scenario: 대표 costume materialization
- **WHEN** approved snapshot에서 `00001` buildData를 선택한다
- **THEN** source는 같은 commit의 `s000_templete` skeleton, `u000_templete` costume atlas와 모든 page를 수집하고 canonical path와 계산된 SHA-256을 가진 source를 반환한다

#### Scenario: atlas page 실제 filename 차이
- **WHEN** atlas의 page 이름과 snapshot의 flattened 또는 lowercase 실제 filename이 다르다
- **THEN** resolver는 `_info.json`의 유일한 대응 file을 찾고 atlas page key를 canonical filename으로 매핑하되 임의 suffix 추측이나 다른 revision fallback을 사용하지 않는다

#### Scenario: shared model key 대소문자 차이
- **WHEN** buildData가 `model/s000_templete_MyGO`를 가리키고 `_info.json`에는 대소문자만 다른 `model/s000_templete_mygo` key가 유일하게 존재한다
- **THEN** resolver는 해당 실제 entry의 asset path를 사용해 shared skeleton을 수집하고 canonical model identity는 buildData의 이름을 보존한다

#### Scenario: shared model key 대소문자 충돌
- **WHEN** `_info.json`의 둘 이상의 key가 buildData model key와 대소문자 정규화 후 같아진다
- **THEN** resolver는 skeleton request 전에 `GARUPA_REMOTE_SNAPSHOT_INVALID`로 실패하고 임의 entry를 선택하지 않는다

#### Scenario: 일부 file 실패
- **WHEN** graph의 file 하나가 누락되거나 hash·size·format 검증에 실패한다
- **THEN** source는 부분 bundle을 노출하지 않고 `GARUPA_REMOTE_SNAPSHOT_INVALID`로 실패하며 모든 임시 Blob과 request를 정리한다

### Requirement: 명시적 remote load와 session-only 상태

Provider manifest를 import하거나 source UI를 mount하는 동작은 external request를 시작해서는 안 된다(MUST NOT). 사용자가 기본 pinned source에서 명시적으로 캐릭터 목록 불러오기를 실행한 현재 generation에서만 catalog request를 시작하고(MUST), 캐릭터 선택 뒤 model option을 선택한 generation에서 model asset request를 즉시 시작해야 한다(MUST). Fetched byte와 선택 상태는 현재 browser memory에서만 유지해야 한다(MUST). 새 remote source가 첫 frame까지 성공하기 전에는 기존 ready source를 교체해서는 안 된다(MUST NOT).

#### Scenario: manifest 표시 전 request 없음
- **WHEN** Garupa UI가 provider label과 pinned revision을 표시한다
- **THEN** 외부 request 수는 0이고 원본 asset byte는 아직 browser memory에 없다

#### Scenario: 명시적 온라인 불러오기
- **WHEN** 사용자가 approved pinned source의 검증된 catalog에서 캐릭터를 선택한 뒤 model을 선택한다
- **THEN** 해당 generation만 승인 origin에 request하고 성공 결과를 canonical importer와 runtime에 전달한다

### Requirement: 비공개 local debug snapshot

개발 도구는 manifest의 정확한 repository와 commit에서 `sdchara` 및 필요한 selection metadata를 sparse backup하고 대표 canonical ZIP과 acquisition receipt를 생성할 수 있어야 한다(MUST). Backup root는 repository, Git 추적, Vite workspace/public root, `public/assets` symlink와 production build 입력 밖의 OS private application-data directory여야 하며(MUST), 환경 변수로 다른 repository 외부 private fixture root를 선택할 수 있어야 한다(MUST). Tool은 repository 내부 root를 거부하고(MUST), target을 owner-only 권한으로 만들며 commit identity, file size·SHA-256과 source path를 기록해야 한다(MUST). Cookie·token·authorization header를 기록해서는 안 된다(MUST NOT).

#### Scenario: 로컬 debug backup 생성
- **WHEN** 개발자가 Garupa debug backup 명령을 실행한다
- **THEN** exact commit의 `sdchara`와 metadata, 대표 canonical ZIP과 receipt가 private fixture root에 생성되고 tracked source와 `public/assets`에는 원본 byte가 없다

#### Scenario: production artifact 검사
- **WHEN** production web·CLI와 tracked repository artifact를 검사한다
- **THEN** provider manifest metadata는 허용되지만 local debug snapshot, `.skel`, atlas, PNG, buildData, Unity bundle과 canonical debug ZIP은 포함되지 않는다

### Requirement: 안정적인 pinned snapshot 오류 계약

Pinned provider와 remote source는 아래 영문 code만 알려진 오류로 사용해야 하며(MUST), 알 수 없는 실패는 `GARUPA_REMOTE_FAILED`로 정규화해야 한다(MUST).

```text
GARUPA_REMOTE_MANIFEST_INVALID
GARUPA_REMOTE_URL_INVALID
GARUPA_REMOTE_NETWORK_OR_CORS
GARUPA_REMOTE_TIMEOUT
GARUPA_REMOTE_ABORTED
GARUPA_REMOTE_RESPONSE_TOO_LARGE
GARUPA_REMOTE_CATALOG_INVALID
GARUPA_REMOTE_BUILDDATA_INVALID
GARUPA_REMOTE_SNAPSHOT_INVALID
GARUPA_REMOTE_FAILED
```

#### Scenario: 알려진 remote 실패
- **WHEN** manifest, URL, network, timeout, abort, size, catalog, buildData 또는 snapshot graph 검증이 실패한다
- **THEN** source는 해당 stable code와 안전한 context를 반환하고 raw response body, cookie, local path와 stack을 노출하지 않는다
