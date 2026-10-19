# ORBIT 우주 할 일

행성은 카테고리, 위성은 할 일. 할 일을 가운데 태양으로 끌어오면 불타오르며 집중이 시작되는 우주 테마 투두리스트입니다.
외부 라이브러리 없이 HTML · CSS · JavaScript 만으로 만들어졌고, 데이터는 브라우저(localStorage)에 저장됩니다.

## 실행

| 방법 | 설명 |
| --- | --- |
| 바로 열기 | `index.html` 을 더블클릭 (Chrome · Edge · Safari · 삼성 인터넷) |
| 로컬 서버 | 폴더에서 `npx serve .` 또는 `python -m http.server 8080` 후 `http://localhost:8080` |
| 배포 | 폴더 전체를 GitHub Pages · Netlify · Vercel 등 아무 정적 호스팅에 올리면 끝 (https 필요) |

설치형 앱(PWA)과 오프라인 사용은 **https 또는 localhost** 로 열었을 때 동작합니다. 파일을 직접 열면 일반 웹페이지로 동작합니다.

## 기기별 설치 (앱처럼 사용하기)

| 기기 | 방법 |
| --- | --- |
| Windows / Mac (Chrome · Edge) | 주소창 오른쪽 **설치** 아이콘 → 바탕화면 · 시작 메뉴에 앱으로 등록 |
| Mac (Safari 17+) | 파일 메뉴 → **Dock에 추가** |
| 갤럭시 / Android (Chrome · 삼성 인터넷) | 메뉴(⋮) → **홈 화면에 추가** 또는 **앱 설치** |
| iPhone / iPad (Safari) | 하단 **공유** 버튼 → **홈 화면에 추가** |

앱 안의 ⚙ 설정에서도 설치 버튼이 뜹니다(브라우저가 지원할 때).

### App Store · Play Store 에 올리려면

이 프로젝트는 그대로 PWA 로 배포되며, 스토어 등록이 필요하면 네이티브 껍데기로 감싸면 됩니다.

```bash
npm init -y && npm i @capacitor/core @capacitor/cli
npx cap init "ORBIT" "com.example.orbit" --web-dir .
npx cap add ios      # Xcode 필요 (Mac)
npx cap add android  # Android Studio 필요
npx cap open ios / android
```

Android 는 PWABuilder(https://www.pwabuilder.com) 로 배포 URL 만 넣어 TWA 패키지를 만들어 Play Store 에 올릴 수도 있습니다.

## 사용법

- **오늘** (기본): 오늘 마감 · 지난 할 일 · 오늘 할 일로 표시한 것만 위성으로 보임
- **전체**: 모든 미완료 할 일
- **캘린더**: 월 단위 보기. 날짜 클릭 → 그 날 목록, 할 일을 다른 날짜로 드래그하면 마감일 이동
- 위성을 **태양으로 드래그** → 집중 시작(타이머). 여러 개 동시에 가능. 칩의 ✓ 로 완료
- 칩을 행성으로 드래그 → 궤도로 복귀(타이머 일시정지). 위성을 다른 행성으로 드래그 → 카테고리 이동
- 행성 클릭 → 그 행성의 목록. 태양 또는 우측 상단 진행 링 클릭 → 오늘의 미션(제안 포함)
- 하단 입력창: `#행성` `!`(중요) 「내일」「다음주 금요일」「오후 3시」「12/25」 등을 알아들음
- 휴대폰: 행성 주변 궤도 영역을 탭하면 위성이 멈추고 펼쳐짐 → 탭해서 열거나 태양으로 드래그

단축키 · `N` 새 할 일 · `/` 검색 · `1` `2` `3` 보기 전환 · `T` 오늘의 미션 · `Esc` 닫기

## 가져온 기능

- Microsoft To Do: 나의 하루(오늘 할 일) · 제안 · 중요 표시 · 단계 · 반복 · 메모 · 목록 색/이모지
- Google Tasks: 빠른 추가 · 날짜/시간 · 하위 작업 · 캘린더 연동 보기 · 심플한 완료/복구
- 추가: 집중 타이머(태양), 일일 진행 링, 실행 취소 토스트, 자연어 날짜 파싱, JSON 내보내기/가져오기

## 구조

```
index.html             마크업
css/style.css          디자인 토큰 · 태양/행성/위성 · 패널 · 캘린더 · 반응형
js/utils.js            날짜 · 포맷 · 빠른 추가 파서
js/store.js            상태 · localStorage · 예시 데이터
js/sky.js              별하늘 캔버스 · 파티클(불씨, 초신성)
js/scene.js            태양 · 행성계 · 위성 공전 · 드래그 앤 드롭
js/mobile.js           좁은 화면 배치 · 터치 동작
js/panel.js            상세 패널 · 행성 목록 · 날짜 · 오늘의 미션
js/calendar.js         월 캘린더
js/app.js              초기화 · 보기 전환 · 빠른 추가 · 검색 · 모달 · PWA
manifest.webmanifest   설치형 앱 정보
sw.js                  오프라인 캐시(서비스 워커)
icons/                 앱 아이콘
```
