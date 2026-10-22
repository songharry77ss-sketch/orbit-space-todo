/* ORBIT iOS 앱: ORBIT 웹앱을 전체 화면으로 띄우고, Google 로그인은 iOS 기본 방식으로 대신 처리해 토큰만 넘긴다.
   (Google은 앱 내부 웹뷰에서의 로그인을 막기 때문에)
   마감 알림은 웹이 보내 준 목록으로 기기 로컬 알림을 예약하고, 완료 · 집중 시작에는 촉감 피드백을 준다. */
import { useCallback, useEffect, useRef } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";

const START = "https://orbit-space-todo.vercel.app/?app=ios";
const HOST = "orbit-space-todo.vercel.app";
const IOS_CLIENT_ID = "57190288153-kk82o0on3ma0nbgce3s0ck8jacliquov.apps.googleusercontent.com";
const BASE = ["https://www.googleapis.com/auth/calendar.app.created", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"];
const READ = "https://www.googleapis.com/auth/calendar.events.readonly";

SplashScreen.preventAutoHideAsync().catch(() => {});
GoogleSignin.configure({ iosClientId: IOS_CLIENT_ID, scopes: BASE });
/* 앱을 보고 있을 때도 알림을 배너로 보여 준다 */
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export default function App() {
  const web = useRef(null);
  const send = useCallback(obj => {
    web.current?.injectJavaScript(`window.GCal && GCal.onNative(${JSON.stringify(obj)}); true;`);
  }, []);
  const toWeb = useCallback(obj => {
    web.current?.injectJavaScript(`window.Native && Native.onNative(${JSON.stringify(obj)}); true;`);
  }, []);
  /* 알림을 눌러 앱을 열면 그 할 일을 연다. 앱이 막 켜졌으면 웹이 준비된 뒤(첫 알림 목록이 올 때) 연다 */
  const pendingOpen = useRef(null), queue = useRef(Promise.resolve());
  useEffect(() => {
    const pick = r => r && r.notification && r.notification.request.content.data ? r.notification.request.content.data.id : null;
    try { const id = pick(Notifications.getLastNotificationResponse()); if (id) pendingOpen.current = id; } catch { /* 없음 */ }
    const sub = Notifications.addNotificationResponseReceivedListener(r => { const id = pick(r); if (id) toWeb({ type: "open-task", id }); });
    return () => sub.remove();
  }, [toWeb]);
  const schedule = useCallback(async items => {
    let st = (await Notifications.getPermissionsAsync()).status;
    if (st === "undetermined" && items.length) st = (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })).status;
    toWeb({ type: "notify-perm", status: st });
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (st !== "granted") return;
    const now = Date.now();
    for (const it of items.slice(0, 60)) {
      if (!(it.at > now)) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: String(it.title || "할 일").slice(0, 120), body: String(it.body || ""), sound: true, data: { id: it.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(it.at) },
      });
    }
  }, [toWeb]);
  /* 액세스 토큰은 iOS에서 getTokens()가 만료 전에 알아서 새로 받아 준다 */
  const sendToken = useCallback(async () => {
    const t = await GoogleSignin.getTokens();
    const u = GoogleSignin.getCurrentUser();
    const scopes = (u && u.scopes && u.scopes.length ? u.scopes : BASE).join(" ");
    send({ type: "token", access_token: t.accessToken, expires_in: 3300, scope: scopes, email: u && u.user ? u.user.email : "" });
  }, [send]);
  const onMessage = useCallback(async e => {
    let m;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    try {
      if (m.type === "gcal-auth") {
        if (m.read) {
          const r = GoogleSignin.getCurrentUser() ? await GoogleSignin.addScopes({ scopes: [READ] }) : await GoogleSignin.signIn();
          if (!r || !isSuccessResponse(r)) { send({ type: "cancel" }); return; }
        } else if (m.silent) {
          if (!GoogleSignin.hasPreviousSignIn()) { send({ type: "none" }); return; }
          const r = await GoogleSignin.signInSilently();
          if (!isSuccessResponse(r)) { send({ type: "none" }); return; }
        } else {
          const r = await GoogleSignin.signIn();
          if (!isSuccessResponse(r)) { send({ type: "cancel" }); return; }
        }
        await sendToken();
      } else if (m.type === "reminders") {
        const items = Array.isArray(m.items) ? m.items : [];
        queue.current = queue.current.then(() => schedule(items)).catch(() => {});
        await queue.current;
        if (pendingOpen.current) { toWeb({ type: "open-task", id: pendingOpen.current }); pendingOpen.current = null; }
      } else if (m.type === "haptic") {
        if (m.kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } else if (m.type === "gcal-signout") {
        await GoogleSignin.revokeAccess().catch(() => {});
        await GoogleSignin.signOut().catch(() => {});
      }
    } catch (err) {
      send({ type: "error", message: String((err && err.message) || err) });
    }
  }, [send, sendToken, schedule, toWeb]);
  /* ORBIT 주소 밖으로 가는 링크(구글 캘린더, 개인정보처리방침 등 새 창)는 사파리로 연다 */
  const onNav = useCallback(req => {
    if (req.url.startsWith("about:") || req.url.startsWith("blob:") || req.url.startsWith("data:")) return true;
    try { if (new URL(req.url).host === HOST) return true; } catch { /* 잘못된 주소 */ }
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WebView
        ref={web}
        source={{ uri: START }}
        style={styles.web}
        originWhitelist={["https://*", "about:*", "blob:*", "data:*"]}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onNav}
        setSupportMultipleWindows={false}
        onOpenWindow={e => Linking.openURL(e.nativeEvent.targetUrl).catch(() => {})}
        limitsNavigationsToAppBoundDomains
        injectedJavaScriptBeforeContentLoaded={"window.ORBIT_NATIVE = 'ios'; true;"}
        allowsBackForwardNavigationGestures={false}
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsLinkPreview={false}
        pullToRefreshEnabled={false}
        textInteractionEnabled
        onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        onContentProcessDidTerminate={() => web.current?.reload()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060a" },
  web: { flex: 1, backgroundColor: "#05060a" },
});
