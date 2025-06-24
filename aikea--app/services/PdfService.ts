import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PdfDocument {
  id: string;
  name: string;
  originalName?: string;
  size: number;
  uploadedAt: string;
  downloadUrl?: string;
  viewUrl?: string;
  type: "pdf";
  mimeType: "application/pdf";
  tags?: string[];
  description?: string;
}

export interface PdfStats {
  totalPdfs: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  lastUpdated: string;
  lastSync?: string;
}

export interface SyncResult {
  success: boolean;
  localCount: number;
  remoteCount: number;
  newDocuments: number;
  updatedDocuments: number;
  deletedDocuments: number;
  errors: string[];
}

class PdfService {
  private readonly STORAGE_KEY = "@pdf_documents";
  private readonly SYNC_TIMESTAMP_KEY = "@pdf_last_sync";
  private readonly API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080";

  /**
   * Synchroniser les PDFs avec l'API distante
   */
  async syncWithRemoteApi(): Promise<SyncResult> {
    const syncResult: SyncResult = {
      success: false,
      localCount: 0,
      remoteCount: 0,
      newDocuments: 0,
      updatedDocuments: 0,
      deletedDocuments: 0,
      errors: [],
    };

    try {
      console.log("🔄 Démarrage de la synchronisation...");

      // 1. Récupérer les données locales
      const localDocuments = await this.getLocalDocuments();
      syncResult.localCount = localDocuments.length;

      // 2. Récupérer les données distantes
      const remoteDocuments = await this.fetchRemoteDocuments();
      syncResult.remoteCount = remoteDocuments.length;

      // Si pas d'endpoints distants disponibles, garder les données locales
      if (remoteDocuments.length === 0 && syncResult.localCount > 0) {
        console.log("ℹ️ Mode local uniquement - données locales conservées");
        syncResult.success = true;
        return syncResult;
      }

      // 3. Synchroniser les données
      const { merged, stats } = this.mergeDocuments(
        localDocuments,
        remoteDocuments
      );

      syncResult.newDocuments = stats.newDocuments;
      syncResult.updatedDocuments = stats.updatedDocuments;
      syncResult.deletedDocuments = stats.deletedDocuments;

      // 4. Sauvegarder les données synchronisées
      await this.saveLocalDocuments(merged);
      await this.updateLastSyncTimestamp();

      syncResult.success = true;
      console.log("✅ Synchronisation terminée avec succès");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      syncResult.errors.push(errorMessage);
      console.error("❌ Erreur lors de la synchronisation:", error);
    }

    return syncResult;
  }

  /**
   * Récupérer tous les PDFs (local + sync si nécessaire)
   */
  async getAllDocuments(forceSync = false): Promise<PdfDocument[]> {
    try {
      if (forceSync || (await this.shouldSync())) {
        await this.syncWithRemoteApi();
      }

      return await this.getLocalDocuments();
    } catch (error) {
      console.error("Erreur lors de la récupération des documents:", error);
      // Fallback sur les données locales
      return await this.getLocalDocuments();
    }
  }

  /**
   * Rechercher des PDFs par texte
   */
  async searchDocuments(searchText: string): Promise<PdfDocument[]> {
    const documents = await this.getAllDocuments();
    const searchLower = searchText.toLowerCase();

    return documents.filter(
      (doc) =>
        doc.name.toLowerCase().includes(searchLower) ||
        doc.originalName?.toLowerCase().includes(searchLower) ||
        doc.description?.toLowerCase().includes(searchLower) ||
        doc.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }

  /**
   * Récupérer un PDF par son ID
   */
  async getDocumentById(id: string): Promise<PdfDocument | null> {
    const documents = await this.getAllDocuments();
    return documents.find((doc) => doc.id === id) || null;
  }

  /**
   * Ajouter/Uploader un nouveau PDF
   */
  async addDocument(
    file: File | any,
    customName?: string
  ): Promise<PdfDocument> {
    try {
      // 1. Valider le fichier
      this.validatePdfFile(file);

      // 2. Créer le document local
      const newDocument: PdfDocument = {
        id: this.generateUniqueId(),
        name: customName || this.extractFileName(file.name),
        originalName: file.name,
        size: file.size || 0,
        uploadedAt: new Date().toISOString(),
        type: "pdf",
        mimeType: "application/pdf",
        tags: this.extractTagsFromName(file.name),
      };

      // 3. Sauvegarder localement
      const documents = await this.getLocalDocuments();
      documents.push(newDocument);
      await this.saveLocalDocuments(documents);

      // 4. Essayer d'uploader vers l'API (optionnel, en arrière-plan)
      this.uploadToRemoteApi(file, newDocument).catch((error) => {
        console.warn(
          "Upload distant échoué (sera retenté lors de la sync):",
          error
        );
      });

      console.log("✅ Document ajouté:", newDocument.name);
      return newDocument;
    } catch (error) {
      console.error("❌ Erreur lors de l'ajout du document:", error);
      throw error;
    }
  }

  /**
   * Supprimer un PDF
   */
  async deleteDocument(id: string): Promise<boolean> {
    try {
      const documents = await this.getLocalDocuments();
      const initialLength = documents.length;

      const filteredDocuments = documents.filter((doc) => doc.id !== id);

      if (filteredDocuments.length === initialLength) {
        console.warn("Document non trouvé pour suppression:", id);
        return false;
      }

      await this.saveLocalDocuments(filteredDocuments);

      // Supprimer du serveur distant (optionnel)
      this.deleteFromRemoteApi(id).catch((error) => {
        console.warn("Suppression distante échouée:", error);
      });

      console.log("✅ Document supprimé:", id);
      return true;
    } catch (error) {
      console.error("❌ Erreur lors de la suppression:", error);
      return false;
    }
  }

  /**
   * Obtenir les statistiques des PDFs
   */
  async getStats(): Promise<PdfStats> {
    const documents = await this.getLocalDocuments();
    const lastSync = await AsyncStorage.getItem(this.SYNC_TIMESTAMP_KEY);

    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);

    return {
      totalPdfs: documents.length,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      lastUpdated: new Date().toISOString(),
      lastSync: lastSync || undefined,
    };
  }

  /**
   * Forcer une synchronisation complète
   */
  async forceSyncWithRemote(): Promise<SyncResult> {
    console.log("🔄 Synchronisation forcée...");
    return await this.syncWithRemoteApi();
  }

  /**
   * Vider le cache local
   */
  async clearLocalCache(): Promise<void> {
    await AsyncStorage.multiRemove([this.STORAGE_KEY, this.SYNC_TIMESTAMP_KEY]);
    console.log("🗑️ Cache local vidé");
  }

  // === MÉTHODES PRIVÉES ===

  private async getLocalDocuments(): Promise<PdfDocument[]> {
    try {
      const documentsString = await AsyncStorage.getItem(this.STORAGE_KEY);
      return documentsString ? JSON.parse(documentsString) : [];
    } catch (error) {
      console.error("Erreur lecture locale:", error);
      return [];
    }
  }

  private async saveLocalDocuments(documents: PdfDocument[]): Promise<void> {
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(documents));
  }

  private async fetchRemoteDocuments(): Promise<PdfDocument[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/pdfs`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        // Backend doesn't have PDF endpoints yet, return empty array
        console.log("ℹ️ Endpoint /api/pdfs non disponible, mode local uniquement");
        return [];
      }

      if (!response.ok) {
        throw new Error(
          `Erreur API: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Erreur récupération distante:", error);
      // Return empty array instead of throwing to allow local-only operation
      return [];
    }
  }

  private mergeDocuments(local: PdfDocument[], remote: PdfDocument[]) {
    const merged: PdfDocument[] = [];
    const stats = { newDocuments: 0, updatedDocuments: 0, deletedDocuments: 0 };

    // Créer une map des documents locaux pour comparaison rapide
    const localMap = new Map(local.map((doc) => [doc.id, doc]));

    // Traiter les documents distants
    remote.forEach((remoteDoc) => {
      const localDoc = localMap.get(remoteDoc.id);

      if (!localDoc) {
        // Nouveau document
        merged.push(remoteDoc);
        stats.newDocuments++;
      } else if (
        new Date(remoteDoc.uploadedAt) > new Date(localDoc.uploadedAt)
      ) {
        // Document mis à jour
        merged.push(remoteDoc);
        stats.updatedDocuments++;
      } else {
        // Garder la version locale
        merged.push(localDoc);
      }

      localMap.delete(remoteDoc.id);
    });

    // Ajouter les documents qui n'existent que localement
    localMap.forEach((localDoc) => {
      merged.push(localDoc);
    });

    return { merged, stats };
  }

  private async uploadToRemoteApi(
    file: File | any,
    document: PdfDocument
  ): Promise<void> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", document.name);
      formData.append("id", document.id);

      const response = await fetch(`${this.API_BASE_URL}/api/pdfs/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.status === 404) {
        console.log("ℹ️ Endpoint /api/pdfs/upload non disponible, upload local uniquement");
        return;
      }

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
    } catch (error) {
      console.warn("Upload distant échoué ou non disponible:", error);
      // Don't throw error to allow local-only operation
    }
  }

  private async deleteFromRemoteApi(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/pdfs/${id}`, {
        method: "DELETE",
      });

      if (response.status === 404) {
        console.log("ℹ️ Endpoint /api/pdfs/delete non disponible, suppression locale uniquement");
        return;
      }

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }
    } catch (error) {
      console.warn("Suppression distante échouée ou non disponible:", error);
      // Don't throw error to allow local-only operation
    }
  }

  private async shouldSync(): Promise<boolean> {
    const lastSync = await AsyncStorage.getItem(this.SYNC_TIMESTAMP_KEY);
    if (!lastSync) return true;

    const lastSyncTime = new Date(lastSync).getTime();
    const now = new Date().getTime();
    const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

    return now - lastSyncTime > SYNC_INTERVAL;
  }

  private async updateLastSyncTimestamp(): Promise<void> {
    await AsyncStorage.setItem(
      this.SYNC_TIMESTAMP_KEY,
      new Date().toISOString()
    );
  }

  private validatePdfFile(file: any): void {
    if (!file) {
      throw new Error("Aucun fichier fourni");
    }

    if (file.size === 0) {
      throw new Error("Le fichier est vide");
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error("Le fichier est trop volumineux (max 50MB)");
    }

    const fileName = file.name?.toLowerCase() || "";
    if (!fileName.endsWith(".pdf")) {
      throw new Error("Le fichier doit être un PDF");
    }
  }

  private generateUniqueId(): string {
    return `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractFileName(originalName: string): string {
    return originalName.replace(/\.[^/.]+$/, "");
  }

  private extractTagsFromName(fileName: string): string[] {
    // Extraire des tags basés sur le nom du fichier
    const tags: string[] = [];

    if (fileName.toLowerCase().includes("facture")) tags.push("facture");
    if (fileName.toLowerCase().includes("contrat")) tags.push("contrat");
    if (fileName.toLowerCase().includes("rapport")) tags.push("rapport");
    if (fileName.match(/\d{4}/)) tags.push("date"); // Contient une année

    return tags;
  }
}

// Export singleton
export const pdfService = new PdfService();
export default pdfService;
