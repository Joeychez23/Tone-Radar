import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import App from "./App";

const analysis = {
  sentences: [
    { index: 0, text: "Per my last email, the report was due.", start: 0, end: 38, kind: "sentence", paragraph: 0, analysis: { pa: 0.8, blame: 0.2, hedge: 0, ask: 0, request: 0, clarity: 0, confidence: { pa: 0.9 }, levels: { pa: [0, 0, 0.6, 0.4], blame: [1], hedge: [1], clarity: [1] } } },
    { index: 1, text: "Thanks!", start: 39, end: 46, kind: "signoff", paragraph: 0 },
  ],
  message: { tone: "frustrated", toneProbabilities: { frustrated: 0.7 }, reaction: 0.6, hasRequest: 0.1, nextStepClear: 0.9, fit: 0.5 },
  stats: { cached: 0 },
};

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = jest.fn(async (url) => {
    const body = url.endsWith("/health") ? { ok: true, db: "disabled", accounts: false } : url.endsWith("/analyze") ? analysis : { original: null, candidates: [], patterns: [], stats: {} };
    return { ok: true, status: 200, json: async () => body };
  });
  global.ResizeObserver = class { observe() {} disconnect() {} };
});

test("shows the empty state, then a heatmap with a hot sentence", async () => {
  jest.useFakeTimers();
  render(<App />);
  expect(screen.getByText(/check your tone before you hit send/i)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Per my last email, the report was due. Thanks!" } });
  await act(async () => {
    jest.advanceTimersByTime(700);
  });
  jest.useRealTimers();
  await waitFor(() => expect(screen.getByRole("button", { name: /Sentence 1\. Hot/ })).toBeInTheDocument());
  expect(screen.getByText("1 hot sentence left")).toBeInTheDocument();
  expect(screen.getAllByText("Frustrated").length).toBeGreaterThan(0);
  expect(screen.getByText("Guest mode")).toBeInTheDocument();
});
