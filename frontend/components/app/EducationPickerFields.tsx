import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  type ScrollView as ScrollViewType,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useScrollInputIntoView } from "../../src/keyboard";
import {
  educationService,
  type DepartmentItem,
  type UniversityItem,
} from "../../services/educationService";

export type EducationPickerValue = {
  universityId: number | null;
  universityName: string;
  departmentId: number | null;
  departmentName: string;
  customDepartment: string;
};

export const EMPTY_EDUCATION_PICKER: EducationPickerValue = {
  universityId: null,
  universityName: "",
  departmentId: null,
  departmentName: "",
  customDepartment: "",
};

type PickerKind = "university" | "department";

type EducationPickerFieldsProps = {
  educationLevel: 1 | 2;
  value: EducationPickerValue;
  onChange: (value: EducationPickerValue) => void;
  errors?: {
    universityId?: string;
    departmentId?: string;
  };
  required?: boolean;
  /** Uzun kayıt formu scroll'u */
  scrollRef?: React.RefObject<ScrollViewType | null>;
};

function filterByQuery<T extends { name: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase("tr-TR");
  if (!q) return items;
  return items.filter((item) => item.name.toLocaleLowerCase("tr-TR").includes(q));
}

export function EducationPickerFields({
  educationLevel,
  value,
  onChange,
  errors,
  required = false,
  scrollRef,
}: EducationPickerFieldsProps) {
  const fallbackScrollRef = useRef<ScrollViewType>(null);
  const effectiveScrollRef = scrollRef ?? fallbackScrollRef;
  const universitySearchWrapRef = useRef<View>(null);
  const departmentSearchWrapRef = useRef<View>(null);
  const customDeptWrapRef = useRef<View>(null);
  const { handleFocus: scrollUniversitySearchIntoView, handleBlur: scrollUniversitySearchBlur } =
    useScrollInputIntoView({ scrollRef: effectiveScrollRef, inputWrapRef: universitySearchWrapRef });
  const { handleFocus: scrollDepartmentSearchIntoView, handleBlur: scrollDepartmentSearchBlur } =
    useScrollInputIntoView({ scrollRef: effectiveScrollRef, inputWrapRef: departmentSearchWrapRef });
  const { handleFocus: scrollCustomDeptIntoView, handleBlur: scrollCustomDeptBlur } =
    useScrollInputIntoView({ scrollRef: effectiveScrollRef, inputWrapRef: customDeptWrapRef });
  const [universities, setUniversities] = useState<UniversityItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isUniversitiesLoading, setIsUniversitiesLoading] = useState(false);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openPicker, setOpenPicker] = useState<PickerKind | null>(null);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsUniversitiesLoading(true);
    setLoadError("");
    educationService
      .listUniversities()
      .then((items) => {
        if (cancelled) return;
        setUniversities(items);
        if (!items.length) setLoadError("Üniversite listesi yüklenemedi.");
      })
      .finally(() => {
        if (!cancelled) setIsUniversitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsDepartmentsLoading(true);
    setLoadError("");
    educationService
      .listDepartments(educationLevel)
      .then((items) => {
        if (cancelled) return;
        setDepartments(items);
        if (!items.length) setLoadError("Bölüm listesi yüklenemedi.");
      })
      .finally(() => {
        if (!cancelled) setIsDepartmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [educationLevel]);

  const filteredUniversities = useMemo(
    () => filterByQuery(universities, openPicker === "university" ? searchText : ""),
    [universities, openPicker, searchText],
  );

  const filteredDepartments = useMemo(
    () => filterByQuery(departments, openPicker === "department" ? searchText : ""),
    [departments, openPicker, searchText],
  );

  const togglePicker = (kind: PickerKind) => {
    if (openPicker === kind) {
      setOpenPicker(null);
      setSearchText("");
      return;
    }
    setOpenPicker(kind);
    setSearchText("");
    setLoadError("");
  };

  const selectUniversity = (item: UniversityItem) => {
    onChange({
      ...value,
      universityId: item.id,
      universityName: item.name,
    });
    setOpenPicker(null);
    setSearchText("");
  };

  const selectDepartment = (item: DepartmentItem) => {
    onChange({
      ...value,
      departmentId: item.id,
      departmentName: item.name,
      customDepartment: "",
    });
    setOpenPicker(null);
    setSearchText("");
  };

  const renderPicker = (
    kind: PickerKind,
    items: Array<{ id: number; name: string }>,
    isLoading: boolean,
    placeholder: string,
    onSelect: (item: { id: number; name: string }) => void,
    searchWrapRef: React.RefObject<View | null>,
    onSearchFocus?: () => void,
    onSearchBlur?: () => void,
  ) => {
    if (openPicker !== kind) return null;

    return (
      <View style={styles.dropdown}>
        <View ref={searchWrapRef} collapsable={false}>
          <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="words"
            autoCorrect={false}
            onFocus={scrollRef ? onSearchFocus : undefined}
            onBlur={scrollRef ? onSearchBlur : undefined}
          />
        </View>
        {isLoading ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color="#1a73e8" />
            <Text style={styles.helperText}>Liste yükleniyor...</Text>
          </View>
        ) : null}
        {!isLoading && loadError ? <Text style={styles.fieldError}>{loadError}</Text> : null}
        {!isLoading && !loadError && items.length === 0 ? (
          <Text style={styles.helperText}>Sonuç bulunamadı.</Text>
        ) : null}
        {items.length > 0 ? (
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.resultItem}
                onPress={() => onSelect(item)}
              >
                <Text style={styles.resultItemText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
  };

  return (
    <View>
      <Text style={styles.label}>Üniversite{required ? " *" : ""}</Text>
      <TouchableOpacity
        style={[styles.selectButton, errors?.universityId && styles.inputError]}
        onPress={() => togglePicker("university")}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.selectButtonText,
            !value.universityName && styles.selectPlaceholder,
          ]}
        >
          {value.universityName || "Üniversite seçiniz"}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#64748b" />
      </TouchableOpacity>
      {errors?.universityId ? <Text style={styles.fieldError}>{errors.universityId}</Text> : null}
      {renderPicker(
        "university",
        filteredUniversities,
        isUniversitiesLoading,
        "Üniversite ara",
        selectUniversity,
        universitySearchWrapRef,
        scrollUniversitySearchIntoView,
        scrollUniversitySearchBlur,
      )}

      <Text style={[styles.label, styles.stackedLabel]}>Bölüm</Text>
      <TouchableOpacity
        style={[styles.selectButton, errors?.departmentId && styles.inputError]}
        onPress={() => togglePicker("department")}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.selectButtonText,
            !value.departmentName && styles.selectPlaceholder,
          ]}
        >
          {value.departmentName || "Bölüm seçiniz"}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#64748b" />
      </TouchableOpacity>
      {errors?.departmentId ? <Text style={styles.fieldError}>{errors.departmentId}</Text> : null}
      {renderPicker(
        "department",
        filteredDepartments,
        isDepartmentsLoading,
        "Bölüm ara",
        selectDepartment,
        departmentSearchWrapRef,
        scrollDepartmentSearchIntoView,
        scrollDepartmentSearchBlur,
      )}

      <Text style={[styles.label, styles.stackedLabel]}>veya Bölüm Adını Yazın</Text>
      <View ref={customDeptWrapRef} collapsable={false}>
        <TextInput
          style={styles.input}
          placeholder="Bölüm listede yoksa buraya yazın"
          placeholderTextColor="#999"
          value={value.customDepartment}
          onChangeText={(text) => {
            onChange({
              ...value,
              customDepartment: text,
              ...(text.trim()
                ? { departmentId: null, departmentName: "" }
                : {}),
            });
          }}
          onFocus={scrollRef ? scrollCustomDeptIntoView : undefined}
          onBlur={scrollRef ? scrollCustomDeptBlur : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  stackedLabel: {
    marginTop: 12,
  },
  selectButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: "#fafafa",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectButtonText: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    marginRight: 12,
  },
  selectPlaceholder: {
    color: "#999",
  },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    padding: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#f8fafc",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  helperText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 8,
  },
  results: {
    maxHeight: 220,
    marginTop: 8,
  },
  resultItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  resultItemText: {
    fontSize: 15,
    color: "#1e293b",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  inputError: {
    borderColor: "#dc2626",
  },
  fieldError: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: 4,
  },
});
