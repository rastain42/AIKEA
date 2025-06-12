// hooks/usePdfService.ts
import { useState, useEffect } from "react";
import pdfService, { PdfDocument, SyncResult } from "../services/PdfService";

export const usePdfService = () => {
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async (forceSync = false) => {
    try {
      setLoading(true);
      setError(null);
      const docs = await pdfService.getAllDocuments(forceSync);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const syncDocuments = async (): Promise<SyncResult | null> => {
    try {
      setSyncing(true);
      setError(null);
      const result = await pdfService.forceSyncWithRemote();
      await loadDocuments(); // Recharger après sync
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur de synchronisation"
      );
      return null;
    } finally {
      setSyncing(false);
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const success = await pdfService.deleteDocument(id);
      if (success) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
      return false;
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  return {
    documents,
    loading,
    syncing,
    error,
    loadDocuments,
    syncDocuments,
    deleteDocument,
    searchDocuments: pdfService.searchDocuments.bind(pdfService),
    addDocument: pdfService.addDocument.bind(pdfService),
    getStats: pdfService.getStats.bind(pdfService),
  };
};
