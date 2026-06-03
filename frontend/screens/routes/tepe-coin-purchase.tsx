import { Platform } from "react-native";



/**

 * Android: Havale/EFT (billing-checkout).

 * iOS: Apple In-App Purchase (billing-checkout-ios).

 */

export default function TepeCoinPurchaseScreen(props: Record<string, unknown>) {

  if (Platform.OS === "ios") {

    const Screen = require("./billing-checkout-ios").default;

    return <Screen {...props} />;

  }

  const Screen = require("./billing-checkout").default;

  return <Screen {...props} />;

}

