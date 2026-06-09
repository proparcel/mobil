import { haversineMetres } from "./calibrationEngine";

/**
 * @deprecated Ana kalibrasyon akışında kullanılmaz. ARKit/ARCore world tracking hareketi takip eder.
 * RN fallback hareket takibi — Unity AR pose yokken yürüme mesafesini path integral ile ölçer.
 */
 */
export type VrMotionPose = {
  x: number;
  y: number;
  z: number;
};

export class VrSessionMotionTracker {
  private lastLat: number | null = null;
  private lastLon: number | null = null;
  private pathDistanceM = 0;
  private pose: VrMotionPose = { x: 0, y: 0, z: 0 };
  private originPose: VrMotionPose | null = null;

  reset(): void {
    this.lastLat = null;
    this.lastLon = null;
    this.pathDistanceM = 0;
    this.pose = { x: 0, y: 0, z: 0 };
    this.originPose = null;
  }

  markOrigin(): VrMotionPose {
    this.originPose = { ...this.pose };
    return this.originPose;
  }

  getOriginPose(): VrMotionPose | null {
    return this.originPose;
  }

  getCurrentPose(): VrMotionPose {
    return { ...this.pose };
  }

  /** GPS güncellemesi — jitter filtresi ile path mesafesi biriktirir */
  onLocationUpdate(lat: number, lon: number): void {
    if (this.lastLat == null || this.lastLon == null) {
      this.lastLat = lat;
      this.lastLon = lon;
      return;
    }

    const stepM = haversineMetres(this.lastLat, this.lastLon, lat, lon);
    if (stepM >= 0.4 && stepM <= 25) {
      this.pathDistanceM += stepM;
      this.pose.z += stepM;
    }

    this.lastLat = lat;
    this.lastLon = lon;
  }

  getWalkDistanceM(): number {
    return this.pathDistanceM;
  }

  getDisplacementFromOriginM(): number {
    if (!this.originPose) return this.pathDistanceM;
    const dx = this.pose.x - this.originPose.x;
    const dy = this.pose.y - this.originPose.y;
    const dz = this.pose.z - this.originPose.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /** Birincil mesafe: path integral (GPS düz çizgisinden daha güvenilir) */
  getPrimaryWalkDistanceM(): number {
    return Math.max(this.pathDistanceM, this.getDisplacementFromOriginM());
  }
}

export const vrSessionMotion = new VrSessionMotionTracker();
