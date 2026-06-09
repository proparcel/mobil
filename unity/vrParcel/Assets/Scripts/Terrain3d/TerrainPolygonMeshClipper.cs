using System.Collections.Generic;
using UnityEngine;

namespace ProParcel.Terrain3d
{
    internal struct TerrainMeshVertex
    {
        public Vector3 Position;
        public Color Color;
        public Vector2 Uv;

        public TerrainMeshVertex(Vector3 position, Color color, Vector2 uv)
        {
            Position = position;
            Color = color;
            Uv = uv;
        }

        public TerrainMeshVertex Lerp(TerrainMeshVertex other, float t)
        {
            return new TerrainMeshVertex(
                Vector3.Lerp(Position, other.Position, t),
                Color.Lerp(Color, other.Color, t),
                Vector2.Lerp(Uv, other.Uv, t));
        }
    }

    internal static class TerrainPolygonMeshClipper
    {
        public static void ClipAndAppendTriangle(
            TerrainMeshVertex v0,
            TerrainMeshVertex v1,
            TerrainMeshVertex v2,
            Vector2[] polygonXz,
            List<TerrainMeshVertex> outVertices,
            List<int> outTriangles)
        {
            if (polygonXz == null || polygonXz.Length < 3)
            {
                AppendTriangle(v0, v1, v2, outVertices, outTriangles);
                return;
            }

            var poly = new List<TerrainMeshVertex> { v0, v1, v2 };
            for (int i = 0; i < polygonXz.Length; i++)
            {
                var edgeStart = polygonXz[i];
                var edgeEnd = polygonXz[(i + 1) % polygonXz.Length];
                poly = ClipByEdge(poly, edgeStart, edgeEnd);
                if (poly.Count < 3) return;
            }

            FanTriangulate(poly, outVertices, outTriangles);
        }

        private static void AppendTriangle(
            TerrainMeshVertex v0,
            TerrainMeshVertex v1,
            TerrainMeshVertex v2,
            List<TerrainMeshVertex> outVertices,
            List<int> outTriangles)
        {
            int baseIndex = outVertices.Count;
            outVertices.Add(v0);
            outVertices.Add(v1);
            outVertices.Add(v2);
            outTriangles.Add(baseIndex);
            outTriangles.Add(baseIndex + 1);
            outTriangles.Add(baseIndex + 2);
        }

        private static void FanTriangulate(
            List<TerrainMeshVertex> poly,
            List<TerrainMeshVertex> outVertices,
            List<int> outTriangles)
        {
            if (poly.Count < 3) return;
            int baseIndex = outVertices.Count;
            outVertices.AddRange(poly);
            for (int i = 1; i < poly.Count - 1; i++)
            {
                outTriangles.Add(baseIndex);
                outTriangles.Add(baseIndex + i);
                outTriangles.Add(baseIndex + i + 1);
            }
        }

        private static List<TerrainMeshVertex> ClipByEdge(
            List<TerrainMeshVertex> input,
            Vector2 edgeStart,
            Vector2 edgeEnd)
        {
            if (input.Count == 0) return input;

            var output = new List<TerrainMeshVertex>(input.Count + 1);
            for (int i = 0; i < input.Count; i++)
            {
                var current = input[i];
                var previous = input[(i + input.Count - 1) % input.Count];

                bool currInside = IsInside(current, edgeStart, edgeEnd);
                bool prevInside = IsInside(previous, edgeStart, edgeEnd);

                if (currInside)
                {
                    if (!prevInside)
                        output.Add(Intersect(previous, current, edgeStart, edgeEnd));
                    output.Add(current);
                }
                else if (prevInside)
                {
                    output.Add(Intersect(previous, current, edgeStart, edgeEnd));
                }
            }

            return output;
        }

        private static bool IsInside(TerrainMeshVertex vertex, Vector2 edgeStart, Vector2 edgeEnd)
        {
            var p = new Vector2(vertex.Position.x, vertex.Position.z);
            float cross = (edgeEnd.x - edgeStart.x) * (p.y - edgeStart.y) -
                (edgeEnd.y - edgeStart.y) * (p.x - edgeStart.x);
            return cross >= -0.0001f;
        }

        private static TerrainMeshVertex Intersect(
            TerrainMeshVertex a,
            TerrainMeshVertex b,
            Vector2 edgeStart,
            Vector2 edgeEnd)
        {
            var p1 = new Vector2(a.Position.x, a.Position.z);
            var p2 = new Vector2(b.Position.x, b.Position.z);
            var d1 = p2 - p1;
            var d2 = edgeEnd - edgeStart;
            float denom = d1.x * d2.y - d1.y * d2.x;
            if (Mathf.Abs(denom) < 1e-6f)
                return a;

            var p0 = edgeStart - p1;
            float t = (p0.x * d2.y - p0.y * d2.x) / denom;
            t = Mathf.Clamp01(t);
            return a.Lerp(b, t);
        }

        public static Vector2[] ToPolygonXz(Terrain3dPointXZ[] polygon)
        {
            var result = new Vector2[polygon.Length];
            for (int i = 0; i < polygon.Length; i++)
                result[i] = new Vector2(polygon[i].x, polygon[i].z);
            return result;
        }
    }
}
