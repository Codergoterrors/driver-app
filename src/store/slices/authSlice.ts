// Auth Slice — manages rider authentication state
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Rider } from '../../types';

interface AuthState {
  rider: Rider | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  rider: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setRider(state, action: PayloadAction<Rider>) {
      state.rider = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    },
    updateRider(state, action: PayloadAction<Partial<Rider>>) {
      if (state.rider) {
        state.rider = { ...state.rider, ...action.payload };
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    logout(state) {
      state.rider = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const { setRider, updateRider, setLoading, setError, logout } =
  authSlice.actions;
export default authSlice.reducer;
