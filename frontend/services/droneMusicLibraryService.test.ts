import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSelectMusicTrackPayload,
  normalizeApiMusicTrack,
  normalizeLibraryTrack,
  PROPARCEL_MUSIC_PROVIDER,
  UPLOAD_MUSIC_PROVIDER,
} from "./droneMusicLibraryContract";

describe("droneMusicLibraryService", () => {
  it("normalizes library track with title fallback to name", () => {
    const track = normalizeLibraryTrack({
      provider_track_id: "ambient-01",
      filename: "ambient-01.mp3",
      name: "Cinematic Drone",
    });
    assert.equal(track.provider, PROPARCEL_MUSIC_PROVIDER);
    assert.equal(track.provider_track_id, "ambient-01");
    assert.equal(track.title, "Cinematic Drone");
    assert.equal(track.filename, "ambient-01.mp3");
  });

  it("builds select payload with proparcel provider", () => {
    const payload = buildSelectMusicTrackPayload({
      provider_track_id: "beat-2",
      filename: "beat-2.mp3",
      title: "Beat Two",
    });
    assert.deepEqual(payload, {
      provider: "proparcel",
      provider_track_id: "beat-2",
      filename: "beat-2.mp3",
      title: "Beat Two",
    });
  });

  it("builds select payload with upload provider", () => {
    const payload = buildSelectMusicTrackPayload({
      provider: UPLOAD_MUSIC_PROVIDER,
      provider_track_id: "upload-abc",
      title: "My Song",
      filename: "ignored.mp3",
    });
    assert.deepEqual(payload, {
      provider: "upload",
      provider_track_id: "upload-abc",
      title: "My Song",
    });
  });

  it("normalizes upload track from api payload", () => {
    const track = normalizeApiMusicTrack(
      {
        provider: UPLOAD_MUSIC_PROVIDER,
        provider_track_id: "preset-1",
        title: "Custom Beat",
      },
      "job-123",
      "https://api.example.com",
    );
    assert.equal(track.provider, UPLOAD_MUSIC_PROVIDER);
    assert.equal(track.artist, "Yüklenen");
    assert.equal(
      track.preview_url,
      "https://api.example.com/api/drone-editor/music/file/?job_id=job-123",
    );
  });
});
