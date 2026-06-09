using System.Collections.Generic;
using UnityEngine;

namespace ProParcel.VrParcel.Rendering
{
    public class ParcelBorderRenderer : MonoBehaviour
    {
        private const float BorderWidthM = 0.14f;
        private const float UnderlayWidthM = 0.22f;
        private const float LineHeightOffsetM = 0.12f;

        [SerializeField] private Material lineMaterial;
        [SerializeField] private GameObject cornerMarkerPrefab;
        [SerializeField] private GameObject labelPrefab;
        [SerializeField] private Color lineColor = new Color(0.23f, 0.51f, 0.96f, 0.98f);

        private LineRenderer lineRenderer;
        private LineRenderer underlayRenderer;
        private readonly List<GameObject> spawned = new List<GameObject>();

        public void Clear()
        {
            if (lineRenderer != null)
                Destroy(lineRenderer.gameObject);
            if (underlayRenderer != null)
                Destroy(underlayRenderer.gameObject);
            lineRenderer = null;
            underlayRenderer = null;
            foreach (var go in spawned)
                if (go != null) Destroy(go);
            spawned.Clear();
        }

        public void RenderPolygon(IList<Vector3> points, string ada, string parsel, float areaM2, bool localSpace = false)
        {
            Clear();
            if (points == null || points.Count < 3) return;

            Transform parent = VrParcelWorldRoot.Instance != null
                ? VrParcelWorldRoot.Instance.Root
                : transform;

            var elevated = new Vector3[points.Count];
            for (int i = 0; i < points.Count; i++)
                elevated[i] = points[i] + Vector3.up * LineHeightOffsetM;

            underlayRenderer = CreateLineRenderer(parent, "ParcelBorderUnderlay", localSpace);
            ConfigureLine(underlayRenderer, UnderlayWidthM, new Color(0.05f, 0.16f, 0.55f, 0.72f));
            SetLinePositions(underlayRenderer, elevated);
            AttachWidthScaler(underlayRenderer, UnderlayWidthM);

            lineRenderer = CreateLineRenderer(parent, "ParcelBorder", localSpace);
            ConfigureLine(lineRenderer, BorderWidthM, lineColor);
            SetLinePositions(lineRenderer, elevated);
            AttachWidthScaler(lineRenderer, BorderWidthM);

            for (int i = 0; i < points.Count; i++)
            {
                if (cornerMarkerPrefab == null) continue;
                Vector3 worldPos = localSpace
                    ? parent.TransformPoint(points[i] + Vector3.up * (LineHeightOffsetM + 0.04f))
                    : points[i] + Vector3.up * (LineHeightOffsetM + 0.04f);
                var marker = Instantiate(cornerMarkerPrefab, worldPos, Quaternion.identity, parent);
                spawned.Add(marker);
            }

            Vector3 center = Vector3.zero;
            foreach (var p in points) center += p;
            center /= points.Count;
            Vector3 labelPos = localSpace
                ? parent.TransformPoint(center + Vector3.up * 0.35f)
                : center + Vector3.up * 0.35f;

            if (labelPrefab != null)
            {
                var label = Instantiate(labelPrefab, labelPos, Quaternion.identity, parent);
                spawned.Add(label);
                var tm = label.GetComponentInChildren<TMPro.TextMeshPro>();
                if (tm != null)
                {
                    string areaText = areaM2 > 0 ? $"\nAlan: {areaM2:N0} m²" : "";
                    tm.text = $"Ada: {ada}\nParsel: {parsel}{areaText}";
                }
            }
        }

        public void RenderPolygon(IList<Vector3> worldPoints, string ada, string parsel, float areaM2)
        {
            RenderPolygon(worldPoints, ada, parsel, areaM2, false);
        }

        private static LineRenderer CreateLineRenderer(Transform parent, string name, bool localSpace)
        {
            var lineGo = new GameObject(name);
            lineGo.transform.SetParent(parent, false);
            var lr = lineGo.AddComponent<LineRenderer>();
            lr.useWorldSpace = !localSpace;
            lr.alignment = LineAlignment.View;
            lr.textureMode = LineTextureMode.Stretch;
            lr.numCapVertices = 10;
            lr.numCornerVertices = 8;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;
            lr.loop = true;
            return lr;
        }

        private void ConfigureLine(LineRenderer lr, float widthM, Color color)
        {
            lr.material = lineMaterial != null
                ? lineMaterial
                : CreateFallbackLineMaterial();
            lr.startColor = color;
            lr.endColor = color;
            lr.startWidth = widthM;
            lr.endWidth = widthM;
            lr.widthMultiplier = 1f;
        }

        private static Material CreateFallbackLineMaterial()
        {
            var shader = Shader.Find("Unlit/Color");
            if (shader == null)
                shader = Shader.Find("Sprites/Default");
            var mat = new Material(shader);
            mat.color = Color.white;
            mat.renderQueue = 3100;
            return mat;
        }

        private static void AttachWidthScaler(LineRenderer lr, float baseWidthM)
        {
            var scaler = lr.gameObject.AddComponent<ParcelBorderLineWidthScaler>();
            scaler.Configure(lr, baseWidthM);
        }

        private static void SetLinePositions(LineRenderer lr, Vector3[] points)
        {
            lr.positionCount = points.Length;
            for (int i = 0; i < points.Length; i++)
                lr.SetPosition(i, points[i]);
        }
    }
}
