import { getAuthHeader } from "../lib/authUtils";

/**
  * vendorAnalyticsRepository
  * 
  * Infrastructure repository encapsulating external analytics processing APIs
  * and Gemini diagnostic systems.
  */
export const vendorAnalyticsRepository = {
  /**
    * Calls the backend Gemini AI model to diagnose daily queue load metrics,
    * staff performance, and satisfaction levels.
    */
  async getAiDiagnostics(stats: any): Promise<{ analysis: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authHeader = await getAuthHeader();
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch("/api/ai-diagnose", {
      method: "POST",
      headers,
      body: JSON.stringify({ stats }),
    });

    if (!response.ok) {
      throw new Error(`AI diagnostics service failed with status ${response.status}`);
    }
    return response.json();
  }
};
