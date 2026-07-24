import { useState, useEffect } from "react";
import { WebhookConfig, WebhookLog, WebhookEvent, WebhookHeader } from "../types";
import { webhookRepository } from "../repositories/webhookRepository";
import { webhookDispatcherService } from "../services/webhookDispatcherService";
import { useWebhookStore } from "../store/webhookStore";

interface UseDashboardWebhooksProps {
  shopId: string;
  showConfirmation: (title: string, message: string, onConfirm: () => void) => void;
}

export function useDashboardWebhooks({ shopId, showConfirmation }: UseDashboardWebhooksProps) {
  const {
    webhooks,
    logs,
    loading,
    actionLoading,
    subscribeToShopWebhooks,
    addWebhook,
    updateWebhook,
    toggleWebhookActive,
    deleteWebhook,
    setActionLoading,
  } = useWebhookStore();

  // Webhook Form Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  
  const [formName, setFormName] = useState<string>("");
  const [formUrl, setFormUrl] = useState<string>("");
  const [formSecret, setFormSecret] = useState<string>("");
  const [formEvents, setFormEvents] = useState<WebhookEvent[]>([
    "ticket.created",
    "ticket.calling",
    "ticket.completed"
  ]);
  const [formHeaders, setFormHeaders] = useState<WebhookHeader[]>([
    { key: "", value: "" }
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // Test Modal State
  const [testingWebhook, setTestingWebhook] = useState<WebhookConfig | null>(null);
  const [testEvent, setTestEvent] = useState<WebhookEvent>("ticket.created");
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Inspect Log Modal State
  const [inspectingLog, setInspectingLog] = useState<WebhookLog | null>(null);

  // Real-time Webhook & Log Subscriptions via Zustand Store
  useEffect(() => {
    if (!shopId) return;
    const unsub = subscribeToShopWebhooks(shopId);
    return () => unsub();
  }, [shopId, subscribeToShopWebhooks]);

  // Open Form Modal for Create or Edit
  const openModal = (webhookToEdit?: WebhookConfig) => {
    setFormError(null);
    if (webhookToEdit) {
      setEditingWebhook(webhookToEdit);
      setFormName(webhookToEdit.name || "");
      setFormUrl(webhookToEdit.url || "");
      setFormSecret(webhookToEdit.secret || "");
      setFormEvents(webhookToEdit.events || []);
      setFormHeaders(webhookToEdit.headers && webhookToEdit.headers.length > 0 ? webhookToEdit.headers : [{ key: "", value: "" }]);
    } else {
      setEditingWebhook(null);
      setFormName("");
      setFormUrl("");
      setFormSecret("");
      setFormEvents(["ticket.created", "ticket.calling", "ticket.completed"]);
      setFormHeaders([{ key: "", value: "" }]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingWebhook(null);
    setFormError(null);
  };

  // Toggle Event Checkbox in Form
  const toggleEventSelection = (event: WebhookEvent) => {
    if (formEvents.includes(event)) {
      setFormEvents(formEvents.filter((e) => e !== event));
    } else {
      setFormEvents([...formEvents, event]);
    }
  };

  // Manage Custom Headers in Form
  const handleAddHeader = () => {
    setFormHeaders([...formHeaders, { key: "", value: "" }]);
  };

  const handleUpdateHeader = (index: number, field: "key" | "value", value: string) => {
    const updated = [...formHeaders];
    updated[index][field] = value;
    setFormHeaders(updated);
  };

  const handleRemoveHeader = (index: number) => {
    setFormHeaders(formHeaders.filter((_, i) => i !== index));
  };

  // Submit Save/Edit Webhook using Zustand store
  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError("Webhook name is required.");
      return;
    }

    if (!formUrl.trim() || (!formUrl.startsWith("http://") && !formUrl.startsWith("https://"))) {
      setFormError("Please enter a valid HTTP or HTTPS target URL.");
      return;
    }

    if (formEvents.length === 0) {
      setFormError("Select at least one event trigger.");
      return;
    }

    const filteredHeaders = formHeaders.filter((h) => h.key.trim() !== "" && h.value.trim() !== "");

    try {
      if (editingWebhook) {
        await updateWebhook(shopId, editingWebhook.id, {
          name: formName.trim(),
          url: formUrl.trim(),
          secret: formSecret.trim(),
          events: formEvents,
          headers: filteredHeaders,
        });
      } else {
        await addWebhook(shopId, {
          name: formName.trim(),
          url: formUrl.trim(),
          secret: formSecret.trim(),
          events: formEvents,
          headers: filteredHeaders,
        });
      }
      closeModal();
    } catch (err: any) {
      console.error("Error saving webhook:", err);
      setFormError(err.message || "Failed to save webhook endpoint.");
    }
  };

  // Toggle Active/Inactive State
  const handleToggleActive = async (webhook: WebhookConfig) => {
    try {
      await toggleWebhookActive(shopId, webhook.id, !webhook.isActive);
    } catch (err) {
      console.error("Failed to toggle webhook active state:", err);
    }
  };

  // Delete Webhook Confirmation
  const handleDeleteWebhook = (webhook: WebhookConfig) => {
    showConfirmation(
      "Delete Webhook",
      `Are you sure you want to remove '${webhook.name}'? Real-time queue updates will no longer be delivered to this URL.`,
      async () => {
        try {
          await deleteWebhook(shopId, webhook.id);
        } catch (err) {
          console.error("Failed to delete webhook:", err);
        }
      }
    );
  };

  // Open Test Modal
  const openTestModal = (webhook: WebhookConfig) => {
    setTestingWebhook(webhook);
    setTestEvent(webhook.events[0] || "ticket.created");
    setTestResult(null);
  };

  const closeTestModal = () => {
    setTestingWebhook(null);
    setTestResult(null);
    setIsTesting(false);
  };

  // Run Test Endpoint
  const handleRunTest = async () => {
    if (!testingWebhook) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await webhookDispatcherService.testEndpoint(
        testingWebhook.url,
        testEvent,
        testingWebhook.secret,
        testingWebhook.headers
      );

      setTestResult(result);

      // Log test attempt
      await webhookRepository.logDelivery({
        webhookId: testingWebhook.id,
        webhookName: `${testingWebhook.name} (Test)`,
        shopId,
        event: testEvent,
        url: testingWebhook.url,
        statusCode: result.statusCode || 0,
        success: !!result.success,
        responseSummary: result.responseSummary || (result.success ? "200 OK (Test)" : "Failed"),
        payload: result.payloadSent || { isTest: true },
        durationMs: result.durationMs || 0,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Error running webhook test:", err);
      setTestResult({
        success: false,
        statusCode: 0,
        durationMs: 0,
        responseSummary: err.message || "Test request failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Resend / Retry a logged delivery
  const handleResendLog = async (log: WebhookLog) => {
    try {
      setActionLoading(true);
      const matchingWh = webhooks.find((w) => w.id === log.webhookId);
      const targetUrl = matchingWh ? matchingWh.url : log.url;
      const secret = matchingWh ? matchingWh.secret : "";
      const headers = matchingWh ? matchingWh.headers : [];

      const result = await webhookDispatcherService.testEndpoint(
        targetUrl,
        log.event,
        secret,
        headers,
        log.payload
      );

      await webhookRepository.logDelivery({
        webhookId: log.webhookId,
        webhookName: `${log.webhookName || "Webhook"} (Retry)`,
        shopId,
        event: log.event,
        url: targetUrl,
        statusCode: result.statusCode || 0,
        success: !!result.success,
        responseSummary: result.responseSummary || "Resent successfully",
        payload: log.payload,
        durationMs: result.durationMs || 0,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error resending webhook payload:", err);
    } finally {
      setActionLoading(false);
    }
  };

  return {
    webhooks,
    logs,
    loading,
    actionLoading,
    
    // Modal states
    isModalOpen,
    openModal,
    closeModal,
    editingWebhook,
    formName,
    setFormName,
    formUrl,
    setFormUrl,
    formSecret,
    setFormSecret,
    formEvents,
    toggleEventSelection,
    formHeaders,
    handleAddHeader,
    handleUpdateHeader,
    handleRemoveHeader,
    formError,
    handleSaveWebhook,

    // Actions
    handleToggleActive,
    handleDeleteWebhook,

    // Test states
    testingWebhook,
    openTestModal,
    closeTestModal,
    testEvent,
    setTestEvent,
    isTesting,
    testResult,
    handleRunTest,

    // Inspector
    inspectingLog,
    setInspectingLog,
    handleResendLog,
  };
}
