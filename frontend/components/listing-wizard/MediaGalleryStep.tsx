import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { ListingWizardForm } from "../../src/types/listingWizard";
import { uploadListingMedia, patchListingContent } from "../../services/listingWizardService";
import { resolveMediaUrl } from "../../src/utils/resolveMediaUrl";

type Props = {
  listingId: string;
  form: ListingWizardForm;
  version: number;
  updateForm: (patch: Partial<ListingWizardForm>) => void;
  onWizardUpdate: (media: ListingWizardForm["listingMedia"], version: number) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
};

export default function MediaGalleryStep({
  listingId,
  form,
  version,
  updateForm,
  onWizardUpdate,
  busy,
  setBusy,
}: Props) {
  const pickPhoto = useCallback(async () => {
    if (form.listingMedia.length >= 24) {
      Alert.alert("Galeri", "En fazla 24 fotoğraf yükleyebilirsiniz.");
      return;
    }
    const result = await launchImageLibrary({ mediaType: "photo", selectionLimit: 1, quality: 0.85 });
    if (result.didCancel || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setBusy(true);
    try {
      let v = version;
      const res = await uploadListingMedia(listingId, v, {
        uri: asset.uri!,
        type: asset.type || "image/jpeg",
        name: asset.fileName || "photo.jpg",
      });
      if (!res.ok) {
        Alert.alert("Yükleme", res.error || "Fotoğraf yüklenemedi.");
        return;
      }
      const media = res.data?.content?.listing_media;
      if (Array.isArray(media)) {
        updateForm({ listingMedia: media });
        onWizardUpdate(media, Number(res.data?.version ?? v));
      }
    } finally {
      setBusy(false);
    }
  }, [form.listingMedia.length, listingId, onWizardUpdate, setBusy, updateForm, version]);

  const removePhoto = useCallback(
    async (mediaId: string) => {
      setBusy(true);
      try {
        const next = form.listingMedia.filter((m) => m.media_id !== mediaId);
        const res = await patchListingContent(listingId, version, { listing_media: next });
        if (!res.ok) {
          Alert.alert("Silme", res.error || "Fotoğraf kaldırılamadı.");
          return;
        }
        const media = res.data?.content?.listing_media || next;
        updateForm({ listingMedia: Array.isArray(media) ? media : next });
        onWizardUpdate(Array.isArray(media) ? media : next, Number(res.data?.version ?? version));
      } finally {
        setBusy(false);
      }
    },
    [form.listingMedia, listingId, onWizardUpdate, setBusy, updateForm, version],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Galeri</Text>
      <Text style={styles.hint}>Fotoğraf (en fazla 24)</Text>
      <TouchableOpacity style={styles.addBtn} onPress={() => void pickPhoto()} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="camera-outline" size={20} color="#fff" />
            <Text style={styles.addText}>Fotoğraf ekle</Text>
          </>
        )}
      </TouchableOpacity>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
        {form.listingMedia.map((m) => {
          const uri = resolveMediaUrl(m.url || m.thumb_url || "");
          return (
            <View key={String(m.media_id || m.url)} style={styles.thumbWrap}>
              {uri ? <Image source={{ uri }} style={styles.thumb} /> : null}
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => m.media_id && void removePhoto(m.media_id)}
                disabled={busy}
              >
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  hint: { color: "#64748b", fontSize: 14 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 12,
  },
  addText: { color: "#fff", fontWeight: "700" },
  strip: { marginTop: 8 },
  thumbWrap: { marginRight: 10, position: "relative" },
  thumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: "#e2e8f0" },
  removeBtn: { position: "absolute", top: -6, right: -6 },
});
