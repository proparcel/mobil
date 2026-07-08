/**
 * Native ilan oluşturma / düzenleme sihirbazı
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter, useLocalSearchParams } from "../../src/hooks/useNavigation";
import { useListingWizard } from "../../src/hooks/useListingWizard";
import ListingWizardStepper from "../../components/listing-wizard/ListingWizardStepper";
import EidsAuthorizationStep from "../../components/listing-wizard/EidsAuthorizationStep";
import CategorySelectionStep from "../../components/listing-wizard/CategorySelectionStep";
import CoreDetailsStep from "../../components/listing-wizard/CoreDetailsStep";
import LocationStep from "../../components/listing-wizard/LocationStep";
import DynamicAttributesStep from "../../components/listing-wizard/DynamicAttributesStep";
import MediaGalleryStep from "../../components/listing-wizard/MediaGalleryStep";
import DescriptionStep from "../../components/listing-wizard/DescriptionStep";
import PreviewStep from "../../components/listing-wizard/PreviewStep";
import VisibilityStep from "../../components/listing-wizard/VisibilityStep";
import PublishStep from "../../components/listing-wizard/PublishStep";
import { publishListing } from "../../services/listingService";
import { patchListingContent } from "../../services/listingWizardService";
import type { ListingWizardForm } from "../../src/types/listingWizard";

export default function ListingWizardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    listingId?: string;
    mode?: "create" | "edit";
    forceEidsFirst?: string;
    returnSnapshotId?: string;
    eids?: string;
    eids_error?: string;
  }>();

  const listingId = String(params.listingId || "").trim();
  const mode = params.mode === "edit" ? "edit" : "create";
  const forceEidsFirst = params.forceEidsFirst === "1" || params.forceEidsFirst === "true";
  const returnSnapshotId = params.returnSnapshotId ? String(params.returnSnapshotId) : undefined;

  const eidsReturnSignal = useMemo(() => {
    if (params.eids === "ok") return "ok";
    if (params.eids_error) return `error:${params.eids_error}`;
    return null;
  }, [params.eids, params.eids_error]);

  const wizardHook = useListingWizard({ listingId, mode, forceEidsFirst });
  const {
    wizard,
    form,
    updateForm,
    steps,
    currentStepKey,
    currentStepIndex,
    currentStepDef,
    loading,
    busy,
    error,
    setError,
    eidsAuthenticated,
    eidsConfigured,
    refreshEidsStatus,
    advanceStep,
    applyWizard,
  } = wizardHook;

  const [localBusy, setLocalBusy] = useState(false);
  const isBusy = busy || localBusy;

  const handleBack = useCallback(() => {
    if (currentStepKey === "eids_authorization" && returnSnapshotId) {
      router.replace("son-30-gun-detay", { snapshotId: returnSnapshotId });
      return;
    }
    router.back();
  }, [currentStepKey, returnSnapshotId, router]);

  const handleEidsCancel = useCallback(() => {
    if (returnSnapshotId) {
      router.replace("son-30-gun-detay", { snapshotId: returnSnapshotId });
      return;
    }
    router.back();
  }, [returnSnapshotId, router]);

  const onMediaUpdate = useCallback(
    (media: ListingWizardForm["listingMedia"], version: number) => {
      applyWizard({ ...(wizard || { listing_id: listingId, current_step: currentStepKey, version: 0 }), version, content: { ...wizard?.content, listing_media: media } });
    },
    [applyWizard, currentStepKey, listingId, wizard],
  );

  const handlePublish = useCallback(async () => {
    setLocalBusy(true);
    setError(null);
    try {
      const fields = { portal_visibility: form.portalVisibility, title: form.title.trim() };
      const patchRes = await patchListingContent(listingId, Number(wizard?.version ?? 0), fields);
      if (!patchRes.ok) {
        Alert.alert("Yayın", patchRes.error || "Kaydedilemedi.");
        return;
      }
      let version = Number(patchRes.data?.version ?? wizard?.version ?? 0);
      const pubRes = await publishListing(listingId, version);
      if (!pubRes.ok) {
        Alert.alert("Yayın", pubRes.error || "İlan yayınlanamadı.");
        return;
      }
      Alert.alert("Yayın", "İlanınız vitrine yayınlandı.", [
        { text: "Tamam", onPress: () => router.replace("ilanlarim") },
      ]);
    } finally {
      setLocalBusy(false);
    }
  }, [form.portalVisibility, form.title, listingId, router, setError, wizard?.version]);

  const onPrimary = useCallback(async () => {
    if (currentStepKey === "publish") {
      await handlePublish();
      return;
    }
    const ok = await advanceStep();
    if (!ok && error) {
      // error already set in hook
    }
  }, [advanceStep, currentStepKey, error, handlePublish]);

  const renderStep = () => {
    switch (currentStepKey) {
      case "eids_authorization":
        return (
          <EidsAuthorizationStep
            listingId={listingId}
            form={form}
            updateForm={updateForm}
            eidsAuthenticated={eidsAuthenticated}
            eidsConfigured={eidsConfigured}
            busy={isBusy}
            onRefreshEids={refreshEidsStatus}
            onCancel={returnSnapshotId ? handleEidsCancel : undefined}
            eidsReturnSignal={eidsReturnSignal}
          />
        );
      case "category_selection":
        return <CategorySelectionStep form={form} updateForm={updateForm} busy={isBusy} />;
      case "core_details":
        return <CoreDetailsStep form={form} updateForm={updateForm} busy={isBusy} />;
      case "location":
        return <LocationStep form={form} updateForm={updateForm} busy={isBusy} />;
      case "dynamic_attributes":
        return <DynamicAttributesStep form={form} updateForm={updateForm} busy={isBusy} />;
      case "media":
        return (
          <MediaGalleryStep
            listingId={listingId}
            form={form}
            version={Number(wizard?.version ?? 0)}
            updateForm={updateForm}
            onWizardUpdate={onMediaUpdate}
            busy={isBusy}
            setBusy={setLocalBusy}
          />
        );
      case "description":
        return (
          <DescriptionStep listingId={listingId} form={form} updateForm={updateForm} busy={isBusy} />
        );
      case "preview":
        return <PreviewStep form={form} />;
      case "visibility_confirmation":
        return <VisibilityStep form={form} updateForm={updateForm} busy={isBusy} />;
      case "publish":
        return <PublishStep form={form} />;
      default:
        return <Text style={styles.muted}>Bilinmeyen adım: {currentStepKey}</Text>;
    }
  };

  if (!listingId) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.muted}>İlan kimliği eksik.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {mode === "edit" ? "İlan düzenle" : "İlan ver"}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.body}>
            <ListingWizardStepper steps={steps} currentIndex={currentStepIndex >= 0 ? currentStepIndex : 0} />
            {currentStepDef?.hint ? <Text style={styles.hint}>{currentStepDef.hint}</Text> : null}
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              {renderStep()}
            </ScrollView>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryBtn, isBusy && styles.primaryBtnDisabled]}
              onPress={() => void onPrimary()}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {currentStepKey === "publish" ? "Yayınla" : "Devam"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#1e293b",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "700" },
  body: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 16, paddingTop: 12 },
  hint: { fontSize: 13, color: "#64748b", marginBottom: 8 },
  err: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  scroll: { flex: 1 },
  footer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  muted: { color: "#64748b", padding: 16 },
});
