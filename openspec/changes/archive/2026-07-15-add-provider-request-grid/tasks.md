## 1. Provider 내비게이션 UI

- [x] 1.1 새 게임 지원 요청 URL과 provider grid 열 수 계산 규칙을 코드로 정의하고 모든 locale의 표시·접근성 문구를 추가한다.
- [x] 1.2 provider tablist 아래에 GitHub issue를 새 탭으로 여는 지원 요청 링크를 렌더링하고 grid 열 수를 provider 개수에 연결한다.
- [x] 1.3 데스크톱 최대 4열과 중간 화면 2열, 작은 화면 1열의 반응형 grid 및 지원 요청 링크 스타일을 구현한다.

## 2. 회귀 방지와 검증

- [x] 2.1 링크 위치·URL·새 탭 보안 속성·접근성 이름과 grid 최대 4열 규칙을 검증하는 애플리케이션 테스트를 추가한다.
- [x] 2.2 관련 테스트, 전체 테스트, 타입 검사, lint, strict OpenSpec 검증과 diff 무결성 검사를 통과시킨다.
