import type Ionicons from "react-native-vector-icons/Ionicons";
import type MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { ShapeType } from "@/src/maps/drawing/types";

export type MapDrawToolOption = {
  type: ShapeType;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

export type MapMarkerDrawOption = {
  type: "marker";
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
};

/** İğne — listede en üstte (ayrı render). */
export const MARKER_DRAW_OPTION: MapMarkerDrawOption = {
  type: "marker",
  label: "İğne ekle",
  icon: "map-marker",
};

/** Çizim araçları (iğne + textbox hariç). Sıra: kalem → ok → çizgi → çokgen → şekiller → serbest. */
export const SHAPE_DRAW_OPTIONS: MapDrawToolOption[] = [
  { type: "pen", label: "Kalem", icon: "brush-outline" },
  { type: "arrow", label: "Ok", icon: "arrow-forward-outline" },
  { type: "line", label: "Çizgi", icon: "remove-outline" },
  { type: "polygon", label: "Çokgen", icon: "git-merge-outline" },
  { type: "rectangle", label: "Kare", icon: "square-outline" },
  { type: "triangle", label: "Üçgen", icon: "triangle-outline" },
  { type: "circle", label: "Yuvarlak", icon: "ellipse-outline" },
  { type: "ellipse", label: "Elips", icon: "ellipse" },
  { type: "freehand", label: "Serbest", icon: "create-outline" },
];

export const TEXTBOX_DRAW_OPTION: MapDrawToolOption = {
  type: "textbox",
  label: "Metin kutusu ekle",
  icon: "chatbox-outline",
};

/** Ana haritada freehand yok; editörde tam liste. */
export function getShapeDrawOptionsForSurface(surface: "home" | "editor"): MapDrawToolOption[] {
  if (surface === "home") {
    return SHAPE_DRAW_OPTIONS.filter((o) => o.type !== "freehand");
  }
  return SHAPE_DRAW_OPTIONS;
}
