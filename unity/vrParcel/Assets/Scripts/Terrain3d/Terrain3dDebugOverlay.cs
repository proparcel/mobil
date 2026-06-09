using UnityEngine;

namespace ProParcel.Terrain3d
{
    /** Debug kapali — kurumsal ekran icin test kubbesi gosterilmez. */
    public class Terrain3dDebugOverlay : MonoBehaviour
    {
        [SerializeField] private bool showDebugCube = false;

        private void Start()
        {
            if (!showDebugCube) return;
            Terrain3dAndroidLog.Info("[Terrain3dDebugOverlay] debug cube aktif");
        }
    }
}
