using UnityEngine;

namespace ProParcel.Terrain3d
{
    public class ParcelTerrain3dBorderRenderer : MonoBehaviour
    {
        private static readonly Color BorderLineColor = new Color(0.12f, 0.25f, 0.69f, 1f);
        private static readonly Color FillColor = new Color(0.12f, 0.25f, 0.69f, 0.14f);

        [SerializeField] private float lineWidth = 0.28f;
        [SerializeField] private float surfaceOffset = 0.12f;

        private LineRenderer lineRenderer;
        private MeshRenderer fillRenderer;
        private MeshFilter fillFilter;
        private Mesh fillMesh;

        public void RenderParcelOverlay(
            Terrain3dGridDto terrain,
            Terrain3dPointXZ[] polygon,
            float baseElevation,
            float heightScale)
        {
            Clear();
            if (terrain == null || polygon == null || polygon.Length < 3) return;

            RenderBorderLine(terrain, polygon, baseElevation, heightScale);
            RenderFillMesh(terrain, polygon, baseElevation, heightScale);
        }

        private void RenderBorderLine(
            Terrain3dGridDto terrain,
            Terrain3dPointXZ[] polygon,
            float baseElevation,
            float heightScale)
        {
            lineRenderer = GetComponent<LineRenderer>();
            if (lineRenderer == null)
            {
                lineRenderer = gameObject.AddComponent<LineRenderer>();
            }

            if (lineRenderer == null)
            {
                Terrain3dAndroidLog.Error("[ParcelBorder] LineRenderer olusturulamadi");
                return;
            }

            lineRenderer.useWorldSpace = true;
            lineRenderer.loop = true;
            lineRenderer.positionCount = polygon.Length;
            lineRenderer.startWidth = lineWidth;
            lineRenderer.endWidth = lineWidth;
            lineRenderer.numCapVertices = 4;
            lineRenderer.numCornerVertices = 4;
            var lineMat = CreateUnlitMaterial(BorderLineColor);
            if (lineMat != null)
            {
                lineRenderer.material = lineMat;
            }
            lineRenderer.startColor = BorderLineColor;
            lineRenderer.endColor = BorderLineColor;
            lineRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lineRenderer.receiveShadows = false;
            lineRenderer.enabled = true;

            for (int i = 0; i < polygon.Length; i++)
            {
                float y = TerrainElevationSampler.WorldHeight(
                    terrain,
                    polygon[i].x,
                    polygon[i].z,
                    baseElevation,
                    heightScale) + surfaceOffset;
                lineRenderer.SetPosition(i, new Vector3(polygon[i].x, y, polygon[i].z));
            }
        }

        private void RenderFillMesh(
            Terrain3dGridDto terrain,
            Terrain3dPointXZ[] polygon,
            float baseElevation,
            float heightScale)
        {
            var fillGo = new GameObject("ParcelFill");
            fillGo.transform.SetParent(transform, false);
            fillFilter = fillGo.AddComponent<MeshFilter>();
            fillRenderer = fillGo.AddComponent<MeshRenderer>();

            var vertices = new Vector3[polygon.Length];
            for (int i = 0; i < polygon.Length; i++)
            {
                float y = TerrainElevationSampler.WorldHeight(
                    terrain,
                    polygon[i].x,
                    polygon[i].z,
                    baseElevation,
                    heightScale) + surfaceOffset * 0.85f;
                vertices[i] = new Vector3(polygon[i].x, y, polygon[i].z);
            }

            var triangles = new int[(polygon.Length - 2) * 3];
            for (int i = 1; i < polygon.Length - 1; i++)
            {
                int tri = (i - 1) * 3;
                triangles[tri] = 0;
                triangles[tri + 1] = i;
                triangles[tri + 2] = i + 1;
            }

            fillMesh = new Mesh();
            fillMesh.vertices = vertices;
            fillMesh.triangles = triangles;
            fillMesh.RecalculateNormals();
            fillMesh.RecalculateBounds();
            fillFilter.sharedMesh = fillMesh;

            var fillMat = CreateTransparentMaterial(FillColor);
            if (fillMat != null)
            {
                fillRenderer.sharedMaterial = fillMat;
            }
            fillRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            fillRenderer.receiveShadows = false;
        }

        public Bounds ComputeOverlayBounds(
            Terrain3dGridDto terrain,
            Terrain3dPointXZ[] polygon,
            float baseElevation,
            float heightScale)
        {
            if (polygon == null || polygon.Length == 0) return new Bounds(Vector3.zero, Vector3.one);

            var min = new Vector3(float.MaxValue, float.MaxValue, float.MaxValue);
            var max = new Vector3(float.MinValue, float.MinValue, float.MinValue);

            foreach (var p in polygon)
            {
                float y = TerrainElevationSampler.WorldHeight(
                    terrain, p.x, p.z, baseElevation, heightScale) + surfaceOffset;
                min = Vector3.Min(min, new Vector3(p.x, y, p.z));
                max = Vector3.Max(max, new Vector3(p.x, y, p.z));
            }

            var bounds = new Bounds();
            bounds.SetMinMax(min, max);
            return bounds;
        }

        public void Clear()
        {
            var existingLines = GetComponents<LineRenderer>();
            for (int i = 0; i < existingLines.Length; i++)
            {
                Destroy(existingLines[i]);
            }
            lineRenderer = null;

            if (fillMesh != null)
            {
                Destroy(fillMesh);
                fillMesh = null;
            }

            if (fillFilter != null)
            {
                Destroy(fillFilter.gameObject);
                fillFilter = null;
                fillRenderer = null;
            }
        }

        private static Material CreateUnlitMaterial(Color color)
        {
            var shader = Shader.Find("Unlit/Color");
            if (shader == null) shader = Shader.Find("Sprites/Default");
            if (shader == null)
            {
                Terrain3dAndroidLog.Error("[ParcelBorder] Unlit shader bulunamadi");
                return null;
            }

            var mat = new Material(shader);
            mat.color = color;
            return mat;
        }

        private static Material CreateTransparentMaterial(Color color)
        {
            var shader = Shader.Find("Legacy Shaders/Transparent/Diffuse");
            if (shader == null) shader = Shader.Find("Mobile/Particles/Alpha Blended");
            if (shader == null) shader = Shader.Find("Sprites/Default");
            if (shader == null)
            {
                Terrain3dAndroidLog.Error("[ParcelBorder] Transparent shader bulunamadi");
                return null;
            }

            var mat = new Material(shader);
            mat.color = color;
            return mat;
        }
    }
}
