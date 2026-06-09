using UnityEngine;

namespace ProParcel.Terrain3d
{
    /** Parsel sinir cizgisi — world space, terrain yuzeyi ustunde. */
    public class ParcelBorderLineRenderer : MonoBehaviour
    {
        private const float BorderYOffset = 0.08f;

        [SerializeField] private float lineWidth = 0.12f;

        private LineRenderer lineRenderer;

        public void RenderBorder(
            Terrain3dGridDto terrain,
            Terrain3dPointXZ[] polygon,
            float baseElevation,
            float heightScale)
        {
            Clear();
            if (terrain == null || polygon == null || polygon.Length < 3)
            {
                Terrain3dAndroidLog.Error("[ParcelBorder] render skipped polygon=" +
                    (polygon?.Length ?? 0));
                return;
            }

            lineRenderer = GetComponent<LineRenderer>();
            if (lineRenderer == null)
                lineRenderer = gameObject.AddComponent<LineRenderer>();

            lineRenderer.useWorldSpace = true;
            lineRenderer.loop = true;
            lineRenderer.positionCount = polygon.Length;
            lineRenderer.startWidth = lineWidth;
            lineRenderer.endWidth = lineWidth;
            lineRenderer.numCapVertices = 4;
            lineRenderer.numCornerVertices = 4;
            lineRenderer.startColor = TerrainSlopeColorPalette.ParcelBorder;
            lineRenderer.endColor = TerrainSlopeColorPalette.ParcelBorder;
            lineRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lineRenderer.receiveShadows = false;
            lineRenderer.enabled = true;

            var lineMat = CreateLineMaterial();
            if (lineMat != null)
                lineRenderer.material = lineMat;

            bool samplerOk = terrain.elevations != null && terrain.mask != null;
            for (int i = 0; i < polygon.Length; i++)
            {
                float y = TerrainElevationSampler.WorldHeight(
                    terrain,
                    polygon[i].x,
                    polygon[i].z,
                    baseElevation,
                    heightScale) + BorderYOffset;
                lineRenderer.SetPosition(i, new Vector3(polygon[i].x, y, polygon[i].z));
            }

            Terrain3dAndroidLog.Info("[ParcelBorder] border render success pointCount=" +
                polygon.Length + " samplerAvailable=" + samplerOk + " lineWidth=" + lineWidth);
        }

        public void Clear()
        {
            var lines = GetComponents<LineRenderer>();
            for (int i = 0; i < lines.Length; i++)
                Destroy(lines[i]);
            lineRenderer = null;
        }

        private static Material CreateLineMaterial()
        {
            var shader = Shader.Find("Unlit/Color");
            if (shader == null)
                shader = Shader.Find("Sprites/Default");
            if (shader == null)
                return null;

            var mat = new Material(shader);
            mat.color = TerrainSlopeColorPalette.ParcelBorder;
            return mat;
        }
    }
}
