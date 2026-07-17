import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./authStore";

describe("useAuthStore (Zustand)", () => {
  beforeEach(() => {
    // Reset state before each test
    useAuthStore.setState({
      user: null,
      loading: true,
      isAdmin: false,
    });
  });

  it("should initialize with default authentication states", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(true);
    expect(state.isAdmin).toBe(false);
  });

  it("should correctly set authentication user", () => {
    const store = useAuthStore.getState();
    const mockUser = { uid: "user_123", email: "user@example.com" };
    
    store.setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it("should correctly set loading state", () => {
    const store = useAuthStore.getState();
    
    store.setLoading(false);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it("should correctly set administrative state", () => {
    const store = useAuthStore.getState();
    
    store.setIsAdmin(true);
    expect(useAuthStore.getState().isAdmin).toBe(true);
  });

  it("should clear state and sign out on logout action", async () => {
    useAuthStore.setState({
      user: { uid: "admin_456" },
      loading: false,
      isAdmin: true,
    });

    const store = useAuthStore.getState();
    await store.logout();

    const updatedState = useAuthStore.getState();
    expect(updatedState.user).toBeNull();
    expect(updatedState.isAdmin).toBe(false);
    expect(updatedState.loading).toBe(false);
  });
});
