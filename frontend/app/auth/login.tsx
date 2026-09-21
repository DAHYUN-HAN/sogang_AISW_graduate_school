import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { authApi } from "../../services/api";
import { useUserStore } from "../../stores/userStore";
import MigrationNoticeModal from "../../components/MigrationNoticeModal";
import SchoolEmailInput from "../../components/SchoolEmailInput";
import { composeSchoolEmail, emailIdError } from "../../utils/authValidation";
import { dismissMigrationNoticeForNow, hideMigrationNoticeForever, isMigrationNoticeHidden } from "../../utils/migrationNotice";

const COLORS = {
  primary: "#2761FF", // primary/500
  text: "#15171C", // gray/900 (Figma)
  muted: "#6B7280", // gray/600
  subtle: "#A6ACB7", // placeholder
  border: "#E1E4E9", // border/default
  danger: "#DC2626",
  bg: "#FFFFFF",
};

type LoginErrors = {
  email?: string;
  password?: string;
  form?: string;
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [emailId, setEmailId] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setSession = useUserStore((state) => state.setSession);
  // 구버전 앱 사용자는 로그인이 안 된다. 게스트가 닿는 화면이 여기뿐이라 여기서 알린다.
  const [migrationNoticeVisible, setMigrationNoticeVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void isMigrationNoticeHidden().then((hidden) => {
      if (active && !hidden) setMigrationNoticeVisible(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async () => {
    if (isSubmitting) return;
    const nextEmailError = emailIdError(emailId);
    const nextPasswordError = password ? undefined : "비밀번호를 입력해주세요.";
    if (nextEmailError || nextPasswordError) {
      setErrors({ email: nextEmailError ?? undefined, password: nextPasswordError });
      return;
    }

    try {
      setIsSubmitting(true);
      setErrors({});
      const response = await authApi.login({ email: composeSchoolEmail(emailId), password });
      setSession(response.data);
      router.replace("/(tabs)/home");
    } catch {
      setErrors({ form: "이메일 또는 비밀번호가 일치하지 않아요." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 18) }]}>
        {/* Figma TopBar: 좌우 모두 아이콘 없는 22x22 자리다. 제목만 가운데 남는다. */}
        <View style={styles.iconButton} />
        <Text style={styles.appBarTitle}>로그인</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView style={styles.scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>이메일</Text>
          <SchoolEmailInput
            value={emailId}
            onChangeText={(value) => {
              setEmailId(value);
              setErrors((current) => ({ ...current, email: undefined, form: undefined }));
            }}
            hasError={Boolean(errors.email || errors.form)}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            onBlur={() => setIsPasswordFocused(false)}
            onChangeText={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined, form: undefined }));
            }}
            onFocus={() => setIsPasswordFocused(true)}
            onSubmitEditing={() => void handleLogin()}
            placeholder="비밀번호"
            placeholderTextColor={COLORS.subtle}
            returnKeyType="go"
            secureTextEntry
            style={[
              styles.input,
              isPasswordFocused && !errors.password && !errors.form ? styles.inputFocused : null,
              errors.password || errors.form ? styles.inputError : null,
              { outlineStyle: "none" } as never,
            ]}
            submitBehavior="submit"
            value={password}
          />
        </View>

        {errors.form || errors.email || errors.password ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
            <Text style={styles.errorText}>{errors.form ?? errors.email ?? errors.password}</Text>
          </View>
        ) : null}

        <Pressable disabled={isSubmitting} onPress={handleLogin} style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}>
          <Text style={styles.primaryButtonText}>{isSubmitting ? "로그인 중" : "로그인"}</Text>
        </Pressable>

        <View style={styles.links}>
          <Pressable onPress={() => router.push("/auth/register")}>
            <Text style={styles.linkText}>회원가입</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/auth/password-reset")}>
            <Text style={styles.linkText}>비밀번호 찾기</Text>
          </Pressable>
        </View>
      </ScrollView>

      <MigrationNoticeModal
        visible={migrationNoticeVisible}
        onClose={() => {
          dismissMigrationNoticeForNow();
          setMigrationNoticeVisible(false);
        }}
        onRegister={() => {
          dismissMigrationNoticeForNow();
          setMigrationNoticeVisible(false);
          router.push("/auth/register");
        }}
        onHideForever={() => {
          void hideMigrationNoticeForever();
          setMigrationNoticeVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  appBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconButton: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "500", // Figma: Inter Medium
  },
  scroller: { flex: 1 },
  content: {
    gap: 20, // Figma body gap
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  field: {
    gap: 6, // Figma label→input gap
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500", // Figma: Inter Medium
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400", // Figma: Inter Regular
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: "#FFF5F5",
  },
  inputFocused: {
    borderColor: COLORS.primary,
  },
  primaryButton: {
    height: 48,
    outlineStyle: "none" as never,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -8,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500", // Figma: Inter Medium
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  linkText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "500", // Figma: Inter Medium
  },
});
