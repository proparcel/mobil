import React from "react";
import YoutubePlayer from "react-native-youtube-iframe";
import type { YoutubeIframeProps } from "react-native-youtube-iframe";

/** WebView YouTube isteklerinde geçerli Referer için (Error 153) */
export const HOW_TO_YOUTUBE_BASE_URL = "https://www.proparcel.com";

type Props = Omit<YoutubeIframeProps, "useLocalHTML" | "baseUrlOverride">;

export function HowToYoutubePlayer({ webViewProps, ...rest }: Props) {
  return (
    <YoutubePlayer
      {...rest}
      useLocalHTML
      baseUrlOverride={HOW_TO_YOUTUBE_BASE_URL}
      forceAndroidAutoplay
      webViewProps={{
        allowsFullscreenVideo: true,
        allowsInlineMediaPlayback: true,
        androidLayerType: "hardware",
        ...webViewProps,
      }}
    />
  );
}
