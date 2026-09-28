import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../shared/supabase";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({
  scheme: "pickolo-customer",
  path: "auth",
});

function oauthParams(callbackUrl: string) {
  const parsed = new URL(callbackUrl);
  const values = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  fragment.forEach((value, key) => values.set(key, value));
  return values;
}

export default function CustomerAuth() {
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) router.replace("/home");
      else setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) router.replace("/home");
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    if (!supabase) {
      Alert.alert("Pickolo", "Google sign-in is not configured yet.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error("Google sign-in could not be opened.");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type === "cancel" || result.type === "dismiss") return;
      if (result.type !== "success")
        throw new Error("Google sign-in did not complete.");

      const params = oauthParams(result.url);
      const callbackError =
        params.get("error_description") || params.get("error");
      if (callbackError) throw new Error(callbackError);

      const code = params.get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (!accessToken || !refreshToken)
          throw new Error("Google did not return a valid session.");
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
      }

      router.replace("/home");
    } catch (signInError) {
      Alert.alert(
        "Google sign-in",
        signInError instanceof Error
          ? signInError.message
          : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>PICKOLO · BHOPAL</Text>
        <Text style={styles.title}>Great moments start here.</Text>
        <Text style={styles.subtitle}>
          Sign in securely and book a local photographer or videographer.
        </Text>

        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            style={[styles.googleButton, (busy || checking) && styles.disabled]}
            onPress={signInWithGoogle}
            disabled={busy || checking}
          >
            <Text style={styles.googleMark}>G</Text>
            <Text style={styles.googleText}>
              {checking
                ? "Checking your account…"
                : busy
                  ? "Opening Google…"
                  : "Continue with Google"}
            </Text>
          </Pressable>
          <Text style={styles.privacy}>
            Your Google password is never shared with Pickolo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f5f0" },
  container: { flexGrow: 1, justifyContent: "center", padding: 28 },
  kicker: {
    fontSize: 12,
    letterSpacing: 3,
    color: "#496340",
    fontWeight: "700",
  },
  title: { fontSize: 40, color: "#202e29", marginTop: 20 },
  subtitle: { fontSize: 15, color: "#747d70", lineHeight: 24, marginTop: 16 },
  card: {
    backgroundColor: "#fffefb",
    borderWidth: 1,
    borderColor: "#dfe3d7",
    borderRadius: 18,
    padding: 20,
    marginTop: 30,
  },
  googleButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: "#cfd4ca",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 18,
  },
  googleMark: { fontSize: 20, color: "#4285f4", fontWeight: "800" },
  googleText: { color: "#202e29", fontSize: 16, fontWeight: "700" },
  privacy: {
    marginTop: 14,
    color: "#747d70",
    fontSize: 12,
    textAlign: "center",
  },
  disabled: { opacity: 0.55 },
});
