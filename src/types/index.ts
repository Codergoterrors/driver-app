// Uber Driver App — Type Definitions
// Shared types compatible with customer app + rider-specific types

// ==================== RIDER ====================
export interface Rider {
  uid: string;
  name: string;
  email: string;
  phone: string;
  profilePhotoUrl?: string;
  fcmToken?: string;
  vehicleType: 'bike' | 'bicycle';
  vehiclePlate: string;
  vehicleModel: string;
  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
  isOnline: boolean;
  activeOrderId: string | null;
  currentLat: number;
  currentLng: number;
  createdAt: number;
  updatedAt: number;
}

// ==================== LIVE LOCATION (Realtime DB) ====================
export interface RiderLiveLocation {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  updatedAt: number;
  isOnline: boolean;
  activeOrderId: string | null;
}

// ==================== ORDER (shared with customer app) ====================
export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'RIDER_ASSIGNED'
  | 'PICKED_UP'
  | 'ON_THE_WAY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface SelectedCustomization {
  groupId: string;
  groupTitle: string;
  optionId: string;
  optionName: string;
  extraPrice: number;
}

export interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  customizations: SelectedCustomization[];
  specialInstructions?: string;
}

export interface OrderPricing {
  subtotal: number;
  deliveryFee: number;
  taxes: number;
  discount: number;
  total: number;
}

export interface OrderDeliveryAddress {
  fullAddress: string;
  lat: number;
  lng: number;
  flatNo?: string;
  landmark?: string;
  label?: string;
  additionalDetails?: string;
  dropoffType?: string;
  noteFromCustomer?: string;
}

export interface OrderPaymentMethod {
  type: 'card' | 'upi' | 'wallet';
  label: string;
}

export interface StatusTimelineEntry {
  status: OrderStatus;
  timestamp: number;
  note?: string;
}

export interface Order {
  orderId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImage: string;
  restaurantAddress?: string;
  restaurantLat?: number;
  restaurantLng?: number;
  restaurantNote?: string;
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  riderRating?: number;
  riderVehicle?: string;
  riderPlateNumber?: string;
  riderPhotoUrl?: string;
  status: OrderStatus;
  items: OrderItem[];
  pricing: OrderPricing;
  deliveryAddress: OrderDeliveryAddress;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  estimatedDeliveryTime: number;
  actualDeliveryTime?: number;
  statusTimeline: StatusTimelineEntry[];
  deliveryPin?: string;
  acceptedAt?: number;
  pickedUpAt?: number;
  deliveredAt?: number;
  createdAt: number;
  updatedAt: number;
  driverPayout?: number;
  routeCoordinates?: Array<{ latitude: number; longitude: number }>;
}

// ==================== CANCELLATION ====================
export type CancellationReason =
  | 'restaurant_closed'
  | 'item_not_available'
  | 'restaurant_not_there'
  | 'unable_to_find_restaurant'
  | 'excessive_wait_time'
  | 'order_was_canceled'
  | 'order_picked_by_someone_else'
  | 'oversized_item'
  | 'other';

export type CancellationType = 'full_cancel' | 'unassign_rider';

// ==================== EARNINGS ====================
export interface EarningsDay {
  date: string;
  trips: number;
  amount: number;
  onlineHours: number;
}

export interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  trips: number;
}

// ==================== NAVIGATION ====================
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
};

export type MainStackParamList = {
  Home: undefined;
  Preferences: undefined;
  OrderRequest: { orderId: string };
  ActiveOrder: { orderId: string; phase: 'pickup' | 'delivery' };
  OrderDetails: { orderId: string };
  Earnings: undefined;
  ItemEdit: { orderId: string };
};

export type DrawerParamList = {
  MainHome: undefined;
  Earnings: undefined;
  Account: undefined;
  Help: undefined;
  Settings: undefined;
};
