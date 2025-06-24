import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PdfDocument {
  id: string;
  name: string;
  originalName?: string;
  size: number;
  uploadedAt: string;
  downloadUrl?: string;
  viewUrl?: string;
  url?: string; // ← Ajout de cette propriété
  type: string;
  mimeType: string;
  tags?: string[];
  description?: string;
}

export interface PdfStats {
  totalDocuments: number;
  totalSize: number;
  averageSize: number; // ← Ajout de cette propriété
  lastSync?: string;
  documentsThisWeek?: number;
  documentsThisMonth?: number;
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
  private readonly STORAGE_KEY = '@pdf_documents';
  private readonly SYNC_TIMESTAMP_KEY = '@pdf_last_sync';
  private readonly API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

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
      console.log('🔄 Démarrage de la synchronisation...');

      // 1. Récupérer les données locales
      const localDocuments = await this.getLocalDocuments();
      syncResult.localCount = localDocuments.length;

      // 2. Récupérer les données distantes
      const remoteDocuments = await this.fetchRemoteDocuments();
      syncResult.remoteCount = remoteDocuments.length;

      // 3. Synchroniser les données
      const { merged, stats } = this.mergeDocuments(localDocuments, remoteDocuments);

      syncResult.newDocuments = stats.newDocuments;
      syncResult.updatedDocuments = stats.updatedDocuments;
      syncResult.deletedDocuments = stats.deletedDocuments;

      // 4. Sauvegarder les données synchronisées
      await this.saveLocalDocuments(merged);
      await this.updateLastSyncTimestamp();

      syncResult.success = true;
      console.log('✅ Synchronisation terminée avec succès');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      syncResult.errors.push(errorMessage);
      console.error('❌ Erreur lors de la synchronisation:', error);
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
      console.error('Erreur lors de la récupération des documents:', error);
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
      doc =>
        doc.name.toLowerCase().includes(searchLower) ||
        doc.originalName?.toLowerCase().includes(searchLower) ||
        doc.description?.toLowerCase().includes(searchLower) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  /**
   * Récupérer un PDF par son ID
   */
  async getDocumentById(id: string): Promise<PdfDocument | null> {
    const documents = await this.getAllDocuments();
    return documents.find(doc => doc.id === id) || null;
  }

  /**
   * Ajouter/Uploader un nouveau PDF
   */
  async addDocument(file: File | any, customName?: string): Promise<PdfDocument> {
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
        type: 'pdf',
        mimeType: 'application/pdf',
        tags: this.extractTagsFromName(file.name),
      };

      // 3. Sauvegarder localement
      const documents = await this.getLocalDocuments();
      documents.push(newDocument);
      await this.saveLocalDocuments(documents);

      // 4. Essayer d'uploader vers l'API (optionnel, en arrière-plan)
      this.uploadToRemoteApi(file, newDocument).catch(error => {
        console.warn('Upload distant échoué (sera retenté lors de la sync):', error);
      });

      console.log('✅ Document ajouté:', newDocument.name);
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

      const filteredDocuments = documents.filter(doc => doc.id !== id);

      if (filteredDocuments.length === initialLength) {
        console.warn('Document non trouvé pour suppression:', id);
        return false;
      }

      await this.saveLocalDocuments(filteredDocuments);

      // Supprimer du serveur distant
      this.deleteFromRemoteApi(id).catch(error => {
        console.warn('Suppression distante échouée:', error);
      });

      console.log('✅ Document supprimé:', id);
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      return false;
    }
  }

  async getStats(): Promise<PdfStats> {
    try {
      console.log('📊 Calcul des statistiques...');

      const documents = await this.getLocalDocuments();
      const totalDocuments = documents.length;
      const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
      const averageSize = totalDocuments > 0 ? totalSize / totalDocuments : 0; // ← Calcul de la moyenne

      const lastSync = await AsyncStorage.getItem(this.SYNC_TIMESTAMP_KEY);

      // Calcul des documents de cette semaine
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const documentsThisWeek = documents.filter(doc => {
        const docDate = new Date(doc.uploadedAt);
        return docDate >= oneWeekAgo;
      }).length;

      // Calcul des documents de ce mois
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const documentsThisMonth = documents.filter(doc => {
        const docDate = new Date(doc.uploadedAt);
        return docDate >= oneMonthAgo;
      }).length;

      const stats: PdfStats = {
        totalDocuments,
        totalSize,
        averageSize, // ← Ajout de cette propriété
        lastSync: lastSync || undefined,
        documentsThisWeek,
        documentsThisMonth,
      };

      console.log('✅ Statistiques calculées:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Erreur calcul statistiques:', error);
      throw error;
    }
  }

  /**
   * Forcer une synchronisation complète
   */
  async forceSyncWithRemote(): Promise<SyncResult> {
    console.log('🔄 Synchronisation forcée...');
    return await this.syncWithRemoteApi();
  }

  /**
   * Vider le cache local
   */
  async clearLocalCache(): Promise<void> {
    await AsyncStorage.multiRemove([this.STORAGE_KEY, this.SYNC_TIMESTAMP_KEY]);
    console.log('🗑️ Cache local vidé');
  }

  // === MÉTHODES PRIVÉES ===

  private async getLocalDocuments(): Promise<PdfDocument[]> {
    try {
      const documentsString = await AsyncStorage.getItem(this.STORAGE_KEY);
      return documentsString ? JSON.parse(documentsString) : [];
    } catch (error) {
      console.error('Erreur lecture locale:', error);
      return [];
    }
  }

  private async saveLocalDocuments(documents: PdfDocument[]): Promise<void> {
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(documents));
  }
  private async fetchRemoteDocuments(): Promise<PdfDocument[]> {
    try {
      console.log('🔄 Fetching documents from backend...');

      // Utiliser GET sans body (standard navigateur) - le backend ajoutera le body pour le bucket
      const response = await fetch(`${this.API_BASE_URL}/student/upload/search`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          // TODO: Ajouter le token d'authentification si nécessaire
        },
        // Pas de body côté frontend - le backend s'occupe d'ajouter le body pour le bucket
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📥 Raw API response:', data);

      // Vérifier si la réponse indique un filtrage IP
      if (Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        if (firstItem.status === 'ip_filtered' || firstItem.type === 'info') {
          console.warn('🚫 Backend détecté comme filtré par IP:', firstItem.message);
          console.warn('💡 Solution suggérée:', firstItem.solution);

          // Retourner une liste vide mais logguer le problème
          // On pourrait aussi retourner un document d'information
          return [];
        }
      }

      console.log('🔍 Debug: Raw API response sample:', data.length > 0 ? data[0] : 'Empty array');

      // Transformer les données de l'API en format PdfDocument
      const documents: PdfDocument[] = data.map((item: any) => ({
        id: item.id.toString(),
        // Priorité : description -> tag3 -> originalName -> name -> fileName
        name: item.description || item.tag3 || item.originalName || item.name || item.fileName,
        originalName: item.originalName || item.name,
        size: item.size || 0,
        uploadedAt: item.uploadedAt,
        downloadUrl: item.downloadUrl,
        viewUrl: item.viewUrl,
        url: item.url,
        type: 'pdf',
        mimeType: item.mimeType || 'application/pdf',
        tags: item.tags || [],
        description: item.description,
      }));

      console.log(`✅ Successfully fetched ${documents.length} documents from remote`);
      return documents;
    } catch (error) {
      console.error('❌ Erreur récupération distante:', error);

      // Si l'erreur contient "403", c'est probablement du filtrage IP
      if (error instanceof Error && error.message.includes('403')) {
        console.warn('🚫 Erreur 403 détectée - probablement du filtrage IP sur le bucket externe');
        console.warn(
          "💡 Le backend ne peut pas accéder au bucket, mais l'app peut fonctionner en local"
        );

        // Ne pas faire échouer complètement, retourner une liste vide
        return [];
      }

      throw error;
    }
  }

  private mergeDocuments(local: PdfDocument[], remote: PdfDocument[]) {
    const merged: PdfDocument[] = [];
    const stats = { newDocuments: 0, updatedDocuments: 0, deletedDocuments: 0 };

    // Créer une map des documents locaux pour comparaison rapide
    const localMap = new Map(local.map(doc => [doc.id, doc]));

    // Traiter les documents distants
    remote.forEach(remoteDoc => {
      const localDoc = localMap.get(remoteDoc.id);

      if (!localDoc) {
        // Nouveau document
        merged.push(remoteDoc);
        stats.newDocuments++;
      } else if (new Date(remoteDoc.uploadedAt) > new Date(localDoc.uploadedAt)) {
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
    localMap.forEach(localDoc => {
      merged.push(localDoc);
    });

    return { merged, stats };
  }
  private async uploadToRemoteApi(file: File | any, document: PdfDocument): Promise<void> {
    // Utiliser l'endpoint student/upload pour uploader les fichiers
    const formData = new FormData();
    formData.append('file', file);
    formData.append('idExterne', document.id);
    formData.append('tag1', 'pdf');
    formData.append('tag2', 'generated');
    formData.append('tag3', document.name);

    const response = await fetch(`${this.API_BASE_URL}/student/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        // TODO: Ajouter le token d'authentification si nécessaire
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
  }
  private async deleteFromRemoteApi(id: string): Promise<void> {
    const response = await fetch(`${this.API_BASE_URL}/student/upload/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        // TODO: Ajouter le token d'authentification si nécessaire
      },
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
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
    await AsyncStorage.setItem(this.SYNC_TIMESTAMP_KEY, new Date().toISOString());
  }

  private validatePdfFile(file: any): void {
    if (!file) {
      throw new Error('Aucun fichier fourni');
    }

    if (file.size === 0) {
      throw new Error('Le fichier est vide');
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error('Le fichier est trop volumineux (max 50MB)');
    }

    const fileName = file.name?.toLowerCase() || '';
    if (!fileName.endsWith('.pdf')) {
      throw new Error('Le fichier doit être un PDF');
    }
  }

  private generateUniqueId(): string {
    return `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractFileName(originalName: string): string {
    return originalName.replace(/\.[^/.]+$/, '');
  }

  private extractTagsFromName(fileName: string): string[] {
    // Extraire des tags basés sur le nom du fichier
    const tags: string[] = [];

    if (fileName.toLowerCase().includes('facture')) tags.push('facture');
    if (fileName.toLowerCase().includes('contrat')) tags.push('contrat');
    if (fileName.toLowerCase().includes('rapport')) tags.push('rapport');
    if (fileName.match(/\d{4}/)) tags.push('date'); // Contient une année

    return tags;
  }
  /**
   * Uploader un fichier vers l'API student (réutilisation des routes existantes)
   */
  async uploadFileToAdmin(
    file: File | any,
    idExterne: string,
    tag1?: string,
    tag2?: string,
    tag3?: string,
    displayName?: string // Nouveau paramètre pour le nom d'affichage
  ): Promise<{
    idExterne: string;
    url: string;
    tag1: string;
    tag2: string;
    tag3: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('idExterne', idExterne);
      if (tag1) formData.append('tag1', tag1);
      if (tag2) formData.append('tag2', tag2);
      if (tag3) formData.append('tag3', tag3);

      // Ajouter le nom d'affichage comme description pour le bucket
      if (displayName) {
        formData.append('description', displayName);
      }

      const response = await fetch(`${this.API_BASE_URL}/student/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          // TODO: Ajouter le token d'authentification si nécessaire
        },
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error(
            `Fichier trop volumineux pour être uploadé. Taille maximale autorisée: 50MB`
          );
        }
        throw new Error(`Upload failed: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Fichier uploadé via student endpoint:', result);
      return result;
    } catch (error) {
      console.error('❌ Erreur upload student:', error);
      throw error;
    }
  }
}

// Export singleton
export const pdfService = new PdfService();
export default pdfService;
