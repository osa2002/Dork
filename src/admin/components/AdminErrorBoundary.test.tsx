import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { AdminErrorBoundary } from "./AdminErrorBoundary";
import { ClientLogger } from "../../lib/clientLogger";

describe("AdminErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children without error when no exception is thrown", () => {
    render(
      <AdminErrorBoundary>
        <div data-testid="child-content">Admin Content Loaded</div>
      </AdminErrorBoundary>
    );

    expect(screen.getByTestId("child-content")).toBeDefined();
    expect(screen.getByText("Admin Content Loaded")).toBeDefined();
  });

  it("computes derived state from error properly", () => {
    const error = new Error("Fatal Admin Exception");
    const state = AdminErrorBoundary.getDerivedStateFromError(error);

    expect(state.hasError).toBe(true);
    expect(state.error).toBe(error);
  });

  it("catches errors, renders fallback UI, and reports exception to ClientLogger", () => {
    const captureExceptionSpy = vi.spyOn(ClientLogger, "captureException");
    const ref = createRef<AdminErrorBoundary>();

    render(
      <AdminErrorBoundary ref={ref}>
        <div data-testid="child-content">Admin Content Loaded</div>
      </AdminErrorBoundary>
    );

    const testError = new Error("Simulated Admin UI Fatal Error");
    act(() => {
      ref.current?.setState({
        hasError: true,
        error: testError,
      });
      ref.current?.componentDidCatch(testError, {
        componentStack: "in BuggyAdminComponent",
      });
    });

    expect(screen.queryByTestId("child-content")).toBeNull();
    expect(screen.getByText("Admin Component Runtime Exception")).toBeDefined();
    expect(screen.getByText(/Simulated Admin UI Fatal Error/i)).toBeDefined();

    expect(captureExceptionSpy).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({
        component: "AdminErrorBoundary",
        componentStack: "in BuggyAdminComponent",
      })
    );
  });

  it("calls onReset callback when reload button is clicked", () => {
    const onResetMock = vi.fn();
    const ref = createRef<AdminErrorBoundary>();

    render(
      <AdminErrorBoundary ref={ref} onReset={onResetMock}>
        <div data-testid="child-content">Admin Content Loaded</div>
      </AdminErrorBoundary>
    );

    act(() => {
      ref.current?.setState({
        hasError: true,
        error: new Error("Test error"),
      });
    });

    const reloadButton = screen.getByRole("button", { name: /Reload Admin Console/i });
    fireEvent.click(reloadButton);

    expect(onResetMock).toHaveBeenCalledTimes(1);
  });

  it("renders custom fallback node when provided", () => {
    const ref = createRef<AdminErrorBoundary>();

    render(
      <AdminErrorBoundary
        ref={ref}
        fallback={<div data-testid="custom-fallback">Custom Admin Error Fallback</div>}
      >
        <div data-testid="child-content">Admin Content Loaded</div>
      </AdminErrorBoundary>
    );

    act(() => {
      ref.current?.setState({
        hasError: true,
        error: new Error("Test error"),
      });
    });

    expect(screen.getByTestId("custom-fallback")).toBeDefined();
    expect(screen.getByText("Custom Admin Error Fallback")).toBeDefined();
  });
});

