type PlaceKind = 'food' | 'parking';
type Place = Restaurant | ParkingLot;

interface Coordinates {
  lat: number;
  lng: number;
}
interface BasePlace {
  id: string;
  name: string;
  address: string;
  location: Coordinates;
  distance: number;
}
interface Restaurant extends BasePlace {
  kind: 'food';
  city?: string;
  attributions?: { provider: string; url: string }[];
}
interface ParkingLot extends BasePlace {
  kind: 'parking';
  spaces: number | null;
  price: string;
}
interface SearchSuggestion {
  id: string;
  name: string;
  description: string;
  address: string;
  distance: number | null;
  prediction: google.maps.places.PlacePrediction;
}
export type {
  PlaceKind,
  Coordinates,
  Restaurant,
  ParkingLot,
  Place,
  SearchSuggestion,
};
