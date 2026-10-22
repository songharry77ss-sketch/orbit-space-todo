# Google OAuth 앱 인증 준비 자료

**현재 상태 (2026-10-20)**: Google Cloud 프로젝트 `orbit-512205` 의 앱이 **프로덕션**으로 게시되어 있습니다. 기본 연결 권한 `calendar.app.created` · `calendar.calendarlist.readonly` 는 Google 분류상 민감하지 않은 범위라 **심사 없이 누구나 경고 없이** 연결합니다. 인증 센터에도 「인증이 필요하지 않습니다」로 표시됩니다.

**업데이트 (2026-10-22)**: 사용자 문의(「내 구글 일정 함께 보기」를 켜면 「Google에서 확인하지 않은 앱」 경고)를 받아, 이 기능의 기본을 `calendar.events.freebusy`(일정 있는 시간대만 · 데이터 액세스 화면에서 **민감하지 않은 범위**로 확인함)로 바꿨습니다. 이제 함께 보기를 켜도 경고가 나오지 않습니다. 제목까지 보는 `calendar.events.readonly` 는 「일정 제목도 보고 싶어요」를 고른 사람만 요청하고, 그 전에 앱 안에서 고급 → 이동 방법을 안내합니다. 아래 2번 심사를 통과하면 제목 보기도 경고 없이 쓸 수 있습니다.

이 문서가 필요한 경우는 두 가지입니다.

1. **브랜드 인증**(동의 화면에 주소 대신 「ORBIT」 이름 표시): Google Search Console에서 `https://orbit-space-todo.vercel.app/` 소유 확인 → 24시간 뒤 Google 인증 플랫폼 → 브랜딩 → 문제 보기 → 「문제를 해결함」 → 계속.
2. **선택 기능 「내 구글 일정 함께 보기」**(`calendar.events.readonly`, 민감한 범위)를 경고 없이 쓰게 하려면: 데이터 액세스에 이 범위를 추가하고 인증 센터에서 검토를 신청합니다. 아래 값 · 문장 · 영상 대본을 씁니다.

## 신청서 값

| 항목 | 값 |
| --- | --- |
| 앱 이름 | ORBIT |
| 앱 홈페이지 | https://orbit-space-todo.vercel.app/about.html |
| 개인정보처리방침 | https://orbit-space-todo.vercel.app/privacy.html |
| 승인된 도메인 | orbit-space-todo.vercel.app (vercel.app 은 공개 접미사 목록에 있어 이 주소가 하나의 도메인으로 취급됨) |
| 도메인 소유 확인 | Google Search Console → URL 접두어 `https://orbit-space-todo.vercel.app/` → HTML 태그 방식. 받은 `google-site-verification` 메타 태그를 index.html · about.html `<head>` 에 넣고 배포 |
| 승인된 JavaScript 원본 | https://orbit-space-todo.vercel.app · https://songharry77ss-sketch.github.io · http://localhost:5173 |

## 범위별 사용 이유 (영어로 제출 · 일정 읽기 범위를 신청할 때)

**https://www.googleapis.com/auth/calendar.app.created**
> ORBIT is a to-do app. When the user connects Google Calendar, ORBIT creates one secondary calendar named "ORBIT 할 일" in the user's account and keeps the user's tasks that have due dates in sync with events in that calendar only: creating, updating and deleting those events when the user adds, edits, completes or deletes tasks in ORBIT, and reading changes the user makes to those events in Google Calendar (date or title changes, deletions, new events) so that ORBIT reflects them. ORBIT never modifies any other calendar.

**https://www.googleapis.com/auth/calendar.events.readonly**
> ORBIT shows the user's existing Google Calendar events next to their tasks in ORBIT's month view, week view and "today" board, so the user can plan tasks around their schedule. Events are only read and displayed in the user's browser; they are never modified, stored on a server or shared. The user can turn this display off in ORBIT's calendar settings.

**https://www.googleapis.com/auth/calendar.calendarlist.readonly**
> ORBIT reads the user's calendar list to find the "ORBIT 할 일" calendar it created earlier (for example when the user connects from a second device, so no duplicate calendar is created), and to choose which calendars' events to display with their colors. The list is only read.

공통 설명:
> ORBIT is a client-side web app with no backend server. All Google API calls are made directly from the user's browser with a short-lived access token obtained through Google Identity Services. No Google user data is transmitted to or stored by the developer. Use of Google user data complies with the Google API Services User Data Policy, including the Limited Use requirements.

## 시연 영상 대본 (화면 녹화 후 YouTube에 '일부 공개'로 올려 링크 제출)

영어 자막이나 영어 설명이 있으면 좋습니다. 1~3분이면 충분합니다.

1. https://orbit-space-todo.vercel.app/about.html 을 보여 주고 「ORBIT 열기」.
2. 할 일 두세 개에 마감일을 넣는 장면.
3. 캘린더 탭 → 「캘린더 연동」 → 「Google 계정으로 연결」. **Google 동의 화면이 나오면 주소창의 `client_id=…` 가 보이도록** 잠시 멈추고, 앱 이름 ORBIT과 요청 범위가 보이게 합니다.
4. 허용 후 ORBIT 캘린더에 Google 일정(읽기 전용 칩)이 함께 보이는 장면 → events.readonly 사용.
5. Google 캘린더(calendar.google.com)를 열어 「ORBIT 할 일」 캘린더와 할 일 일정이 생긴 장면 → app.created 사용.
6. Google 캘린더에서 그 일정 날짜를 옮긴 뒤 ORBIT으로 돌아와 날짜가 바뀐 장면 → app.created 의 읽기 · 반영.
7. ORBIT에서 할 일을 완료하면 Google 일정 제목에 ✓ 가 붙는 장면.
8. 「연결 끊기」를 보여 주며 마무리.

## 참고

- 민감한 범위의 검토는 보통 며칠~몇 주 걸리고, Google이 등록 이메일로 추가 질문을 보낼 수 있습니다.
- 검토가 끝나기 전에도 앱을 프로덕션으로 게시해 두면 사용자 100명까지는 「확인되지 않은 앱」 안내를 거쳐 쓸 수 있습니다.
- 로고를 올리면 브랜드 인증이 추가로 필요하니, 처음에는 로고 없이 신청하는 편이 빠릅니다.
