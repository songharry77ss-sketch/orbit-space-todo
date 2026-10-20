# ORBIT iOS 앱 (Expo)

ORBIT 웹앱(https://orbit-space-todo.vercel.app)을 전체 화면 WebView로 띄우는 App Store용 앱입니다. Google 로그인은 앱 내부 웹뷰에서 막혀 있으므로 `@react-native-google-signin/google-signin`(iOS 클라이언트 `57190288153-kk82o0on3ma0nbgce3s0ck8jacliquov`)으로 처리하고 액세스 토큰만 웹앱의 `GCal.onNative()` 로 넘깁니다. 토큰은 iOS가 자동으로 새로 받아 1시간마다 다시 연결할 필요가 없습니다.

- 실제 작업 폴더: `C:\Users\opqrt\orbit-ios` (경로에 한글이 없어야 해서 이 폴더는 백업 사본)
- 번들 ID `com.craving.orbit`, 아이폰 전용, 암호화 면제(HTTPS만 사용), `WKAppBoundDomains` 로 서비스 워커(오프라인) 사용

## 빌드 · 제출

```bash
cd C:\Users\opqrt\orbit-ios
npm install
eas login            # Expo 계정 로그인
eas init             # EAS 프로젝트 연결
eas build -p ios --profile production   # Apple 계정 로그인 · 인증서는 EAS가 관리
eas submit -p ios --latest              # App Store Connect 업로드
```
