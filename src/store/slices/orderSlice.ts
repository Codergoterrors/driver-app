// Order Slice — manages active order state
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Order } from '../../types';

interface OrderState {
  activeOrder: Order | null;
  incomingOrder: Order | null;
  isOnline: boolean;
  todayEarnings: number;
  todayTrips: number;
}

const initialState: OrderState = {
  activeOrder: null,
  incomingOrder: null,
  isOnline: false,
  todayEarnings: 0,
  todayTrips: 0,
};

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    setOnline(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    setIncomingOrder(state, action: PayloadAction<Order | null>) {
      state.incomingOrder = action.payload;
    },
    setActiveOrder(state, action: PayloadAction<Order | null>) {
      state.activeOrder = action.payload;
    },
    updateActiveOrder(state, action: PayloadAction<Partial<Order>>) {
      if (state.activeOrder) {
        state.activeOrder = { ...state.activeOrder, ...action.payload };
      }
    },
    addEarnings(state, action: PayloadAction<number>) {
      state.todayEarnings += action.payload;
      state.todayTrips += 1;
    },
    resetDailyStats(state) {
      state.todayEarnings = 0;
      state.todayTrips = 0;
    },
    clearOrder(state) {
      state.activeOrder = null;
      state.incomingOrder = null;
    },
  },
});

export const {
  setOnline,
  setIncomingOrder,
  setActiveOrder,
  updateActiveOrder,
  addEarnings,
  resetDailyStats,
  clearOrder,
} = orderSlice.actions;
export default orderSlice.reducer;
