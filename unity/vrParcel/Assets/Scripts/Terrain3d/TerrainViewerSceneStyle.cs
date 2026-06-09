using UnityEngine;

namespace ProParcel.Terrain3d
{
    /** Kamera arka plan + kurumsal gradient backdrop. */
    public class TerrainViewerSceneStyle : MonoBehaviour
    {
        [SerializeField] private Camera targetCamera;

        private GameObject backdropRoot;

        private void Awake()
        {
            if (targetCamera == null)
                targetCamera = Camera.main;

            ApplyStyle();
            EnsureGradientBackdrop();
        }

        public void ApplyStyle()
        {
            if (targetCamera == null)
                return;

            targetCamera.clearFlags = CameraClearFlags.SolidColor;
            targetCamera.backgroundColor = TerrainSlopeColorPalette.BackgroundBottom;
        }

        private void EnsureGradientBackdrop()
        {
            if (targetCamera == null || backdropRoot != null)
                return;

            backdropRoot = new GameObject("TerrainCorporateBackdrop");
            backdropRoot.transform.SetParent(transform, false);

            var meshFilter = backdropRoot.AddComponent<MeshFilter>();
            var meshRenderer = backdropRoot.AddComponent<MeshRenderer>();

            var mesh = new Mesh();
            mesh.vertices = new[]
            {
                new Vector3(-1f, 1f, 0f),
                new Vector3(1f, 1f, 0f),
                new Vector3(-1f, -1f, 0f),
                new Vector3(1f, -1f, 0f),
            };
            mesh.uv = new[]
            {
                new Vector2(0f, 1f),
                new Vector2(1f, 1f),
                new Vector2(0f, 0f),
                new Vector2(1f, 0f),
            };
            mesh.triangles = new[] { 0, 2, 1, 1, 2, 3 };
            mesh.UploadMeshData(false);
            meshFilter.sharedMesh = mesh;

            var tex = new Texture2D(1, 64, TextureFormat.RGBA32, false)
            {
                wrapMode = TextureWrapMode.Clamp,
            };
            for (int y = 0; y < 64; y++)
            {
                float t = y / 63f;
                tex.SetPixel(0, y, Color.Lerp(
                    TerrainSlopeColorPalette.BackgroundBottom,
                    TerrainSlopeColorPalette.BackgroundTop,
                    t));
            }
            tex.Apply();

            var shader = Shader.Find("Unlit/Texture");
            if (shader == null)
                shader = Shader.Find("Sprites/Default");

            if (shader != null)
            {
                var mat = new Material(shader);
                mat.mainTexture = tex;
                mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Background;
                meshRenderer.sharedMaterial = mat;
            }

            meshRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            meshRenderer.receiveShadows = false;

            var follower = backdropRoot.AddComponent<TerrainCorporateBackdropFollower>();
            follower.Initialize(targetCamera);
        }
    }

    internal sealed class TerrainCorporateBackdropFollower : MonoBehaviour
    {
        private const float BackdropDistance = 140f;
        private const float BackdropScale = 180f;

        private Camera targetCamera;

        public void Initialize(Camera camera)
        {
            targetCamera = camera;
            UpdateBackdrop();
        }

        private void LateUpdate()
        {
            if (targetCamera == null) return;
            UpdateBackdrop();
        }

        private void UpdateBackdrop()
        {
            var cam = targetCamera.transform;
            transform.position = cam.position - cam.forward * BackdropDistance;
            transform.rotation = cam.rotation;
            transform.localScale = new Vector3(BackdropScale, BackdropScale, 1f);
        }
    }
}
