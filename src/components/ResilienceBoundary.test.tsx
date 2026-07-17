import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { createRef } from "react";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { ResilienceBoundary } from "./ResilienceBoundary";

describe("ResilienceBoundary Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render children normally when no error occurs", () => {
    render(
      <ResilienceBoundary>
        <div data-testid="child-content-normal">App runs successfully</div>
      </ResilienceBoundary>
    );

    expect(screen.getByTestId("child-content-normal")).toBeDefined();
    expect(screen.queryByText("Application Crash Safely Handled")).toBeNull();
  });

  it("should correctly compute derived state from error", () => {
    const error = new Error("Simulated component crash!");
    const derivedState = ResilienceBoundary.getDerivedStateFromError(error);
    
    expect(derivedState.hasError).toBe(true);
    expect(derivedState.error).toBe(error);
    expect(derivedState.copied).toBe(false);
    expect(derivedState.supportSubmitted).toBe(false);
  });

  it("should render safe fallback crash UI when error state is injected via reference", async () => {
    const ref = createRef<ResilienceBoundary>();
    render(
      <ResilienceBoundary ref={ref}>
        <div data-testid="child-content-error">App runs successfully</div>
      </ResilienceBoundary>
    );

    // Manually transition state via class component instance wrapped in act()
    act(() => {
      ref.current?.setState({
        hasError: true,
        error: new Error("Simulated component crash!"),
      });
    });

    expect(screen.queryByTestId("child-content-error")).toBeNull();
    expect(screen.getByText("Application Crash Safely Handled")).toBeDefined();
    expect(screen.getAllByText(/Simulated component crash!/).length).toBeGreaterThan(0);
  });

  it("should invoke window.location.reload when 'Reset & Restart App' is clicked", () => {
    const ref = createRef<ResilienceBoundary>();
    render(
      <ResilienceBoundary ref={ref}>
        <div data-testid="child-content-restart">App runs successfully</div>
      </ResilienceBoundary>
    );

    act(() => {
      ref.current?.setState({
        hasError: true,
        error: new Error("Simulated component crash!"),
      });
    });

    const restartBtn = screen.getByRole("button", { name: /Reset & Restart App/i });
    fireEvent.click(restartBtn);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("should copy logs to clipboard and show 'Copied!' feedback when copy logs button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    const ref = createRef<ResilienceBoundary>();
    render(
      <ResilienceBoundary ref={ref}>
        <div data-testid="child-content-copy">App runs successfully</div>
      </ResilienceBoundary>
    );

    act(() => {
      ref.current?.setState({
        hasError: true,
        error: new Error("Simulated component crash!"),
      });
    });

    const copyBtn = screen.getByRole("button", { name: /Copy Logs/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Copied!")).toBeDefined();
  });

  it("should allow submitting an instant recovery support ticket", async () => {
    const ref = createRef<ResilienceBoundary>();
    render(
      <ResilienceBoundary ref={ref}>
        <div data-testid="child-content-ticket">App runs successfully</div>
      </ResilienceBoundary>
    );

    act(() => {
      ref.current?.setState({
        hasError: true,
        error: new Error("Simulated component crash!"),
      });
    });

    const emailInput = screen.getByPlaceholderText("Your work email...");
    const textInput = screen.getByPlaceholderText(/What were you trying to do/i);
    const submitBtn = screen.getByRole("button", { name: /Submit Ticket/i });

    fireEvent.change(emailInput, { target: { value: "developer@example.com" } });
    fireEvent.change(textInput, { target: { value: "I clicked the delete button" } });
    
    act(() => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Diagnostic Ticket Submitted!")).toBeDefined();
      expect(screen.getByText(/Your operational session logs have been attached/i)).toBeDefined();
    });
  });
});
