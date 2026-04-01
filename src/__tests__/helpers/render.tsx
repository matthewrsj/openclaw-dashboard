/**
 * Custom render helper that wraps components with necessary providers.
 */
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * Custom render function.
 * For now just passes through to RTL's render since we're not using
 * context providers that need wrapping (Zustand doesn't need providers).
 * TanStack Router components will need mocking at the test level.
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { ...options });
}

export * from "@testing-library/react";
export { customRender as render };
