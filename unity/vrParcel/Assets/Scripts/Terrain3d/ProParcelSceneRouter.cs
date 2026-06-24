using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ProParcel.Terrain3d
{
    /// <summary>
    /// DontDestroyOnLoad sahne yönlendirici — terrain runtime LoadScene.
    /// RN ile iletişim: UnitySendMessage + cache trigger dosyasi (pp_terrain_pending.trigger).
    /// </summary>
    public class ProParcelSceneRouter : MonoBehaviour
    {
        public static ProParcelSceneRouter Instance { get; private set; }

        private const string TerrainSceneName = "ParcelTerrain3dScene";
        private const string TriggerFileName = "pp_terrain_pending.trigger";

        private string pendingTerrainJson;
        private bool terrainLoadRunning;
        private float triggerPollTimer;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
            Debug.LogError("[ProParcelSceneRouter] Awake gameObject=" + gameObject.name +
                " unityCache=" + Application.temporaryCachePath +
                " unityFiles=" + Application.persistentDataPath);
        }

        private void Update()
        {
            triggerPollTimer += Time.unscaledDeltaTime;
            if (triggerPollTimer < 0.25f) return;
            triggerPollTimer = 0f;
            PollTerrainTriggerFile();
        }

        private void PollTerrainTriggerFile()
        {
            if (terrainLoadRunning) return;

            var triggerPath = FindTriggerFile();
            if (triggerPath == null) return;

            try
            {
                var fileRef = File.ReadAllText(triggerPath).Trim();
                TryDeleteTriggerFiles();
                Terrain3dAndroidLog.Info("[ProParcelSceneRouter] trigger poll ref=" + fileRef +
                    " from=" + triggerPath);
                LoadTerrainAndOpen(fileRef);
            }
            catch (System.Exception e)
            {
                Terrain3dAndroidLog.Error("[ProParcelSceneRouter] trigger poll fail: " + e.Message);
            }
        }

        private static string FindTriggerFile()
        {
            var candidates = new[]
            {
                Path.Combine(Application.temporaryCachePath, TriggerFileName),
                Path.Combine(Application.persistentDataPath, TriggerFileName),
            };

            foreach (var path in candidates)
            {
                if (File.Exists(path)) return path;
            }

            return null;
        }

        private static void TryDeleteTriggerFiles()
        {
            var candidates = new[]
            {
                Path.Combine(Application.temporaryCachePath, TriggerFileName),
                Path.Combine(Application.persistentDataPath, TriggerFileName),
            };

            foreach (var path in candidates)
            {
                try
                {
                    if (File.Exists(path)) File.Delete(path);
                }
                catch
                {
                    // ignore
                }
            }
        }

        public void LoadTerrainAndOpen(string payloadRefOrJson)
        {
            if (string.IsNullOrWhiteSpace(payloadRefOrJson))
            {
                Terrain3dErrorUi.Show("Terrain payload bos.");
                return;
            }

            pendingTerrainJson = payloadRefOrJson;
            if (!terrainLoadRunning)
            {
                StartCoroutine(LoadTerrainRoutine());
            }
        }

        private IEnumerator LoadTerrainRoutine()
        {
            terrainLoadRunning = true;
            Terrain3dAndroidLog.Info("[ProParcelSceneRouter] LoadTerrainRoutine basladi activeScene=" +
                SceneManager.GetActiveScene().name);

            if (SceneManager.GetActiveScene().name != TerrainSceneName)
            {
                var canLoad = Application.CanStreamedLevelBeLoaded(TerrainSceneName);
                Terrain3dAndroidLog.Info("[ProParcelSceneRouter] CanStreamedLevelBeLoaded(" +
                    TerrainSceneName + ")=" + canLoad);

                if (!canLoad)
                {
                    var msg = "Sahne build'de yok: " + TerrainSceneName +
                        "\nBuild Settings > Scenes In Build index 0 olmali.";
                    Terrain3dAndroidLog.Error("[ProParcelSceneRouter] " + msg);
                    Terrain3dErrorUi.Show(msg);
                    terrainLoadRunning = false;
                    yield break;
                }

                var op = SceneManager.LoadSceneAsync(TerrainSceneName, LoadSceneMode.Single);
                if (op == null)
                {
                    Terrain3dAndroidLog.Error("[ProParcelSceneRouter] LoadSceneAsync null");
                    Terrain3dErrorUi.Show("ParcelTerrain3dScene yuklenemedi.");
                    terrainLoadRunning = false;
                    yield break;
                }

                while (!op.isDone)
                {
                    yield return null;
                }

                Terrain3dAndroidLog.Info("[ProParcelSceneRouter] Aktif sahne: " +
                    SceneManager.GetActiveScene().name);
            }

            yield return null;
            yield return null;

            var bridge = FindAnyObjectByType<ParcelTerrain3dBridge>();
            if (bridge != null && !string.IsNullOrEmpty(pendingTerrainJson))
            {
                Terrain3dAndroidLog.Info("[ProParcelSceneRouter] ParcelTerrain3dBridge bulundu, OnOpenViewer");
                bridge.OnOpenViewer(pendingTerrainJson);
            }
            else
            {
                var msg = bridge == null
                    ? "ParcelTerrain3dBridge sahnede yok."
                    : "Terrain JSON bos.";
                Terrain3dAndroidLog.Error("[ProParcelSceneRouter] " + msg);
                Terrain3dErrorUi.Show(msg);
            }

            terrainLoadRunning = false;
        }
    }
}
