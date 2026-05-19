// Location Slice — manages rider GPS state
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface LocationState {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  isTracking: boolean;
  lastUpdated: number;
}

const initialState: LocationState = {
  latitude: 0,
  longitude: 0,
  heading: 0,
  speed: 0,
  isTracking: false,
  lastUpdated: 0,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    updateLocation(
      state,
      action: PayloadAction<{
        latitude: number;
        longitude: number;
        heading?: number;
        speed?: number;
      }>,
    ) {
      state.latitude = action.payload.latitude;
      state.longitude = action.payload.longitude;
      state.heading = action.payload.heading ?? state.heading;
      state.speed = action.payload.speed ?? state.speed;
      state.lastUpdated = Date.now();
    },
    setTracking(state, action: PayloadAction<boolean>) {
      state.isTracking = action.payload;
    },
  },
});

export const { updateLocation, setTracking } = locationSlice.actions;
export default locationSlice.reducer;
