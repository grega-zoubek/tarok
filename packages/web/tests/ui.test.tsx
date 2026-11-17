// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../src/components/Modal";
import { SetupScreen } from "../src/components/SetupScreen";
import { PhasePanel } from "../src/components/PhasePanel";
import { useTarokGame } from "../src/hooks/useTarokGame";
import { serializeSession, SESSION_STORAGE_KEY } from "../src/lib/session";
import { trajectory } from "./gameFixtures";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("accessible game controls", () => {
  it("labels setup fields and submits immutable bot settings", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<SetupScreen onStart={onStart} />);
    const name = screen.getByLabelText(/Tvoje ime/);
    await user.clear(name);
    await user.type(name, "Grega");
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Igraj!" }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart.mock.calls[0]![0].humanName).toBe("Grega");
    expect(onStart.mock.calls[0]![0].botConfigs).toHaveLength(3);
  });

  it("contains modal focus, closes with Escape and restores previous focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const previous = document.createElement("button");
    previous.textContent = "Before";
    document.body.append(previous);
    previous.focus();
    const view = render(
      <Modal title="Napaka" onClose={onClose}>
        <button>Prvi</button>
        <button>Zadnji</button>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Napaka" })).toBeDefined();
    const first = screen.getByRole("button", { name: "Prvi" });
    const last = screen.getByRole("button", { name: "Zadnji" });
    expect(document.activeElement).toBe(first);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    expect(document.activeElement).toBe(previous);
    previous.remove();
  });

  it("keeps a result dialog open when dismissal is not provided", async () => {
    const user = userEvent.setup();
    render(
      <Modal title="Rezultat">
        <button>Naprej</button>
      </Modal>,
    );
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  });

  it("gives called suits descriptive names", () => {
    const session = trajectory("tri").find((s) => s.state!.phase === "calling")!;
    sessionStorage.setItem(SESSION_STORAGE_KEY, serializeSession(session));
    const hook = renderHook(() => useTarokGame());
    render(<PhasePanel game={hook.result.current} selectedCount={0} onConfirmDiscard={() => {}} />);
    for (const name of ["Srce", "Kara", "Križ", "Pik"])
      expect(screen.getByRole("button", { name: new RegExp(name, "i") })).toBeDefined();
  });

  it("does not nest card buttons inside talon selection buttons", () => {
    const session = trajectory("tri").find(
      (s) => s.state!.phase === "talon" && s.state!.pickedTalonGroupIndex === undefined,
    )!;
    sessionStorage.setItem(SESSION_STORAGE_KEY, serializeSession(session));
    const hook = renderHook(() => useTarokGame());
    const view = render(
      <PhasePanel game={hook.result.current} selectedCount={0} onConfirmDiscard={() => {}} />,
    );
    expect(view.container.querySelector("button button")).toBeNull();
    expect(view.container.querySelectorAll("img")).toHaveLength(6);
  });
});
