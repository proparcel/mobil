using UnityEngine;

namespace ProParcel.Terrain3d
{
    public static class TerrainSlopeColorPalette
    {
        public static readonly Color LowSlopeGreen = Hex("#6FA36A");
        public static readonly Color SoftOlive = Hex("#A7B86A");
        public static readonly Color DrySoil = Hex("#C7A45D");
        public static readonly Color OrangeSoil = Hex("#B97A4A");
        public static readonly Color DarkSoil = Hex("#8F5638");

        public static readonly Color ParcelBorder = Hex("#1E4D8F");
        public static readonly Color ParcelBorderHighlight = Hex("#4EA1FF");
        public static readonly Color Background = Hex("#EAF1F7");
        public static readonly Color BackgroundTop = Hex("#2B3F56");
        public static readonly Color BackgroundBottom = Hex("#EAF1F7");

        public static Color GetSlopeColor(float slopeDeg)
        {
            slopeDeg = Mathf.Max(0f, slopeDeg);

            if (slopeDeg <= 5f)
                return Color.Lerp(LowSlopeGreen, SoftOlive, Mathf.InverseLerp(0f, 5f, slopeDeg));

            if (slopeDeg <= 12f)
                return Color.Lerp(SoftOlive, DrySoil, Mathf.InverseLerp(5f, 12f, slopeDeg));

            if (slopeDeg <= 20f)
                return Color.Lerp(DrySoil, OrangeSoil, Mathf.InverseLerp(12f, 20f, slopeDeg));

            if (slopeDeg <= 35f)
                return Color.Lerp(OrangeSoil, DarkSoil, Mathf.InverseLerp(20f, 35f, slopeDeg));

            return DarkSoil;
        }

        public static Color Hex(string hex)
        {
            if (ColorUtility.TryParseHtmlString(hex, out var color))
                return color;
            return Color.white;
        }
    }
}
