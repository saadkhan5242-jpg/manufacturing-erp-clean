import apiClient from "./apiClient.js";

export function extractQuoteProposal(payload) {
  return apiClient.post("/api/ai-intake/quote-extraction", payload);
}

export function listQuoteProposals() {
  return apiClient.get("/api/ai-intake/quote-proposals");
}

export function reviewQuoteProposal(id, payload) {
  return apiClient.patch(`/api/ai-intake/quote-proposals/${id}/review`, payload);
}
