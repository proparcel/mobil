using System;
using UnityEngine;

namespace ProParcel.Terrain3d
{
    /** Gomulu demo terrain — RN payload / trigger / UnitySendMessage gerektirmez. */
    public static class Terrain3dEmbeddedDemo
    {
        public static ParcelTerrain3dDto Build(string ada = "Demo", string parsel = "42")
        {
            const int width = 40;
            const int height = 40;
            const float cellSizeM = 2f;
            var origin = new Terrain3dOriginDto { x = -40f, z = -40f };

            var localPolygon = new[]
            {
                new Terrain3dPointXZ { x = -18f, z = -14f },
                new Terrain3dPointXZ { x = 16f, z = -10f },
                new Terrain3dPointXZ { x = 22f, z = 12f },
                new Terrain3dPointXZ { x = -12f, z = 16f },
            };

            int n = width * height;
            var elevations = new float[n];
            var slopes = new float[n];
            var mask = new int[n];

            for (int row = 0; row < height; row++)
            {
                for (int col = 0; col < width; col++)
                {
                    int idx = row * width + col;
                    float x = origin.x + col * cellSizeM;
                    float z = origin.z + row * cellSizeM;
                    float dist2 = x * x + z * z;
                    float hill = 6f * Mathf.Exp(-dist2 / 900f);
                    float ripple = 1.2f * Mathf.Sin(x * 0.12f) * Mathf.Cos(z * 0.1f);
                    elevations[idx] = 102f + hill + ripple;
                    mask[idx] = PointInPolygon(x, z, localPolygon) ? 1 : 0;
                }
            }

            for (int row = 0; row < height; row++)
            {
                for (int col = 0; col < width; col++)
                {
                    int idx = row * width + col;
                    float e = elevations[idx];
                    float maxGrad = 0f;
                    if (col > 0) maxGrad = Mathf.Max(maxGrad, Mathf.Abs(e - elevations[idx - 1]) / cellSizeM);
                    if (col < width - 1) maxGrad = Mathf.Max(maxGrad, Mathf.Abs(e - elevations[idx + 1]) / cellSizeM);
                    if (row > 0) maxGrad = Mathf.Max(maxGrad, Mathf.Abs(e - elevations[idx - width]) / cellSizeM);
                    if (row < height - 1) maxGrad = Mathf.Max(maxGrad, Mathf.Abs(e - elevations[idx + width]) / cellSizeM);
                    slopes[idx] = Mathf.Atan(maxGrad) * Mathf.Rad2Deg;
                }
            }

            return new ParcelTerrain3dDto
            {
                version = 1,
                type = "parcel_terrain_3d",
                parcel = new Terrain3dParcelDto
                {
                    ada = ada,
                    parsel = parsel,
                    areaM2 = 1250f,
                    center = new Terrain3dLatLonDto { lat = 41.015, lon = 29.004 },
                    localPolygon = localPolygon,
                },
                terrain = new Terrain3dGridDto
                {
                    gridType = "regular",
                    width = width,
                    height = height,
                    cellSizeM = cellSizeM,
                    origin = origin,
                    heightScaleSuggestion = 1.2f,
                    elevations = elevations,
                    slopes = slopes,
                    mask = mask,
                },
                render = new Terrain3dRenderDto
                {
                    slopeColorStops = new[]
                    {
                        new Terrain3dColorStopDto { maxSlopeDeg = 8f, label = "Duz", color = "#4CAF50" },
                        new Terrain3dColorStopDto { maxSlopeDeg = 15f, label = "Hafif", color = "#A8CF45" },
                        new Terrain3dColorStopDto { maxSlopeDeg = 22f, label = "Orta", color = "#FBC02D" },
                        new Terrain3dColorStopDto { maxSlopeDeg = 30f, label = "Dik", color = "#FB8C00" },
                        new Terrain3dColorStopDto { maxSlopeDeg = 999f, label = "Cok dik", color = "#E53935" },
                    },
                    showParcelBorder = true,
                    showSlopeLegend = true,
                    showElevationLegend = true,
                },
                stats = new Terrain3dStatsDto
                {
                    slope_avg_poly = 12.4f,
                    slope_max_poly = 28.6f,
                    elevation_min = 102f,
                    elevation_max = 110f,
                },
            };
        }

        private static bool PointInPolygon(float x, float z, Terrain3dPointXZ[] polygon)
        {
            bool inside = false;
            for (int i = 0, j = polygon.Length - 1; i < polygon.Length; j = i++)
            {
                float xi = polygon[i].x;
                float zi = polygon[i].z;
                float xj = polygon[j].x;
                float zj = polygon[j].z;
                bool intersect = (zi > z) != (zj > z) &&
                    x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-6f) + xi;
                if (intersect) inside = !inside;
            }
            return inside;
        }
    }
}
