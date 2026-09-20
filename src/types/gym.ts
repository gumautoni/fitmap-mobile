export type GymSource = "openstreetmap" | "demo";

export interface Gym {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  distanceKm: number;
  monthlyPrice: number;
  phone: string;
  website: string;
  source: GymSource;
}
