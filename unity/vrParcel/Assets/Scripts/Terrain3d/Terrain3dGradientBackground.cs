using UnityEngine;

namespace ProParcel.Terrain3d
{
    /** Arka planda acik mavi-gri degrade — kameranin ARKASINDA, terrain onunde degil. */
    public class Terrain3dGradientBackground : MonoBehaviour
    {
        [SerializeField] private Color topColor = new Color(0.93f, 0.96f, 0.99f, 1f);
        [SerializeField] private Color bottomColor = new Color(0.84f, 0.89f, 0.95f, 1f);

        private void Start()
        {
            var cam = Camera.main;
            if (cam == null) return;

            var go = new GameObject("TerrainGradientBackground");
            go.transform.SetParent(transform, false);

            var meshFilter = go.AddComponent<MeshFilter>();
            var meshRenderer = go.AddComponent<MeshRenderer>();

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

            var tex = new Texture2D(1, 64, TextureFormat.RGBA32, false);
            tex.wrapMode = TextureWrapMode.Clamp;
            for (int y = 0; y < 64; y++)
            {
                float t = y / 63f;
                tex.SetPixel(0, y, Color.Lerp(bottomColor, topColor, t));
            }
            tex.Apply();

            var shader = Shader.Find("Unlit/Texture");
            if (shader == null) shader = Shader.Find("Mobile/Unlit (Supports Lightmap)");
            if (shader == null) shader = Shader.Find("Sprites/Default");

            var mat = new Material(shader);
            mat.mainTexture = tex;
            mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Background;
            meshRenderer.sharedMaterial = mat;
            meshRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            meshRenderer.receiveShadows = false;

            var bg = go.AddComponent<Terrain3dBackgroundFollower>();
            bg.Initialize(cam);
        }
    }

    internal sealed class Terrain3dBackgroundFollower : MonoBehaviour
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

        /** Kameranin arkasina yerlestir — onune konursa terrain kaybolur. */
        private void UpdateBackdrop()
        {
            var cam = targetCamera.transform;
            transform.position = cam.position - cam.forward * BackdropDistance;
            transform.rotation = cam.rotation;
            transform.localScale = new Vector3(BackdropScale, BackdropScale, 1f);
        }
    }
}
