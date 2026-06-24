using System.Collections;
using UnityEngine;

namespace ProParcel.Terrain3d
{
    public class ParcelTerrain3dBridge : MonoBehaviour
    {
        public static ParcelTerrain3dBridge Instance { get; private set; }

        [SerializeField] private MeshFilter meshFilter;
        [SerializeField] private MeshRenderer meshRenderer;
        [SerializeField] private Material terrainVertexColorMaterial;
        [SerializeField] private ParcelBorderLineRenderer borderRenderer;
        [SerializeField] private TerrainOrbitCamera orbitCamera;
        [SerializeField] private bool autoLoadEmbeddedDemo = false;

        private Mesh runtimeMesh;
        private Texture2D runtimeSlopeTexture;
        private Material runtimeMaterial;

        // Session yonetimi: her acilis benzersiz session ile yonetilir; eski parselin gec gelen
        // payload'i yeni parselin uzerine yazamaz (stale guard).
        private string currentSessionId;
        private int openSequence;
        private string lastPayloadRef;
        private ParcelTerrain3dDto lastDto;
        private Bounds? lastBounds;

        private void Awake()
        {
            Instance = this;
            // UnitySendMessage("ParcelTerrain3dBridge", ...) hedefi birebir bu ad olmali; "(Clone)"
            // veya farkli ad mesajin kaybolmasina yol acar. Boot'ta normalize et.
            if (gameObject.name != "ParcelTerrain3dBridge")
            {
                Debug.LogWarning("[Terrain3d] Bridge name '" + gameObject.name + "' -> 'ParcelTerrain3dBridge'");
                gameObject.name = "ParcelTerrain3dBridge";
            }
            // JNI'den bagimsiz ham logcat marker (adb logcat -s Unity:V ile gorunur).
            Debug.Log("[Terrain3d] Bridge.Awake object=" + gameObject.name +
                " scene=" + gameObject.scene.name +
                " active=" + gameObject.activeInHierarchy);
            Terrain3dAndroidLog.Info("[ParcelTerrain3dBridge] Awake scene=" +
                UnityEngine.SceneManagement.SceneManager.GetActiveScene().name);
            EnsureSceneStyle();
            EnsureRenderComponents();
        }

        private void OnEnable()
        {
            Debug.Log("[Terrain3d] Bridge.OnEnable object=" + gameObject.name +
                " active=" + gameObject.activeInHierarchy);
            Terrain3dAndroidLog.Event("unity.bridge.ready", Terrain3dLogData.New()
                .Add("object", gameObject.name)
                .Add("scene", gameObject.scene.name)
                .Add("via", "BridgeOnEnable"));
        }

        private void Start()
        {
            Debug.Log("[Terrain3d] Bridge.Start object=" + gameObject.name +
                " active=" + gameObject.activeInHierarchy);

            if (autoLoadEmbeddedDemo)
                LoadEmbeddedDemoNow("");
        }

        public void LoadEmbeddedDemoNow(string _unused = "")
        {
            var seq = ++openSequence;
            if (string.IsNullOrEmpty(currentSessionId))
                currentSessionId = System.Guid.NewGuid().ToString();
            OpenViewerWithDto(Terrain3dEmbeddedDemo.Build(), seq, "@embedded-demo");
        }

        public void OnNewSession(string sessionJsonOrId)
        {
            Debug.Log("[Terrain3d] OnNewSession RECEIVED raw=" + sessionJsonOrId);
            openSequence++;
            currentSessionId = ResolveSessionId(sessionJsonOrId);

            Terrain3dAndroidLog.Event("unity.session.new.started", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("openSequence", openSequence));

            Terrain3dAndroidLog.Event("unity.session.clear.started", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId));
            ClearVisuals();
            Terrain3dAndroidLog.Event("unity.session.clear.finished", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId));

            lastPayloadRef = null;
            Terrain3dErrorUi.Hide();
        }

        public void OnOpenViewer(string jsonOrFileRef)
        {
            Debug.Log("[Terrain3d] OnOpenViewer RECEIVED len=" + (jsonOrFileRef?.Length ?? -1));
            // Bu acilisa ait local sequence; payload/mesh bitince openSequence degismisse iptal.
            var seq = openSequence;
            var payloadRef = jsonOrFileRef ?? "";

            Terrain3dAndroidLog.Event("unity.openViewer.called", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("openSequence", seq)
                .Add("payloadRef", Truncate(payloadRef, 120)));

            Terrain3dAndroidLog.Event("unity.payload.resolve.started", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("payloadRef", Truncate(payloadRef, 120)));

            var json = TerrainPayloadIO.Resolve(jsonOrFileRef);
            if (string.IsNullOrEmpty(json))
            {
                Terrain3dAndroidLog.EventError("unity.payload.resolve.failed", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId)
                    .Add("payloadRef", Truncate(payloadRef, 120)));
                if (seq == openSequence)
                    Terrain3dErrorUi.Show("Terrain JSON okunamadi.");
                return;
            }

            Terrain3dAndroidLog.Event("unity.payload.resolve.success", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("jsonLength", json.Length));

            if (seq != openSequence)
            {
                Terrain3dAndroidLog.Event("unity.session.stale.ignored", Terrain3dLogData.New()
                    .Add("stage", "afterResolve")
                    .Add("seq", seq)
                    .Add("openSequence", openSequence));
                Debug.Log("Stale OnOpenViewer ignored (afterResolve)");
                return;
            }

            lastPayloadRef = payloadRef;
            OpenViewerWithJson(json, seq, payloadRef);
        }

        private void OpenViewerWithJson(string json, int seq, string payloadRef)
        {
            Terrain3dAndroidLog.Event("unity.json.parse.started", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("jsonLength", json.Length));
            try
            {
                var dto = UnityEngine.JsonUtility.FromJson<ParcelTerrain3dDto>(json);
                if (dto == null)
                {
                    Terrain3dAndroidLog.EventError("unity.json.parse.failed", Terrain3dLogData.New()
                        .Add("sessionId", currentSessionId)
                        .Add("reason", "null dto"));
                    Terrain3dErrorUi.Show("JSON parse basarisiz (null dto).");
                    return;
                }

                Terrain3dAndroidLog.Event("unity.json.parse.success", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId));

                OpenViewerWithDto(dto, seq, payloadRef);
            }
            catch (System.Exception e)
            {
                Terrain3dAndroidLog.EventError("unity.json.parse.failed", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId)
                    .Add("error", e.Message));
                Terrain3dErrorUi.Show("Terrain hata:\n" + e.Message);
            }
        }

        private void OpenViewerWithDto(ParcelTerrain3dDto dto, int seq, string payloadRef)
        {
            if (dto == null)
            {
                Terrain3dErrorUi.Show("Demo payload null.");
                return;
            }

            try
            {
                EnsureRenderComponents();
                ClearVisuals();
                Terrain3dErrorUi.Hide();

                var validationError = TerrainMeshBuilder.ValidatePayload(dto);
                if (validationError != null)
                {
                    Terrain3dAndroidLog.EventError("unity.mesh.build.failed", Terrain3dLogData.New()
                        .Add("sessionId", currentSessionId)
                        .Add("stage", "validate")
                        .Add("error", validationError));
                    Terrain3dErrorUi.Show("Payload gecersiz:\n" + validationError);
                    return;
                }

                LogDtoSummary(dto);

                Terrain3dAndroidLog.Event("unity.mesh.build.started", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId));

                if (!TerrainMeshBuilder.TryBuildMesh(
                        dto,
                        out var mesh,
                        out var baseElev,
                        out var slopeTexture,
                        out var buildError))
                {
                    Terrain3dAndroidLog.EventError("unity.mesh.build.failed", Terrain3dLogData.New()
                        .Add("sessionId", currentSessionId)
                        .Add("error", buildError));
                    Terrain3dErrorUi.Show("Mesh olusturulamadi:\n" + buildError);
                    return;
                }

                // Mesh build bittikten sonra yeni session geldi mi? Geldiyse bu sonucu cope at.
                if (seq != openSequence)
                {
                    Terrain3dAndroidLog.Event("unity.session.stale.ignored", Terrain3dLogData.New()
                        .Add("stage", "afterMeshBuild")
                        .Add("seq", seq)
                        .Add("openSequence", openSequence));
                    Debug.Log("Stale OnOpenViewer ignored (afterMeshBuild)");
                    if (mesh != null) Destroy(mesh);
                    if (slopeTexture != null) Destroy(slopeTexture);
                    return;
                }

                runtimeMesh = mesh;
                runtimeSlopeTexture = slopeTexture;

                Terrain3dAndroidLog.Event("unity.mesh.build.success", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId)
                    .Add("triangleCount", mesh.triangles.Length / 3)
                    .Add("vertexCount", mesh.vertexCount)
                    .Add("baseElevation", baseElev));

                if (meshFilter == null || meshRenderer == null)
                {
                    Terrain3dErrorUi.Show("TerrainMesh sahnede bagli degil.");
                    return;
                }

                meshFilter.sharedMesh = runtimeMesh;

                Terrain3dAndroidLog.Event("unity.material.create.started", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId));

                if (!TerrainVertexColorMaterial.TryResolveMaterial(
                        terrainVertexColorMaterial,
                        runtimeSlopeTexture,
                        out var material,
                        out var renderMode))
                {
                    Terrain3dErrorUi.Show("Terrain material olusturulamadi.");
                    return;
                }

                // Serileştirilmis assigned material disindaki materyal runtime olusturulmustur -> temizlenmeli.
                runtimeMaterial = material != terrainVertexColorMaterial ? material : null;

                meshRenderer.sharedMaterial = material;
                meshRenderer.enabled = true;
                meshRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                meshRenderer.receiveShadows = false;

                string materialMode = renderMode == TerrainSurfaceRenderMode.VertexColor
                    ? "vertexColor"
                    : "textureFallback";
                Terrain3dAndroidLog.Event(
                    renderMode == TerrainSurfaceRenderMode.VertexColor
                        ? "unity.material.mode.vertexColor"
                        : "unity.material.mode.textureFallback",
                    Terrain3dLogData.New()
                        .Add("sessionId", currentSessionId)
                        .Add("materialMode", materialMode));

                float heightScale = dto.terrain.heightScaleSuggestion > 0f
                    ? dto.terrain.heightScaleSuggestion
                    : 1f;

                RenderBorder(dto, baseElev, heightScale);

                LogCoordinateVerification(dto, baseElev, heightScale);

                FitCamera();

                lastDto = dto;
                lastBounds = meshRenderer != null ? meshRenderer.bounds : (Bounds?)null;
                Terrain3dErrorUi.Hide();

                // Re-attach edilen SurfaceView'da render loop'u uyandir (canvas + kamera + renderer).
                ForceRenderRefresh();

                // unity.viewer.ready bir frame sonra, yeni SurfaceView kare bastiktan sonra gonderilir.
                StartCoroutine(FinalizeViewerNextFrame(materialMode, payloadRef));
            }
            catch (System.Exception e)
            {
                Terrain3dAndroidLog.EventError("unity.viewer.exception", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId)
                    .Add("error", e.Message));
                Terrain3dErrorUi.Show("Terrain hata:\n" + e.Message);
            }
        }

        /// <summary>
        /// UaaL re-attach sonrasi donmus eski frame yerine yeni kareyi zorlamak icin canvas/kamera/
        /// renderer toggle. Ana cozum Kotlin lifecycle tarafindadir; bu destekleyici onlemdir.
        /// </summary>
        private void ForceRenderRefresh()
        {
            try
            {
                Canvas.ForceUpdateCanvases();
            }
            catch (System.Exception)
            {
                // canvas yoksa onemsiz
            }

            var cam = Camera.main;
            if (cam != null)
            {
                cam.enabled = false;
                cam.enabled = true;
            }

            if (meshRenderer != null)
            {
                meshRenderer.enabled = false;
                meshRenderer.enabled = true;
            }
        }

        private IEnumerator FinalizeViewerNextFrame(string materialMode, string payloadRef)
        {
            // Yeni SurfaceView'in en az bir kare basmasi icin bir frame bekle.
            yield return null;

            if (meshRenderer != null)
            {
                meshRenderer.enabled = false;
                meshRenderer.enabled = true;
            }

            var cam = Camera.main;
            if (cam != null)
            {
                cam.enabled = false;
                cam.enabled = true;
            }

            Terrain3dAndroidLog.Event("unity.viewer.ready", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("materialMode", materialMode)
                .Add("payloadRef", Truncate(payloadRef ?? "", 120)));
        }

        private void RenderBorder(ParcelTerrain3dDto dto, float baseElev, float heightScale)
        {
            bool showBorder = dto.render == null || dto.render.showParcelBorder;
            int polygonCount = dto.parcel?.localPolygon?.Length ?? 0;

            Terrain3dAndroidLog.Event("unity.border.render.started", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("showBorder", showBorder)
                .Add("borderPointCount", polygonCount));

            if (!showBorder || dto.parcel?.localPolygon == null || borderRenderer == null)
            {
                Terrain3dAndroidLog.Event("unity.border.render.skipped", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId)
                    .Add("reason", !showBorder
                        ? "showParcelBorder=false"
                        : (borderRenderer == null ? "borderRenderer=null" : "localPolygon=null"))
                    .Add("borderPointCount", polygonCount));
                return;
            }

            try
            {
                borderRenderer.RenderBorder(dto.terrain, dto.parcel.localPolygon, baseElev, heightScale);
                Terrain3dAndroidLog.Event("unity.border.render.success", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId)
                    .Add("borderPointCount", polygonCount));
            }
            catch (System.Exception borderEx)
            {
                Terrain3dAndroidLog.EventError("unity.border.render.skipped", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId)
                    .Add("reason", "exception: " + borderEx.Message)
                    .Add("borderPointCount", polygonCount));
            }
        }

        private void FitCamera()
        {
            orbitCamera = orbitCamera != null ? orbitCamera : FindAnyObjectByType<TerrainOrbitCamera>();
            if (orbitCamera == null)
            {
                Terrain3dAndroidLog.EventError("unity.camera.fit.finished", Terrain3dLogData.New()
                    .Add("sessionId", currentSessionId)
                    .Add("reason", "TerrainOrbitCamera yok"));
                return;
            }

            Terrain3dAndroidLog.Event("unity.camera.fit.started", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId));
            orbitCamera.SetTargetBounds(meshRenderer.bounds);
            Terrain3dAndroidLog.Event("unity.camera.fit.finished", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("cameraDistance", orbitCamera.CurrentDistance));
        }

        private void LogDtoSummary(ParcelTerrain3dDto dto)
        {
            var t = dto.terrain;
            int maskInside = TerrainMeshBuilder.CountMaskInside(t);
            Terrain3dAndroidLog.Event("unity.dto.summary", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("ada", dto.parcel?.ada ?? "")
                .Add("parsel", dto.parcel?.parsel ?? "")
                .Add("terrainWidth", t.width)
                .Add("terrainHeight", t.height)
                .Add("cellSizeM", t.cellSizeM)
                .Add("elevationsLength", t.elevations?.Length ?? 0)
                .Add("slopesLength", t.slopes?.Length ?? 0)
                .Add("maskLength", t.mask?.Length ?? 0)
                .Add("maskInsideCount", maskInside)
                .Add("localPolygonPointCount", dto.parcel?.localPolygon?.Length ?? 0));
        }

        private void LogCoordinateVerification(ParcelTerrain3dDto dto, float baseElev, float heightScale)
        {
            var polygon = dto.parcel?.localPolygon;
            float pMinX = float.MaxValue, pMaxX = float.MinValue, pMinZ = float.MaxValue, pMaxZ = float.MinValue;
            if (polygon != null)
            {
                foreach (var p in polygon)
                {
                    pMinX = Mathf.Min(pMinX, p.x);
                    pMaxX = Mathf.Max(pMaxX, p.x);
                    pMinZ = Mathf.Min(pMinZ, p.z);
                    pMaxZ = Mathf.Max(pMaxZ, p.z);
                }
            }

            var meshBounds = meshRenderer != null ? meshRenderer.bounds : new Bounds();
            Terrain3dAndroidLog.Event("unity.coords.verify", Terrain3dLogData.New()
                .Add("sessionId", currentSessionId)
                .Add("meshMinX", meshBounds.min.x)
                .Add("meshMaxX", meshBounds.max.x)
                .Add("meshMinZ", meshBounds.min.z)
                .Add("meshMaxZ", meshBounds.max.z)
                .Add("polygonMinX", pMinX)
                .Add("polygonMaxX", pMaxX)
                .Add("polygonMinZ", pMinZ)
                .Add("polygonMaxZ", pMaxZ)
                .Add("originX", dto.terrain.origin != null ? dto.terrain.origin.x : 0f)
                .Add("originZ", dto.terrain.origin != null ? dto.terrain.origin.z : 0f)
                .Add("cellSizeM", dto.terrain.cellSizeM));
        }

        public void OnCloseViewer(string _unused = "")
        {
            ClearVisuals();
            Terrain3dErrorUi.Hide();
        }

        public void ZoomBy(string deltaStr)
        {
            EnsureRenderComponents();
            orbitCamera?.ZoomBy(deltaStr);
        }

        public void ResetView(string _unused = "")
        {
            EnsureRenderComponents();
            orbitCamera?.ResetView("");
        }

        private void ClearVisuals()
        {
            // Runtime uretilmis mesh.
            if (runtimeMesh != null)
            {
                Destroy(runtimeMesh);
                runtimeMesh = null;
            }

            // Runtime slope texture (texture fallback).
            if (runtimeSlopeTexture != null)
            {
                Destroy(runtimeSlopeTexture);
                runtimeSlopeTexture = null;
            }

            // Runtime olusturulan material (assigned material disinda).
            if (runtimeMaterial != null)
            {
                Destroy(runtimeMaterial);
                runtimeMaterial = null;
            }

            if (meshFilter != null)
            {
                if (meshFilter.sharedMesh != null)
                {
                    Destroy(meshFilter.sharedMesh);
                }
                meshFilter.sharedMesh = null;
            }

            if (meshRenderer != null)
            {
                meshRenderer.sharedMaterial = null;
                meshRenderer.enabled = false;
            }

            borderRenderer?.Clear();

            Terrain3dErrorUi.Hide();

            lastDto = null;
            lastPayloadRef = null;
            lastBounds = null;
            // NOT: TerrainMesh, ParcelTerrain3dBridge ve Main Camera ana referans objeleri silinmez.
        }

        private static string ResolveSessionId(string sessionJsonOrId)
        {
            if (string.IsNullOrWhiteSpace(sessionJsonOrId))
                return System.Guid.NewGuid().ToString();

            var trimmed = sessionJsonOrId.Trim();
            // JSON ise sessionId alanini cek.
            if (trimmed.StartsWith("{"))
            {
                try
                {
                    var holder = UnityEngine.JsonUtility.FromJson<SessionIdHolder>(trimmed);
                    if (holder != null && !string.IsNullOrWhiteSpace(holder.sessionId))
                        return holder.sessionId;
                }
                catch (System.Exception)
                {
                    // duz string olarak kullan
                }
                return System.Guid.NewGuid().ToString();
            }

            return trimmed;
        }

        [System.Serializable]
        private class SessionIdHolder
        {
            public string sessionId;
        }

        private static string Truncate(string value, int max)
        {
            if (string.IsNullOrEmpty(value) || value.Length <= max) return value;
            return value.Substring(0, max) + "...";
        }

        private static void EnsureSceneStyle()
        {
            var style = FindAnyObjectByType<TerrainViewerSceneStyle>();
            if (style != null)
            {
                style.ApplyStyle();
                return;
            }

            var go = new GameObject("SceneStyleController");
            go.AddComponent<TerrainViewerSceneStyle>();
        }

        private void EnsureRenderComponents()
        {
            var terrainMeshGo = GameObject.Find("TerrainMesh");

            if (meshFilter == null && terrainMeshGo != null)
                meshFilter = terrainMeshGo.GetComponent<MeshFilter>();

            if (meshRenderer == null && terrainMeshGo != null)
                meshRenderer = terrainMeshGo.GetComponent<MeshRenderer>();

            if (meshFilter == null)
            {
                var go = terrainMeshGo ?? new GameObject("TerrainMesh");
                if (terrainMeshGo == null)
                    go.transform.SetParent(transform, false);
                meshFilter = go.GetComponent<MeshFilter>() ?? go.AddComponent<MeshFilter>();
            }

            if (meshRenderer == null)
            {
                meshRenderer = meshFilter.GetComponent<MeshRenderer>()
                    ?? meshFilter.gameObject.AddComponent<MeshRenderer>();
            }

            if (borderRenderer == null)
            {
                var borderGo = GameObject.Find("ParcelBorder");
                if (borderGo == null)
                {
                    borderGo = new GameObject("ParcelBorder");
                    borderGo.transform.SetParent(meshFilter.transform, false);
                }
                borderRenderer = borderGo.GetComponent<ParcelBorderLineRenderer>()
                    ?? borderGo.AddComponent<ParcelBorderLineRenderer>();
            }

            if (orbitCamera == null)
                orbitCamera = FindAnyObjectByType<TerrainOrbitCamera>();
        }

        private void OnDestroy()
        {
            ClearVisuals();
            if (Instance == this) Instance = null;
        }
    }
}
