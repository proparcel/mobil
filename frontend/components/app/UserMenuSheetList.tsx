/**
 * Ana sayfa ile aynı menü listesi (sıra, alt menüler, rozetler).
 */
import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { User } from "../../src/types/auth";
import type { UserProfile } from "../../src/types/auth";
import type { HomeMenuItem } from "./userMenuItems";
import { TepeCoinIcon, userMenuSheetStyles } from "./UserMenuSheet";

type SheetSt = typeof userMenuSheetStyles;

export type UserMenuSheetListProps = {
  items: HomeMenuItem[];
  st: SheetSt;
  variant: "light" | "dark";
  submenuOpenId: string | null;
  uzmanGorusuOpen: boolean;
  setUzmanGorusuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onItemPress: (id: string) => void;
  notificationsUnread: number;
  expertIncomingUnread: number;
  expertMyRepliesUnread: number;
  user: User | null;
  userProfile: UserProfile | null;
  footerInsetBottom: number;
};

export default function UserMenuSheetList({
  items,
  st,
  variant,
  submenuOpenId,
  uzmanGorusuOpen,
  setUzmanGorusuOpen,
  onItemPress,
  notificationsUnread,
  expertIncomingUnread,
  expertMyRepliesUnread,
  user,
  userProfile,
  footerInsetBottom,
}: UserMenuSheetListProps) {
  const mainIconColor = (disabled: boolean, id: string) => {
    if (disabled) return variant === "dark" ? "#64748b" : "#94a3b8";
    if (id === "cikis") return variant === "dark" ? "#f87171" : "#ef4444";
    return variant === "dark" ? "#e2e8f0" : "#64748b";
  };
  const subIconColor = variant === "dark" ? "#e2e8f0" : "#64748b";

  return (
    <BottomSheetScrollView
      style={st.scroll}
      contentContainerStyle={{ flexGrow: 1 }}
      scrollEventThrottle={16}
      nestedScrollEnabled
    >
      {items.map((item) => (
        <React.Fragment key={item.id}>
          <TouchableOpacity
            style={[st.item, item.disabled && st.itemDisabled]}
            disabled={item.disabled}
            onPress={() => {
              if (!item.disabled) onItemPress(item.id);
            }}
          >
            <View style={st.iconWrap}>
              {item.icon === "cube" ? (
                <MaterialCommunityIcons name="cube" size={20} color={mainIconColor(!!item.disabled, item.id)} />
              ) : item.icon === "terrain" ? (
                <MaterialCommunityIcons name="terrain" size={20} color={mainIconColor(!!item.disabled, item.id)} />
              ) : item.icon === "layers" ? (
                <MaterialCommunityIcons name="layers" size={20} color={mainIconColor(!!item.disabled, item.id)} />
              ) : item.icon === "folder" ? (
                <Ionicons name="folder" size={20} color={mainIconColor(!!item.disabled, item.id)} />
              ) : item.id === "kredi-paketleri" ? (
                <Image source={TepeCoinIcon} style={{ width: 20, height: 20 }} resizeMode="contain" />
              ) : (
                <Ionicons name={item.icon as any} size={20} color={mainIconColor(!!item.disabled, item.id)} />
              )}
            </View>
            <Text
              style={[
                st.itemText,
                item.disabled && st.itemTextDisabled,
                item.id === "cikis" && st.itemTextDanger,
              ]}
            >
              {item.title}
            </Text>
            {item.id === "bildirimler" && notificationsUnread > 0 && (
              <View style={st.unreadBadge}>
                <Text style={st.unreadBadgeText}>{notificationsUnread > 99 ? "99+" : String(notificationsUnread)}</Text>
              </View>
            )}
            {(item as HomeMenuItem).hasSubmenu ? (
              <Ionicons
                name={submenuOpenId === item.id ? "chevron-up" : "chevron-down"}
                size={20}
                color={variant === "dark" ? "#94a3b8" : "#94a3b8"}
                style={{ marginLeft: 8 }}
              />
            ) : null}
          </TouchableOpacity>
          {item.id === "ai-video" && submenuOpenId === "ai-video" && (
            <>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => onItemPress("ai-video-studio")}>
                <View style={st.iconWrap}>
                  <Ionicons name="film-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>AI Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => onItemPress("ai-image-animation")}>
                <View style={st.iconWrap}>
                  <Ionicons name="image-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>AI Resim</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => onItemPress("ai-drone-video")}>
                <View style={st.iconWrap}>
                  <Ionicons name="airplane-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>AI Drone Video</Text>
              </TouchableOpacity>
            </>
          )}
          {item.id === "ilan-islemleri" && submenuOpenId === "ilan-islemleri" && (
            <>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => onItemPress("ilan-ver")}>
                <View style={st.iconWrap}>
                  <Ionicons name="add-circle-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>İlan ver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => onItemPress("ilanlarim")}>
                <View style={st.iconWrap}>
                  <Ionicons name="list-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>İlanlarım</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => onItemPress("ilan-mesajlar")}>
                <View style={st.iconWrap}>
                  <Ionicons name="chatbubbles-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>Mesajlar</Text>
              </TouchableOpacity>
            </>
          )}
          {item.id === "dosyalarim" && submenuOpenId === "dosyalarim" && (
            <>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => onItemPress("hisseli-parsel-projelerim")}>
                <View style={st.iconWrap}>
                  <MaterialCommunityIcons name="file-document-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>Hisseli Parsel Projelerim</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => onItemPress("3d-tasarimlarim")}>
                <View style={st.iconWrap}>
                  <Ionicons name="cube-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>3D Tasarımlarım</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.item, st.itemSub]} onPress={() => setUzmanGorusuOpen((p) => !p)}>
                <View style={st.iconWrap}>
                  <Ionicons name="person-outline" size={20} color={subIconColor} />
                </View>
                <Text style={st.itemText}>Taleplerim</Text>
                {(expertMyRepliesUnread > 0 || expertIncomingUnread > 0) && (
                  <View style={[st.unreadBadgeGreen, expertIncomingUnread > 0 && st.unreadBadgeRed]}>
                    <Text style={st.unreadBadgeText}>
                      {expertMyRepliesUnread + expertIncomingUnread > 99
                        ? "99+"
                        : String(expertMyRepliesUnread + expertIncomingUnread)}
                    </Text>
                  </View>
                )}
                <Ionicons
                  name={uzmanGorusuOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#94a3b8"
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
              {uzmanGorusuOpen ? (
                <>
                  <TouchableOpacity
                    style={[st.item, st.itemSub, st.itemSubSub]}
                    onPress={() => onItemPress("uzman-gorusu-isteklerim")}
                  >
                    <View style={st.iconWrap}>
                      <Ionicons name="paper-plane-outline" size={18} color={subIconColor} />
                    </View>
                    <Text style={st.itemText}>İstekler</Text>
                    {expertMyRepliesUnread > 0 ? (
                      <View style={st.unreadBadgeGreen}>
                        <Text style={st.unreadBadgeText}>
                          {expertMyRepliesUnread > 99 ? "99+" : String(expertMyRepliesUnread)}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  {user?.role === "consultant" ||
                  user?.role === "broker" ||
                  (userProfile as any)?.member_type === "consultant" ||
                  (((userProfile as any)?.member_type === "corporate" ||
                    (userProfile as any)?.member_type === "expert") &&
                    Boolean((userProfile as any)?.is_company_authority)) ? (
                    <TouchableOpacity
                      style={[st.item, st.itemSub, st.itemSubSub]}
                      onPress={() => onItemPress("uzman-gorusu-gelen")}
                    >
                      <View style={st.iconWrap}>
                        <Ionicons name="download-outline" size={18} color={subIconColor} />
                      </View>
                      <Text style={st.itemText}>Gelenler</Text>
                      {expertIncomingUnread > 0 ? (
                        <View style={st.unreadBadgeRed}>
                          <Text style={st.unreadBadgeText}>
                            {expertIncomingUnread > 99 ? "99+" : String(expertIncomingUnread)}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </React.Fragment>
      ))}
      <View style={{ minHeight: 56 + footerInsetBottom }} />
    </BottomSheetScrollView>
  );
}
