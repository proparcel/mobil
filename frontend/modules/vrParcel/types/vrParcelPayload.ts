export type VrLatLon = {
  lat: number;
  lon: number;
};

export type VrParcelPayload = {
  parcelId: string;
  city?: string;
  town?: string;
  quarter?: string;
  ada: string;
  parsel: string;
  areaM2?: number;
  center: VrLatLon;
  polygon: VrLatLon[];
};
