import React, { useEffect, useState } from "react";
import { View, Image, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { API_URL } from "../../../config/api";
import { storageService } from "../../../services/storageService";
import { adminColors } from "../../../styles/admin/common";

type Props = {
  url: string | null | undefined;
  label?: string;
  height?: number;
};

function resolveUrl(raw: string): string {
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = API_URL.replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

export function DocumentPreview({ url, label = "Belge", height = 220 }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [authHeader, setAuthHeader] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!url) {
        setResolved(null);
        setAuthHeader(undefined);
        return;
      }
      setLoading(true);
      setFailed(false);
      const absolute = resolveUrl(url);
      const token = await storageService.getAccessToken();
      if (!cancelled) {
        setResolved(absolute);
        setAuthHeader(token ? `Bearer ${token}` : undefined);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) {
    return (
      <View style={[styles.box, { height }]}>
        <Text style={styles.empty}>Belge yok</Text>
      </View>
    );
  }

  const openExternal = () => {
    if (resolved) Linking.openURL(resolved).catch(() => {});
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={openExternal} style={[styles.box, { height }]}>
      {loading ? (
        <ActivityIndicator color={adminColors.accent} />
      ) : failed || !resolved ? (
        <Text style={styles.empty}>{label} — dokunup aç</Text>
      ) : (
        <Image
          source={{
            uri: resolved,
            headers: authHeader ? { Authorization: authHeader } : undefined,
          }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#0b1220",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 8,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  empty: {
    color: adminColors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    padding: 12,
  },
});
