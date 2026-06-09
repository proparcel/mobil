using UnityEngine;

namespace ProParcel.Terrain3d
{
    public static class TerrainElevationSampler
    {
        public static float SampleElevationBilinear(Terrain3dGridDto terrain, float worldX, float worldZ)
        {
            if (terrain == null || terrain.elevations == null || terrain.width <= 0 || terrain.height <= 0)
            {
                return 0f;
            }

            float colF = (worldX - terrain.origin.x) / terrain.cellSizeM;
            float rowF = (worldZ - terrain.origin.z) / terrain.cellSizeM;

            int col0 = Mathf.Clamp(Mathf.FloorToInt(colF), 0, terrain.width - 1);
            int row0 = Mathf.Clamp(Mathf.FloorToInt(rowF), 0, terrain.height - 1);
            int col1 = Mathf.Min(col0 + 1, terrain.width - 1);
            int row1 = Mathf.Min(row0 + 1, terrain.height - 1);

            float fc = Mathf.Clamp01(colF - col0);
            float fr = Mathf.Clamp01(rowF - row0);

            float e00 = ReadElevation(terrain, col0, row0);
            float e10 = ReadElevation(terrain, col1, row0);
            float e01 = ReadElevation(terrain, col0, row1);
            float e11 = ReadElevation(terrain, col1, row1);

            float top = Mathf.Lerp(e00, e10, fc);
            float bottom = Mathf.Lerp(e01, e11, fc);
            return Mathf.Lerp(top, bottom, fr);
        }

        public static float WorldHeight(
            Terrain3dGridDto terrain,
            float worldX,
            float worldZ,
            float baseElevation,
            float heightScale)
        {
            float elevation = SampleElevationBilinear(terrain, worldX, worldZ);
            return (elevation - baseElevation) * heightScale;
        }

        private static float ReadElevation(Terrain3dGridDto terrain, int col, int row)
        {
            int idx = row * terrain.width + col;
            if (idx < 0 || idx >= terrain.elevations.Length) return 0f;
            return terrain.elevations[idx];
        }
    }
}
