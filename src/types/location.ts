export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedPlace extends Coordinates {
  name: string;
}
