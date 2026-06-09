#!/usr/bin/env bash
# Unity iOS export → ProParcel ios/ workspace (Mac only)
# Kullanım:
#   cd mobile/mobil_github/frontend
#   npx expo prebuild --platform ios
#   bash scripts/embed-unity-ios.sh
#   cd ios && pod install
#   open ProParcel.xcworkspace

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
UNITY_EXPORT="${FRONTEND_ROOT}/../unity/vrParcel/builds/ios"
IOS_ROOT="${FRONTEND_ROOT}/ios"
FRAMEWORK="${UNITY_EXPORT}/UnityFramework.framework"
DATA_SRC="${UNITY_EXPORT}/Data"

if [[ ! -d "${IOS_ROOT}" ]]; then
  echo "Hata: ${IOS_ROOT} yok. Once: npx expo prebuild --platform ios"
  exit 1
fi

if [[ ! -d "${FRAMEWORK}" ]]; then
  echo "Hata: Unity export bulunamadi: ${FRAMEWORK}"
  echo "Unity Editor → Build Settings → iOS → Export Project → ${UNITY_EXPORT}"
  exit 1
fi

mkdir -p "${IOS_ROOT}/Frameworks"
rm -rf "${IOS_ROOT}/Frameworks/UnityFramework.framework"
cp -R "${FRAMEWORK}" "${IOS_ROOT}/Frameworks/UnityFramework.framework"

if [[ -d "${DATA_SRC}" ]]; then
  rm -rf "${IOS_ROOT}/UnityData"
  cp -R "${DATA_SRC}" "${IOS_ROOT}/UnityData"
  echo "Unity Data kopyalandi → ios/UnityData"
else
  echo "Uyari: ${DATA_SRC} bulunamadi. Build sirasinda Data klasoru gerekli olabilir."
fi

echo "UnityFramework kopyalandi → ios/Frameworks/UnityFramework.framework"
echo ""
echo "Sonraki adimlar:"
echo "  cd \"${FRONTEND_ROOT}\""
echo "  npx expo prebuild --platform ios   # withUnityFrameworkEmbed plugin VR_UNITY_LINKED ekler"
echo "  cd ios && pod install"
echo "  open *.xcworkspace"
echo "  Xcode → Run on device"
