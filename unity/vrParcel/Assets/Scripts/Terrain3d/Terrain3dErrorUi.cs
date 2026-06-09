using UnityEngine;
using UnityEngine.UI;

namespace ProParcel.Terrain3d
{
    /** Payload/mesh hatalarini siyah ekran yerine ekranda gosterir. */
    public class Terrain3dErrorUi : MonoBehaviour
    {
        public static Terrain3dErrorUi Instance { get; private set; }

        private Text errorText;
        private GameObject panelRoot;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            EnsureUi();
        }

        public static void Show(string message)
        {
            EnsureInstance();
            if (Instance == null) return;
            Instance.EnsureUi();
            Instance.panelRoot.SetActive(true);
            Instance.errorText.text = message ?? "Bilinmeyen hata";
            Terrain3dAndroidLog.Error("[Terrain3dErrorUi] " + message);
        }

        public static void Hide()
        {
            if (Instance == null || Instance.panelRoot == null) return;
            Instance.panelRoot.SetActive(false);
        }

        private static void EnsureInstance()
        {
            if (Instance != null) return;
            var go = new GameObject("Terrain3dErrorUi");
            go.AddComponent<Terrain3dErrorUi>();
        }

        private void EnsureUi()
        {
            if (panelRoot != null) return;

            var canvasGo = new GameObject("TerrainErrorCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 500;
            canvasGo.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            canvasGo.AddComponent<GraphicRaycaster>();

            panelRoot = new GameObject("ErrorPanel");
            panelRoot.transform.SetParent(canvasGo.transform, false);
            var panelImage = panelRoot.AddComponent<Image>();
            panelImage.color = new Color(0.08f, 0.1f, 0.14f, 0.92f);
            var panelRt = panelRoot.GetComponent<RectTransform>();
            panelRt.anchorMin = new Vector2(0.05f, 0.35f);
            panelRt.anchorMax = new Vector2(0.95f, 0.65f);
            panelRt.offsetMin = Vector2.zero;
            panelRt.offsetMax = Vector2.zero;

            var textGo = new GameObject("ErrorText");
            textGo.transform.SetParent(panelRoot.transform, false);
            errorText = textGo.AddComponent<Text>();
            errorText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            errorText.fontSize = 28;
            errorText.color = new Color(1f, 0.85f, 0.85f);
            errorText.alignment = TextAnchor.MiddleCenter;
            errorText.horizontalOverflow = HorizontalWrapMode.Wrap;
            errorText.verticalOverflow = VerticalWrapMode.Overflow;
            var textRt = textGo.GetComponent<RectTransform>();
            textRt.anchorMin = Vector2.zero;
            textRt.anchorMax = Vector2.one;
            textRt.offsetMin = new Vector2(16f, 16f);
            textRt.offsetMax = new Vector2(-16f, -16f);

            panelRoot.SetActive(false);
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }
    }
}
