import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

const MAX_KEYWORDS = 12;
const MAX_KEYWORD_LEN = 48;

function splitTokens(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeKeyword(value: string): string {
  return value.trim().slice(0, MAX_KEYWORD_LEN);
}

type Props = {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

export function KeywordPillInput({
  keywords,
  onChange,
  placeholder = "Örn: deniz manzarası, 3+1, merkezi konum",
  onFocus,
  onBlur,
}: Props) {
  const [draft, setDraft] = useState("");

  const addKeywords = useCallback(
    (incoming: string[]) => {
      if (!incoming.length) return;
      const seen = new Set(keywords.map((item) => item.toLocaleLowerCase("tr-TR")));
      const next = [...keywords];
      incoming.forEach((raw) => {
        const keyword = normalizeKeyword(raw);
        if (!keyword) return;
        const key = keyword.toLocaleLowerCase("tr-TR");
        if (seen.has(key)) return;
        if (next.length >= MAX_KEYWORDS) return;
        seen.add(key);
        next.push(keyword);
      });
      if (next.length !== keywords.length) onChange(next);
    },
    [keywords, onChange],
  );

  const commitDraft = useCallback(() => {
    const tokens = splitTokens(draft);
    if (!tokens.length) return;
    addKeywords(tokens);
    setDraft("");
  }, [addKeywords, draft]);

  const removeKeyword = useCallback(
    (index: number) => {
      onChange(keywords.filter((_, idx) => idx !== index));
    },
    [keywords, onChange],
  );

  const onChangeDraft = useCallback(
    (value: string) => {
      if (/[,;\n]/.test(value)) {
        const parts = value.split(/[,;\n]+/);
        const tail = parts.pop() ?? "";
        addKeywords(parts);
        setDraft(tail);
        return;
      }
      setDraft(value);
    },
    [addKeywords],
  );

  return (
    <View style={styles.wrap}>
      {keywords.length ? (
        <View style={styles.pillRow}>
          {keywords.map((keyword, index) => (
            <View key={`${keyword}-${index}`} style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>
                {keyword}
              </Text>
              <TouchableOpacity
                onPress={() => removeKeyword(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`${keyword} kelimesini kaldır`}
              >
                <Ionicons name="close" size={14} color="#1e40af" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        value={draft}
        onChangeText={onChangeDraft}
        style={styles.input}
        placeholder={keywords.length >= MAX_KEYWORDS ? "Kelime limiti doldu" : placeholder}
        placeholderTextColor="#94a3b8"
        editable={keywords.length < MAX_KEYWORDS}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={commitDraft}
        onFocus={onFocus}
        onBlur={() => {
          commitDraft();
          onBlur?.();
        }}
      />
      <Text style={styles.hint}>
        Virgülle ayırın veya Enter ile ekleyin · {keywords.length}/{MAX_KEYWORDS}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  pillText: { color: "#1e3a8a", fontWeight: "700", fontSize: 13, maxWidth: 220 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  hint: { color: "#64748b", fontSize: 12, lineHeight: 18 },
});
