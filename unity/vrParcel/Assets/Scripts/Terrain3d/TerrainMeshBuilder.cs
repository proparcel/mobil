using System.Collections.Generic;
using UnityEngine;

namespace ProParcel.Terrain3d
{
    public enum TerrainSurfaceRenderMode
    {
        VertexColor,
        TextureFallback,
    }

    public static class TerrainMeshBuilder
    {
        public static string ValidatePayload(ParcelTerrain3dDto dto)
        {
            if (dto == null) return "null payload";
            if (dto.type != "parcel_terrain_3d") return "invalid type: " + (dto.type ?? "null");
            if (dto.terrain == null) return "missing terrain";

            var t = dto.terrain;
            if (t.width <= 0 || t.height <= 0) return "invalid dimensions";
            int n = t.width * t.height;

            if (t.elevations == null || t.elevations.Length != n)
                return "elevations length " + (t.elevations?.Length ?? 0) + " != " + n;

            if (t.slopes == null || t.slopes.Length != n)
                return "slopes length " + (t.slopes?.Length ?? 0) + " != " + n;

            if (t.mask == null || t.mask.Length != n)
                return "mask length " + (t.mask?.Length ?? 0) + " != " + n;

            if (dto.parcel?.localPolygon == null || dto.parcel.localPolygon.Length < 3)
                return "localPolygon count " + (dto.parcel?.localPolygon?.Length ?? 0) + " < 3";

            return null;
        }

        public static bool TryBuildMesh(
            ParcelTerrain3dDto dto,
            out Mesh mesh,
            out float baseElevation,
            out Texture2D slopeTexture,
            out string error)
        {
            mesh = null;
            slopeTexture = null;
            baseElevation = 0f;
            error = ValidatePayload(dto);
            if (error != null) return false;

            var t = dto.terrain;
            int w = t.width;
            int h = t.height;
            float cell = t.cellSizeM;
            float heightScale = t.heightScaleSuggestion > 0f ? t.heightScaleSuggestion : 1f;
            float originX = t.origin.x;
            float originZ = t.origin.z;

            int maskInsideCount = CountMaskInside(t);
            Terrain3dAndroidLog.Event("unity.mesh.grid", Terrain3dLogData.New()
                .Add("width", w)
                .Add("height", h)
                .Add("cellSizeM", cell)
                .Add("elevationsLength", t.elevations.Length)
                .Add("slopesLength", t.slopes.Length)
                .Add("maskLength", t.mask.Length)
                .Add("maskInsideCount", maskInsideCount));

            baseElevation = ComputeMinElevationInMask(t);
            float minElev = baseElevation;
            var polygonXz = EnsureCounterClockwise(TerrainPolygonMeshClipper.ToPolygonXz(dto.parcel.localPolygon));
            slopeTexture = BuildSlopeTexture(t);

            var vertices = new List<TerrainMeshVertex>();
            var triangles = new List<int>();

            float U(int col) => w > 1 ? col / (float)(w - 1) : 0f;
            float V(int row) => h > 1 ? row / (float)(h - 1) : 0f;

            TerrainMeshVertex VertexAt(int col, int row)
            {
                int idx = row * w + col;
                float x = originX + col * cell;
                float z = originZ + row * cell;
                float y = (t.elevations[idx] - minElev) * heightScale;
                var color = TerrainSlopeColorPalette.GetSlopeColor(t.slopes[idx]);
                return new TerrainMeshVertex(
                    new Vector3(x, y, z),
                    color,
                    new Vector2(U(col), V(row)));
            }

            for (int row = 0; row < h - 1; row++)
            {
                for (int col = 0; col < w - 1; col++)
                {
                    int i00 = row * w + col;
                    int i10 = row * w + (col + 1);
                    int i01 = (row + 1) * w + col;
                    int i11 = (row + 1) * w + (col + 1);

                    // Sinir hucrelerini KORU: yalnizca tamamen mask disindaki hucreler atlanir.
                    // Kalan hucreler asagida parcel.localPolygon ile clip edilir, boylece kenarlar
                    // parsel sinirina temiz oturur (dis/disli kenar olusmaz, dis tasma olmaz).
                    if (t.mask[i00] != 1 && t.mask[i10] != 1 && t.mask[i01] != 1 && t.mask[i11] != 1)
                        continue;

                    var v00 = VertexAt(col, row);
                    var v10 = VertexAt(col + 1, row);
                    var v01 = VertexAt(col, row + 1);
                    var v11 = VertexAt(col + 1, row + 1);

                    TerrainPolygonMeshClipper.ClipAndAppendTriangle(v00, v01, v10, polygonXz, vertices, triangles);
                    TerrainPolygonMeshClipper.ClipAndAppendTriangle(v10, v01, v11, polygonXz, vertices, triangles);
                }
            }

            if (vertices.Count == 0 || triangles.Count == 0)
            {
                error = "empty mesh (mask icinde vertex yok)";
                return false;
            }

            var meshVertices = new Vector3[vertices.Count];
            var meshColors = new Color[vertices.Count];
            var meshUvs = new Vector2[vertices.Count];
            for (int i = 0; i < vertices.Count; i++)
            {
                meshVertices[i] = vertices[i].Position;
                meshColors[i] = vertices[i].Color;
                meshUvs[i] = vertices[i].Uv;
            }

            mesh = new Mesh();
            mesh.indexFormat = vertices.Count > 65000
                ? UnityEngine.Rendering.IndexFormat.UInt32
                : UnityEngine.Rendering.IndexFormat.UInt16;
            mesh.vertices = meshVertices;
            mesh.triangles = triangles.ToArray();
            mesh.colors = meshColors;
            mesh.uv = meshUvs;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            Terrain3dAndroidLog.Info("[TerrainMeshBuilder] triangleCount=" + (triangles.Count / 3) +
                " vertexCount=" + vertices.Count + " baseElev=" + baseElevation);

            error = null;
            return true;
        }

        public static Material CreateTextureFallbackMaterial(Texture2D slopeTexture)
        {
            if (slopeTexture == null) return null;

            var shaderNames = new[] { "Unlit/Texture", "Mobile/Unlit (Supports Lightmap)", "Sprites/Default" };
            Shader shader = null;
            foreach (var name in shaderNames)
            {
                shader = Shader.Find(name);
                if (shader != null) break;
            }

            if (shader == null)
            {
                Terrain3dAndroidLog.Error("[TerrainMeshBuilder] texture fallback shader yok");
                return null;
            }

            var mat = new Material(shader);
            mat.mainTexture = slopeTexture;
            mat.color = Color.white;
            return mat;
        }

        private static Texture2D BuildSlopeTexture(Terrain3dGridDto t)
        {
            int w = t.width;
            int h = t.height;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false)
            {
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
            };

            for (int row = 0; row < h; row++)
            {
                for (int col = 0; col < w; col++)
                {
                    int idx = row * w + col;
                    var color = t.mask[idx] == 1
                        ? TerrainSlopeColorPalette.GetSlopeColor(t.slopes[idx])
                        : TerrainSlopeColorPalette.Background;
                    tex.SetPixel(col, h - 1 - row, color);
                }
            }

            tex.Apply(false, false);
            return tex;
        }

        public static int CountMaskInside(Terrain3dGridDto t)
        {
            int count = 0;
            for (int i = 0; i < t.mask.Length; i++)
            {
                if (t.mask[i] == 1) count++;
            }
            return count;
        }

        private static float ComputeMinElevationInMask(Terrain3dGridDto t)
        {
            float min = float.MaxValue;
            bool any = false;
            for (int i = 0; i < t.mask.Length; i++)
            {
                if (t.mask[i] != 1) continue;
                min = Mathf.Min(min, t.elevations[i]);
                any = true;
            }
            return any ? min : 0f;
        }

        private static Vector2[] EnsureCounterClockwise(Vector2[] polygon)
        {
            if (polygon == null || polygon.Length < 3) return polygon;
            float area = 0f;
            for (int i = 0; i < polygon.Length; i++)
            {
                var a = polygon[i];
                var b = polygon[(i + 1) % polygon.Length];
                area += a.x * b.y - b.x * a.y;
            }

            if (area >= 0f) return polygon;

            var reversed = new Vector2[polygon.Length];
            for (int i = 0; i < polygon.Length; i++)
                reversed[i] = polygon[polygon.Length - 1 - i];
            return reversed;
        }
    }
}
