/**
 * AI Drone — üretici/editör ile direct mesaj (self message-threads API).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRoute } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import { selfMessageService, type SelfMessageItem } from "../../services/selfMessageService";

const COLORS = {
  headerBg: "#0f172a",
  pageBg: "#f1f5f9",
  mine: "#3b82f6",
  theirs: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
} as const;

function formatTime(value: string): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

export default function AiDroneEditorChatScreen() {
  const router = useRouter();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const params = (route.params || {}) as {
    threadId?: string;
    editorUserId?: string;
    editorName?: string;
    requestId?: string;
    initialMessage?: string;
  };

  const [threadId, setThreadId] = useState(String(params.threadId || "").trim());
  const [title, setTitle] = useState(String(params.editorName || "Editör").trim() || "Editör");
  const [messages, setMessages] = useState<SelfMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<SelfMessageItem>>(null);

  const loadMessages = useCallback(async (tid: string) => {
    const res = await selfMessageService.listMessages(tid, { limit: 80 });
    if (!res.ok) {
      Alert.alert("Mesajlar", res.error);
      return;
    }
    setMessages(res.data);
    void selfMessageService.markThreadRead(tid);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    let tid = threadId;
    if (!tid) {
      const editorId = Number(params.editorUserId || 0);
      if (!editorId) {
        setLoading(false);
        Alert.alert("Mesaj", "Editör bilgisi eksik.", [{ text: "Tamam", onPress: () => router.back() }]);
        return;
      }
      const reqId = params.requestId ? `#${params.requestId} ` : "";
      const initial =
        params.initialMessage?.trim() ||
        `${reqId}no'lu AI Drone işi hakkında yazıyorum.`;
      const opened = await selfMessageService.openDirectThread(editorId, initial);
      if (!opened.ok) {
        setLoading(false);
        Alert.alert("Mesaj", opened.error);
        return;
      }
      tid = opened.data.threadId;
      setThreadId(tid);
      if (opened.data.counterpartyDisplayName) setTitle(opened.data.counterpartyDisplayName);
    } else {
      const meta = await selfMessageService.getThread(tid);
      if (meta.ok && meta.data.counterpartyDisplayName) setTitle(meta.data.counterpartyDisplayName);
    }
    await loadMessages(tid);
    setLoading(false);
  }, [threadId, params.editorUserId, params.requestId, params.initialMessage, loadMessages, router]);

  useEffect(() => {
    void bootstrap();
  }, []);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !threadId) return;
    setSending(true);
    const res = await selfMessageService.sendMessage(threadId, text);
    setSending(false);
    if (!res.ok) {
      Alert.alert("Gönderilemedi", res.error);
      return;
    }
    setDraft("");
    setMessages((prev) => [...prev, res.data]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [draft, threadId]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {params.requestId ? (
            <Text style={styles.headerSub}>İş #{params.requestId}</Text>
          ) : null}
        </View>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.mine} size="large" />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id || `${m.sentAt}-${m.bodyText.slice(0, 8)}`}
            contentContainerStyle={[styles.listContent, { paddingBottom: 12 }]}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.empty}>Henüz mesaj yok. Aşağıdan yazabilirsiniz.</Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.bubbleWrap, item.isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, item.isMine && styles.bubbleTextMine]}>{item.bodyText}</Text>
                  <Text style={[styles.bubbleTime, item.isMine && styles.bubbleTimeMine]}>{formatTime(item.sentAt)}</Text>
                </View>
              </View>
            )}
          />
          <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
            <TextInput
              style={styles.input}
              placeholder="Mesaj yazın…"
              placeholderTextColor="#94a3b8"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => void onSend()}
              disabled={!draft.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.headerBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: COLORS.headerBg,
  },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#f8fafc" },
  headerSub: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.pageBg },
  listContent: { padding: 12, flexGrow: 1, backgroundColor: COLORS.pageBg },
  empty: { textAlign: "center", color: COLORS.muted, marginTop: 40, fontSize: 14 },
  bubbleWrap: { marginBottom: 8, maxWidth: "85%" },
  bubbleWrapMine: { alignSelf: "flex-end" },
  bubbleWrapTheirs: { alignSelf: "flex-start" },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  bubbleMine: { backgroundColor: COLORS.mine },
  bubbleTheirs: { backgroundColor: COLORS.theirs },
  bubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
  bubbleTextMine: { color: "#fff" },
  bubbleTime: { fontSize: 10, color: COLORS.muted, marginTop: 6, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: "#f8fafc",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.mine,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
});
