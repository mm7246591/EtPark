import type { Coordinates, PlaceKind } from './place';

interface SavedPlace {
  id: string;
  kind: PlaceKind;
  name: string;
  address: string;
  location: Coordinates;
  savedAt: number;
}
interface ParkingRecord {
  place: SavedPlace;
  note: string;
  savedAt: number;
}
type ParkingSort = 'spaces' | 'distance' | 'price';

export type { SavedPlace, ParkingRecord, ParkingSort };
