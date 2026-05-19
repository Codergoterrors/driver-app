// Uber Driver App — Utility Functions

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns distance in kilometers
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate travel time assuming 30 km/h average speed
 * @returns estimated time in minutes
 */
export function estimatedMinutes(km: number): number {
  return Math.round((km / 30) * 60);
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  }
  return `${minutes} min`;
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Calculate delivery earning amount
 * Pickup: Free for first 2km, then ₹7/km
 * Delivery: ₹15/km (pickup to drop)
 */
export function calculateEarnings(
  riderLat: number,
  riderLng: number,
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number,
): {
  amount: string;
  totalKm: number;
  totalMinutes: number;
  pickupKm: number;
  deliveryKm: number;
  pickupAmount: number;
  deliveryAmount: number;
  totalAmount: number;
} {
  const pickupKm = haversineKm(riderLat, riderLng, pickupLat, pickupLng);
  const deliveryKm = haversineKm(pickupLat, pickupLng, dropLat, dropLng);
  const totalKm = pickupKm + deliveryKm;

  // Pickup: free for first 2km, ₹7/km after that
  const pickupAmount = pickupKm > 2 ? (pickupKm - 2) * 7 : 0;
  // Delivery: ₹15/km
  const deliveryAmount = deliveryKm * 15;
  const totalAmount = Math.round((pickupAmount + deliveryAmount) * 100) / 100;

  const totalMinutes = estimatedMinutes(totalKm);
  return {
    amount: totalAmount.toFixed(2),
    totalKm,
    totalMinutes,
    pickupKm,
    deliveryKm,
    pickupAmount: Math.round(pickupAmount * 100) / 100,
    deliveryAmount: Math.round(deliveryAmount * 100) / 100,
    totalAmount,
  };
}

/**
 * Generate a 4-digit delivery PIN
 */
export function generateDeliveryPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Format customer name as "FirstName L."
 */
export function formatCustomerName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return parts[0] || 'Customer';
}

/**
 * Generate short order ID (first 5 chars, uppercase)
 */
export function shortOrderId(orderId: string): string {
  return orderId.substring(0, 5).toUpperCase();
}

/**
 * Format currency in INR
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/**
 * Format time from timestamp
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minuteStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minuteStr} ${ampm}`;
}
