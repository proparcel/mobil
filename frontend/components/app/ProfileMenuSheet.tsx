/**
 * Profil ekranı menüsü — web `OwnProfilePage` sekmeleri (başka genel uygulama menü öğesi yok).
 */
import React, { useCallback, useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../../screens/contexts/AuthContext";
import type { UserProfile } from "../../src/types/auth";
import AppBottomSheetModal from "./AppBottomSheetModal";
import {
  USER_MENU_SHEET_SNAP_POINTS,
  UserMenuSheetHeader,
  UserMenuSheetTitleRow,
  userMenuSheetDarkStyles,
} from "./UserMenuSheet";
import { PROFILE_SECTION_LABELS, type ProfileSectionId } from "./profileSectionTypes";

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  creditBalance?: number | null;
  activeSection: ProfileSectionId;
  onSelectSection: (id: ProfileSectionId) => void;
}

const SECTION_ICONS: Record<ProfileSectionId, string> = {
  genel: "home-outline",
  puan_yorumlar: "star-outline",
  rozetler: "ribbon-outline",
  ilanlar: "images-outline",
  prosorgular: "search-outline",
  kullanimlarim: "stats-chart-outline",
  hesap: "id-card-outline",
  uzmanlik: "map-outline",
  firma: "business-outline",
  ayarlar: "settings-outline",
  danisman: "school-outline",
};

export default function ProfileMenuSheet({
  visible,
  onClose,
  profile,
  creditBalance = null,
  activeSection,
  onSelectSection,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const isIndividual = profile?.member_type === "individual";

  const sections = useMemo((): ProfileSectionId[] => {
    const base: ProfileSectionId[] = [
      "genel",
      "puan_yorumlar",
      "rozetler",
      "ilanlar",
      "prosorgular",
      "kullanimlarim",
      "hesap",
      "uzmanlik",
      "firma",
      "ayarlar",
    ];
    if (isIndividual) {
      const out = [...base];
      out.splice(7, 0, "danisman");
      return out;
    }
    return base;
  }, [isIndividual]);

  const handlePress = useCallback(
    (id: ProfileSectionId) => {
      if (id === "rozetler") {
        onClose();
        router.push("badges");
        return;
      }
      onSelectSection(id);
      onClose();
    },
    [onClose, onSelectSection, router],
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={[...USER_MENU_SHEET_SNAP_POINTS]}
      variant="dark"
      backdropOpacity={0.2}
      backdropPressBehavior="close"
    >
      <UserMenuSheetHeader
        variant="dark"
        isAuthenticated
        user={user}
        profile={profile}
        creditBalance={creditBalance}
        onPressProfile={onClose}
        onPressCredits={() => {
          onClose();
          router.push("pricing");
        }}
      />
      <UserMenuSheetTitleRow variant="dark" title="Profil bölümleri" />

      <BottomSheetScrollView style={userMenuSheetDarkStyles.scroll} bounces={false}>
        {sections.map((id) => (
          <TouchableOpacity
            key={id}
            style={[userMenuSheetDarkStyles.item, activeSection === id && userMenuSheetDarkStyles.itemCurrent]}
            onPress={() => handlePress(id)}
            activeOpacity={0.7}
          >
            <View style={[userMenuSheetDarkStyles.iconWrap, activeSection === id && userMenuSheetDarkStyles.iconWrapCurrent]}>
              <Ionicons name={SECTION_ICONS[id]} size={20} color={activeSection === id ? "#60a5fa" : "#94a3b8"} />
            </View>
            <Text
              style={[
                userMenuSheetDarkStyles.itemText,
                activeSection === id && userMenuSheetDarkStyles.itemTextCurrent,
              ]}
            >
              {PROFILE_SECTION_LABELS[id]}
            </Text>
            {activeSection === id ? <View style={userMenuSheetDarkStyles.currentDot} /> : null}
            <Ionicons name="chevron-forward" size={16} color="#64748b" style={userMenuSheetDarkStyles.chevron} />
          </TouchableOpacity>
        ))}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
}
