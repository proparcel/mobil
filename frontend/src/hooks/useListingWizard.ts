import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ListingWizardForm, ListingWizardState, ListingWizardStepKey } from "../types/listingWizard";
import { stepsForMode, type WizardStepDef } from "../config/listingWizardConfig";
import {
  authorizeListingEids,
  completeWizardStep,
  fetchEidsStatus,
  getListingWizard,
  patchListingContent,
} from "../../services/listingWizardService";
import { contentToForm, formFieldsForStep, validateStep } from "../utils/listingWizardForm";

type Options = {
  listingId: string;
  mode: "create" | "edit";
  forceEidsFirst?: boolean;
};

export function useListingWizard({ listingId, mode, forceEidsFirst }: Options) {
  const [wizard, setWizard] = useState<ListingWizardState | null>(null);
  const [form, setForm] = useState<ListingWizardForm>(() => contentToForm(null));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eidsAuthenticated, setEidsAuthenticated] = useState(false);
  const [eidsConfigured, setEidsConfigured] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  const steps = useMemo(
    () => stepsForMode(mode, forceEidsFirst),
    [mode, forceEidsFirst],
  );

  const currentStepKey = String(wizard?.current_step || steps[0]?.key || "eids_authorization");
  const currentStepIndex = steps.findIndex((s) => s.key === currentStepKey);
  const currentStepDef: WizardStepDef | undefined =
    steps[currentStepIndex >= 0 ? currentStepIndex : 0] || steps[0];

  const isEidsAuthorized =
    mode === "edit" && !forceEidsFirst
      ? true
      : form.eidsAuthorization?.status === "authorized" ||
        wizard?.content?.eids_authorization?.status === "authorized";

  const loadWizard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [wizRes, eidsRes] = await Promise.all([
      getListingWizard(listingId),
      fetchEidsStatus(listingId),
    ]);
    if (!wizRes.ok) {
      setError(wizRes.error || "Sihirbaz yüklenemedi.");
      setLoading(false);
      return;
    }
    setWizard(wizRes.data || null);
    setForm(contentToForm(wizRes.data?.content));
    if (eidsRes.ok && eidsRes.data) {
      setEidsAuthenticated(Boolean(eidsRes.data.authenticated));
      setEidsConfigured(Boolean(eidsRes.data.configured));
    }
    setLoading(false);
  }, [listingId]);

  useEffect(() => {
    void loadWizard();
  }, [loadWizard]);

  const refreshEidsStatus = useCallback(async () => {
    const res = await fetchEidsStatus(listingId);
    if (res.ok && res.data) {
      setEidsAuthenticated(Boolean(res.data.authenticated));
      setEidsConfigured(Boolean(res.data.configured));
    }
    return res;
  }, [listingId]);

  const updateForm = useCallback((patch: Partial<ListingWizardForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyWizard = useCallback((next: ListingWizardState) => {
    setWizard(next);
    setForm(contentToForm(next.content));
  }, []);

  const saveContentForStep = useCallback(
    async (stepKey: string, localForm?: ListingWizardForm) => {
      const f = localForm || formRef.current;
      const version = Number(wizard?.version ?? 0);
      const fields = formFieldsForStep(stepKey, f);
      if (Object.keys(fields).length === 0) return { ok: true as const, wizard };
      const res = await patchListingContent(listingId, version, fields);
      if (!res.ok) return { ok: false as const, error: res.error || "Kaydedilemedi." };
      applyWizard(res.data!);
      return { ok: true as const, wizard: res.data };
    },
    [applyWizard, listingId, wizard?.version],
  );

  const completeEidsStep = useCallback(
    async (tasinmazId: string) => {
      setBusy(true);
      setError(null);
      try {
        const version = Number(wizard?.version ?? 0);
        const authRes = await authorizeListingEids(listingId, version, tasinmazId);
        if (!authRes.ok) {
          setError(authRes.error || "EİDS yetkilendirme başarısız.");
          return false;
        }
        const v = Number(authRes.data?.version ?? version);
        const stepRes = await completeWizardStep(listingId, "eids_authorization", v);
        if (!stepRes.ok) {
          setError(stepRes.error || "Adım tamamlanamadı.");
          return false;
        }
        applyWizard(stepRes.data!);
        return true;
      } finally {
        setBusy(false);
      }
    },
    [applyWizard, listingId, wizard?.version],
  );

  const advanceStep = useCallback(async () => {
    const stepKey = currentStepKey;
    const validationError = validateStep(stepKey, formRef.current, eidsAuthenticated);
    if (validationError) {
      setError(validationError);
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      if (stepKey === "eids_authorization") {
        return await completeEidsStep(formRef.current.eidsTasinmazId.trim());
      }
      const saveRes = await saveContentForStep(stepKey);
      if (!saveRes.ok) {
        setError(saveRes.error || "Kaydedilemedi.");
        return false;
      }
      const version = Number(saveRes.wizard?.version ?? wizard?.version ?? 0);
      const stepRes = await completeWizardStep(listingId, stepKey as ListingWizardStepKey, version);
      if (!stepRes.ok) {
        setError(stepRes.error || "Adım tamamlanamadı.");
        return false;
      }
      applyWizard(stepRes.data!);
      return true;
    } finally {
      setBusy(false);
    }
  }, [
    applyWizard,
    completeEidsStep,
    currentStepKey,
    eidsAuthenticated,
    listingId,
    saveContentForStep,
    wizard?.version,
  ]);

  return {
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
    isEidsAuthorized,
    refreshEidsStatus,
    loadWizard,
    advanceStep,
    saveContentForStep,
    applyWizard,
  };
}
