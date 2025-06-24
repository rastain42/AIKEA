import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { pdfService, PdfDocument, SyncResult, PdfStats } from '@/services/PdfService';

export interface UsePdfServiceReturn {
  // État
  documents: PdfDocument[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  searchResults: PdfDocument[];
  stats: PdfStats | null;

  // Actions
  loadDocuments: (forceSync?: boolean) => Promise<void>;
  syncDocuments: () => Promise<SyncResult | null>;
  deleteDocument: (id: string) => Promise<boolean>;
  searchDocuments: (query: string) => Promise<void>;
  addDocument: (file: any) => Promise<PdfDocument | null>;
  getStats: () => Promise<void>;
  clearError: () => void;
  refresh: () => Promise<void>;
}

export const usePdfService = (): UsePdfServiceReturn => {
  // États
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<PdfDocument[]>([]);
  const [stats, setStats] = useState<PdfStats | null>(null);

  /**
   * Charge les documents
   */
  const loadDocuments = useCallback(async (forceSync = false) => {
    try {
      console.log('🔄 Hook: Chargement des documents...', { forceSync });
      setLoading(true);
      setError(null);

      const docs = await pdfService.getAllDocuments(forceSync);

      console.log('✅ Hook: Documents récupérés:', docs.length);
      setDocuments(docs);
      setSearchResults(docs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du chargement';
      console.error('❌ Hook: Erreur chargement:', err);
      setError(errorMessage);

      // Afficher une alerte pour informer l'utilisateur
      Alert.alert('Erreur de chargement', errorMessage, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Synchronise les documents avec le serveur
   */
  const syncDocuments = useCallback(async (): Promise<SyncResult | null> => {
    try {
      console.log('🔄 Hook: Synchronisation...');
      setError(null);

      const result = await pdfService.forceSyncWithRemote();

      if (result.success) {
        console.log('✅ Hook: Sync réussie:', result);
        // Recharger les documents après la sync
        await loadDocuments(false);

        // Afficher un message de succès
        Alert.alert(
          'Synchronisation réussie',
          `${result.newDocuments} nouveaux documents, ${result.updatedDocuments} mis à jour`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(result.errors.join(', ') || 'Erreur de synchronisation');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de synchronisation';
      console.error('❌ Hook: Erreur sync:', err);
      setError(errorMessage);

      Alert.alert('Erreur de synchronisation', errorMessage, [{ text: 'OK' }]);

      return null;
    }
  }, [loadDocuments]);
  /**
   * Supprime un document
   */
  const deleteDocument = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        console.log('🗑️ Hook: Suppression document:', id);
        setError(null);

        const documentToDelete = documents.find(doc => doc.id === id);
        if (!documentToDelete) {
          throw new Error('Document non trouvé');
        }

        // Appeler directement le service sans confirmation (la confirmation est gérée dans le composant)
        const success = await pdfService.deleteDocument(id);
        if (success) {
          console.log('✅ Hook: Document supprimé avec succès');

          // Mettre à jour l'état local immédiatement
          setDocuments(prev => prev.filter(doc => doc.id !== id));
          setSearchResults(prev => prev.filter(doc => doc.id !== id));

          // Les statistiques seront automatiquement mises à jour par l'effet qui surveille documents.length

          return true;
        } else {
          throw new Error('Échec de la suppression');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur lors de la suppression';
        console.error('❌ Hook: Erreur suppression:', error);
        setError(errorMessage);
        return false;
      }
    },
    [documents]
  );

  /**
   * Recherche dans les documents
   */
  const searchDocuments = useCallback(
    async (query: string) => {
      try {
        console.log('🔍 Hook: Recherche:', query);
        setError(null);

        if (!query.trim()) {
          setSearchResults(documents);
          return;
        }

        const results = await pdfService.searchDocuments(query);
        console.log('✅ Hook: Résultats trouvés:', results.length);
        setSearchResults(results);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la recherche';
        console.error('❌ Hook: Erreur recherche:', err);
        setError(errorMessage);
        setSearchResults([]);
      }
    },
    [documents]
  );

  /**
   * Ajoute un nouveau document
   */
  const addDocument = useCallback(async (file: any): Promise<PdfDocument | null> => {
    try {
      console.log('📄 Hook: Ajout document:', file?.name);
      setError(null);
      setLoading(true);

      const newDocument = await pdfService.addDocument(file);
      console.log('✅ Hook: Document ajouté:', newDocument.name);

      // Mettre à jour l'état local
      setDocuments(prev => [newDocument, ...prev]);
      setSearchResults(prev => [newDocument, ...prev]);

      // Afficher un message de succès
      Alert.alert('Document ajouté', `"${newDocument.name}" a été ajouté avec succès`, [
        { text: 'OK' },
      ]);

      return newDocument;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'ajout";
      console.error('❌ Hook: Erreur ajout:', err);
      setError(errorMessage);

      Alert.alert("Erreur d'ajout", errorMessage, [{ text: 'OK' }]);

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Récupère les statistiques
   */
  const getStats = useCallback(async () => {
    try {
      console.log('📊 Hook: Récupération des stats...');
      setError(null);

      const statistics = await pdfService.getStats();
      console.log('✅ Hook: Stats récupérées:', statistics);
      setStats(statistics);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors de la récupération des statistiques';
      console.error('❌ Hook: Erreur stats:', err);
      setError(errorMessage);
    }
  }, []);

  /**
   * Actualise les données (pull-to-refresh)
   */
  const refresh = useCallback(async () => {
    try {
      console.log('🔄 Hook: Actualisation...');
      setRefreshing(true);
      setError(null);

      await loadDocuments(true); // Force la synchronisation
      await getStats(); // Met à jour les stats

      console.log('✅ Hook: Actualisation terminée');
    } catch (err) {
      console.error('❌ Hook: Erreur actualisation:', err);
    } finally {
      setRefreshing(false);
    }
  }, [loadDocuments, getStats]);

  /**
   * Efface l'erreur
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Charge les documents au montage du composant
   */
  useEffect(() => {
    console.log('🚀 Hook: Initialisation usePdfService');
    loadDocuments();
  }, [loadDocuments]);

  /**
   * Met à jour les statistiques quand les documents changent
   */
  useEffect(() => {
    if (documents.length > 0) {
      getStats();
    }
  }, [documents.length, getStats]);

  return {
    // État
    documents,
    loading,
    error,
    refreshing,
    searchResults,
    stats,

    // Actions
    loadDocuments,
    syncDocuments,
    deleteDocument,
    searchDocuments,
    addDocument,
    getStats,
    clearError,
    refresh,
  };
};

export default usePdfService;
