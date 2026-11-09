import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Vitest may load SDK constructors in a separate module realm. Register the
// actual test-realm implementation with the same process-wide signing policy.
const signaturePolicy = (process as unknown as Record<symbol, unknown>)[Symbol.for('arkafund.test.signaturePolicy')];
if (typeof signaturePolicy === 'function') {
  const sdk = await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
  signaturePolicy(sdk, { version: 'frontend-runtime', format: 'vitest' });
} else if (process.env.ARKA_EPHEMERAL_SIGNATURE_TESTS === '1') {
  throw new Error('CONTAINED_SIGNATURE_POLICY_REQUIRED');
}

// JSDOM has no native dialog methods. Model their DOM state and close event;
// browser focus trapping/Escape still require the separate browser validation.
// Do not suppress uncaught errors or change the product's native modal code.
if (typeof HTMLDialogElement !== "undefined") {
  if (typeof HTMLDialogElement.prototype.showModal !== "function") {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true, writable: true,
      value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
    });
  }
  if (typeof HTMLDialogElement.prototype.close !== "function") {
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true, writable: true,
      value: function (this: HTMLDialogElement, returnValue?: string) {
        if (!this.open) return;
        if (returnValue !== undefined) this.returnValue = returnValue;
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    });
  }
}
