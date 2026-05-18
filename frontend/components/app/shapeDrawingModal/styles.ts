import { Dimensions, StyleSheet } from "react-native";

// Dropdown menüler çok eleman olduğunda daha uzun görünsün (ekrana göre ayarlı)
const DROPDOWN_MAX_HEIGHT = Math.min(420, Math.round(Dimensions.get("window").height * 0.55));

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e293b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
    // Bu sayfada sadece header altında ince accent çizgi
    borderBottomWidth: 1,
    borderBottomColor: "#3b82f6",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  creditBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    // 3D sayfasındaki buton ölçüsü ile aynı
    height: 32,
    paddingHorizontal: 10,
    backgroundColor: "#334155",
    borderRadius: 6,
    gap: 6,
  },
  creditBadgeIcon: {
    width: 16,
    height: 16,
  },
  creditBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  managementButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 0,
    height: 32,
    backgroundColor: "#334155",
    borderRadius: 6,
    gap: 6,
  },
  managementButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  closeButton: {
    padding: 4,
  },
  closeButtonWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 0,
    height: 32,
    backgroundColor: "#334155",
    borderRadius: 6,
  },
  /** 3D editör araç çubuğu — tek “İşlemler” menüsü (Yönet / kredi ile aynı yükseklik) */
  toolbarActionMenuButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    paddingHorizontal: 9,
    paddingVertical: 0,
    backgroundColor: "#334155",
    borderRadius: 6,
    gap: 5,
    alignSelf: "flex-start",
    maxHeight: 32,
  },
  toolbarActionMenuButtonActive: {
    backgroundColor: "#3b82f6",
  },
  toolbarActionMenuTitle: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  toolbarActionMenuTitleActive: {
    color: "#fff",
  },
  toolbarContainer: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    // Toolbar altında accent çizgi olmasın (sadece header altında)
    borderBottomWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    alignItems: "center",
    // Dropdown menüler, map üstü overlay'lerin de üstünde kalmalı.
    // (Örn: model yerleştirme bilgi kartı zIndex ~1200)
    zIndex: 2000,
    elevation: 20,
  },
  dropdownDismissOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    // toolbarContainer (1000) ve dropdownMenu (1000) altında, map/content üstünde
    zIndex: 900,
  },
  dropdownContainer: {
    flex: 1,
    position: "relative",
    // Menülerin kendi stacking context'i yüksek olsun
    zIndex: 2000,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#334155",
    borderRadius: 6,
    gap: 6,
    minHeight: 32,
  },
  dropdownButtonActive: {
    backgroundColor: "#3b82f6",
  },
  dropdownButtonText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },
  dropdownButtonTextActive: {
    color: "#fff",
  },
  dropdownMenu: {
    position: "absolute",
    top: 40,
    left: 0,
    backgroundColor: "#1e293b",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
    maxHeight: DROPDOWN_MAX_HEIGHT,
    // Bilgi kartı vb. overlay'lerin üstünde kalsın
    zIndex: 2500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    // Android stacking
    elevation: 30,
    // Menü, container genişliğiyle sınırlanmasın (uzun metinler için esnek genişleme)
    minWidth: 140,
    maxWidth: 360,
  },
  dropdownScrollView: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
  dropdownMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  dropdownMenuItemActive: {
    backgroundColor: "#334155",
  },
  dropdownMenuItemText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    // Uzun metinlerde (özellikle modelId) kırpılma/taşma yerine satır kırılımı
    minWidth: 0,
    flexShrink: 1,
  },
  dropdownMenuItemTextActive: {
    color: "#3b82f6",
  },
  dropdownMenuItemTextDownloaded: {
    color: "#10b981",
    fontWeight: "600",
  },
  parcelSelectButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#334155",
    borderRadius: 6,
    gap: 6,
    minHeight: 32,
    minWidth: 100,
  },
  parcelSelectButtonActive: {
    backgroundColor: "#3b82f6",
  },
  parcelSelectButtonText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "500",
  },
  parcelSelectButtonTextActive: {
    color: "#fff",
  },
  mapContainer: {
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  // Sağ-orta aç/kapat (index sayfasındaki zoom panel mantığı)
  navControlsWrapper: {
    position: "absolute",
    right: 12,
    // bottom is set dynamically with safe-area insets
    zIndex: 200, // diğer alt panellerin arkasında kalsın
    alignItems: "flex-end",
    gap: 10,
  },
  navControlsTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
  },
  navControlsToggleText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  navControlTrigger: {
    width: 44,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  navControlLineContainer: {
    width: "100%",
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  navControlLine: {
    width: 3,
    height: 40,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  navControlsPanel: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 6,
    borderWidth: 1.5,
    borderColor: "#3b82f6",
    elevation: 15,
    alignItems: "center",
    minWidth: 170,
    // navControlAreaProtector (zIndex: 899) üstünde kalsın ki butonlar tıklanabilsin
    zIndex: 900,
  },
  navControlAreaProtector: {
    position: "absolute",
    left: -40,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 899,
    width: "100%",
    height: "100%",
  },
  navControlCloseHandle: {
    position: "absolute",
    left: -32,
    width: 32,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 901,
  },
  navControlCloseLineContainer: {
    width: "100%",
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  navControlCloseLine: {
    width: 3,
    height: 40,
    backgroundColor: "#64748b",
    borderRadius: 2,
  },
  controlsLayoutWrapper: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: 12,
  },
  mapControlsPanel: {
    backgroundColor: "rgba(30, 41, 59, 0.78)",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1.5,
    borderColor: "rgba(59, 130, 246, 0.9)",
    elevation: 15,
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  mapControlButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  mapControlSpacer: {
    width: 30,
    height: 30,
  },
  pitchControlsContainer: {
    backgroundColor: "rgba(30, 41, 59, 0.78)",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1.5,
    borderColor: "rgba(59, 130, 246, 0.9)",
    elevation: 15,
    alignItems: "center",
    width: 50,
    height: 110,
    justifyContent: "center",
  },
  pitchButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  pitchValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginVertical: 4,
  },
  dragOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: "transparent",
  },
  shapeSelectionClearButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 12,
  },
  sizeSlider: {
    width: "100%",
    height: 40,
    marginTop: 4,
  },
  infoContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#334155",
    borderTopWidth: 1,
    borderTopColor: "#475569",
  },
  infoText: {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
  },
  editPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10, // Handle'ların üstünde olmamalı - düşük z-index
    // bottom ve maxHeight değerleri dinamik olarak ayarlanacak
  },
  editPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  editPanelTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  editPanelHeaderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editPanelMinimizeButton: {
    padding: 4,
  },
  editPanelCloseButton: {
    padding: 4,
  },
  editPanelContent: {
    flex: 1, // ScrollView'in tüm alanı kullanmasını sağla
  },
  editPanelContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editSection: {
    marginBottom: 16,
  },
  editSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: "row",
    gap: 16,
  },
  colorInputGroup: {
    flex: 1,
  },
  colorLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 6,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#334155",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 10,
    color: "#94a3b8",
    width: 20,
  },
  sliderContainer: {
    flex: 1,
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
    position: "relative",
  },
  sliderTrack: {
    position: "absolute",
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  sliderButtons: {
    flexDirection: "row",
    gap: 6,
  },
  sliderButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#334155",
    borderRadius: 6,
    alignItems: "center",
  },
  sliderButtonActive: {
    backgroundColor: "#3b82f6",
  },
  sliderButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  parcelInfoPanel: {
    position: "absolute",
    // bottom değeri dinamik olarak insets.bottom ile ayarlanacak
    left: 0,
    right: 0,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  parcelInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  parcelInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  parcelInfoCloseButton: {
    padding: 4,
  },
  parcelInfoContent: {
    gap: 4,
  },
  parcelInfoText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  parcelInfoLabel: {
    fontWeight: "600",
    color: "#fff",
  },
  managementPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    // bottom ve maxHeight değerleri dinamik olarak ayarlanacak
  },
  tabNavigation: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    backgroundColor: "#0f172a",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: "#3b82f6",
    backgroundColor: "#1e293b",
  },
  tabButtonText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "500",
  },
  tabButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  tabContent: {
    flex: 1, // ScrollView'in tüm alanı kullanmasını sağla
    maxHeight: 280, // ScrollView'in maksimum yüksekliği - footer için yer bırak
  },
  tabContentContainer: {
    paddingBottom: 150, // Footer için yeterli padding - ScrollView içeriği için
    flexGrow: 1, // İçeriğin büyümesine izin ver
  },
  tabContentInner: {
    padding: 12,
    paddingBottom: 20, // İçerik için padding
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#334155",
    borderRadius: 8,
    marginBottom: 8,
  },
  listItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  listItemText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  listItemTextActive: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  listItemActions: {
    flexDirection: "row",
    gap: 8,
  },
  listItemActionButton: {
    padding: 6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
  },
  // Usage Badge Styles
  usageBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  usageBadgeUnlimited: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  usageBadgeLimited: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  usageBadgeZero: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  // Usage Info Panel Styles
  usageInfoPanel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  usageInfoPanelUnlimited: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  usageInfoPanelLimited: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  usageInfoPanelZero: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  // Disabled Model Item Styles
  modelItemDisabled: {
    opacity: 0.5,
  },
  dropdownMenuItemTextDisabled: {
    color: "#64748b",
    textDecorationLine: "line-through",
  },
});

