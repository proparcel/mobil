using UnityEngine;

namespace ProParcel.Terrain3d
{
    /**
     * Grid uzerinde bilinear ornekleme yardimcisi. Polygon clip sirasinda olusan yeni
     * kenar vertexleri icin elevation/slope/renk degerleri buradan interpolasyonla alinir.
     * Ayrica nokta parsel polygonu icinde mi testi sunar.
     *
     * Koordinat sistemi: localX/localZ = lokal metre (origin + col*cellSizeM, origin + row*cellSizeM).
     */
    public sealed class TerrainGridSampler
    {
        private readonly Terrain3dGridDto terrain;
        private readonly Vector2[] polygonXz;

        public TerrainGridSampler(Terrain3dGridDto terrain, Vector2[] polygonXz)
        {
            this.terrain = terrain;
            this.polygonXz = polygonXz;
        }

        public float SampleElevation(float localX, float localZ)
        {
            return TerrainElevationSampler.SampleElevationBilinear(terrain, localX, localZ);
        }

        public float SampleSlope(float localX, float localZ)
        {
            if (terrain == null || terrain.slopes == null || terrain.width <= 0 || terrain.height <= 0)
            {
                return 0f;
            }

            float colF = (localX - terrain.origin.x) / terrain.cellSizeM;
            float rowF = (localZ - terrain.origin.z) / terrain.cellSizeM;

            int col0 = Mathf.Clamp(Mathf.FloorToInt(colF), 0, terrain.width - 1);
            int row0 = Mathf.Clamp(Mathf.FloorToInt(rowF), 0, terrain.height - 1);
            int col1 = Mathf.Min(col0 + 1, terrain.width - 1);
            int row1 = Mathf.Min(row0 + 1, terrain.height - 1);

            float fc = Mathf.Clamp01(colF - col0);
            float fr = Mathf.Clamp01(rowF - row0);

            float s00 = ReadSlope(col0, row0);
            float s10 = ReadSlope(col1, row0);
            float s01 = ReadSlope(col0, row1);
            float s11 = ReadSlope(col1, row1);

            float top = Mathf.Lerp(s00, s10, fc);
            float bottom = Mathf.Lerp(s01, s11, fc);
            return Mathf.Lerp(top, bottom, fr);
        }

        public Color SampleSlopeColor(float localX, float localZ)
        {
            return TerrainSlopeColorPalette.GetSlopeColor(SampleSlope(localX, localZ));
        }

        public bool IsInsideParcelPolygon(float localX, float localZ)
        {
            if (polygonXz == null || polygonXz.Length < 3) return true;

            bool inside = false;
            for (int i = 0, j = polygonXz.Length - 1; i < polygonXz.Length; j = i++)
            {
                float xi = polygonXz[i].x;
                float zi = polygonXz[i].y;
                float xj = polygonXz[j].x;
                float zj = polygonXz[j].y;
                bool intersect = (zi > localZ) != (zj > localZ) &&
                    localX < ((xj - xi) * (localZ - zi)) / (zj - zi + 1e-6f) + xi;
                if (intersect) inside = !inside;
            }
            return inside;
        }

        private float ReadSlope(int col, int row)
        {
            int idx = row * terrain.width + col;
            if (idx < 0 || idx >= terrain.slopes.Length) return 0f;
            return terrain.slopes[idx];
        }
    }
}
