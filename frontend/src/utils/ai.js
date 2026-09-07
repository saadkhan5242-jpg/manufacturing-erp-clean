import apiClient from "../lib/apiClient.js";

export async function sendAIMessage(message) {
  const data = await apiClient.post("/ai/chat", { message });
  return data.reply;
}
