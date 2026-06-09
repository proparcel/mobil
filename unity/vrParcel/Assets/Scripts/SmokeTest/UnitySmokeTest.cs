using UnityEngine;

namespace ProParcel.SmokeTest
{
    /// <summary>
    /// Minimal embed test — GameObject adi "UnitySmokeTest" (UnitySendMessage hedefi).
    /// </summary>
    public class UnitySmokeTest : MonoBehaviour
    {
        [SerializeField] private Transform cubeTransform;

        private void Awake()
        {
            Debug.LogError("[PP_SMOKE] Awake");
        }

        private void Start()
        {
            Debug.LogError("[PP_SMOKE] Start");
            EnsureCubeReference();
        }

        private void Update()
        {
            if (cubeTransform != null)
            {
                cubeTransform.Rotate(Vector3.up, 45f * Time.deltaTime, Space.World);
            }
        }

        public void Ping(string msg)
        {
            Debug.LogError("[PP_SMOKE] Ping: " + msg);
        }

        private void EnsureCubeReference()
        {
            if (cubeTransform != null) return;
            var found = transform.Find("SmokeCube");
            if (found != null)
            {
                cubeTransform = found;
            }
        }
    }
}
