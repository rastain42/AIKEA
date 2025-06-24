import React, { useCallback, useState } from 'react';
import { usePdfService } from '@/hooks/usePdfService';
import { PdfDocument } from '@/services/PdfService';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const PdfListScreen: React.FC = () => {
  // États locaux
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string } | null>(
    null
  );

  // Hook personnalisé
  const {
    documents,
    loading,
    error,
    refreshing,
    searchResults,
    loadDocuments,
    syncDocuments,
    deleteDocument,
    searchDocuments,
    clearError,
    refresh,
  } = usePdfService();

  /**
   * Gestion de la recherche
   */
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      await searchDocuments(query);
    },
    [searchDocuments]
  );

  /**
   * Ouvre un document PDF dans le navigateur
   */
  const handleView = useCallback(async (document: PdfDocument) => {
    try {
      console.log('👁️ Visualisation de:', document.name);

      const viewUrl = document.viewUrl || document.downloadUrl || document.url;
      if (!viewUrl) {
        Alert.alert('Erreur', 'URL de visualisation non disponible pour ce document', [
          { text: 'OK' },
        ]);
        return;
      }

      const supported = await Linking.canOpenURL(viewUrl);

      if (supported) {
        await Linking.openURL(viewUrl);
        console.log('✅ Document ouvert dans le navigateur');
      } else {
        Alert.alert('Erreur', "Impossible d'ouvrir ce document", [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('❌ Erreur visualisation:', error);
      Alert.alert("Erreur d'ouverture", "Impossible d'ouvrir le document", [{ text: 'OK' }]);
    }
  }, []); /**
   * Gestion de la suppression avec confirmation
   */
  const handleDelete = useCallback(async (documentId: string, documentName: string) => {
    console.log('🔄 handleDelete appelée avec:', { documentId, documentName });

    // Ouvrir la modal de confirmation au lieu d'Alert
    setDocumentToDelete({ id: documentId, name: documentName });
    setDeleteModalVisible(true);
  }, []);

  /**
   * Confirmer la suppression
   */
  const confirmDelete = useCallback(async () => {
    if (!documentToDelete) return;

    console.log('✅ Utilisateur a confirmé la suppression');
    console.log('🗑️ Début de la suppression de:', documentToDelete.name);

    try {
      console.log('📞 Appel de deleteDocument avec ID:', documentToDelete.id);
      const success = await deleteDocument(documentToDelete.id);
      console.log('📋 Résultat de deleteDocument:', success);

      if (success) {
        console.log('✅ Document supprimé avec succès côté composant');
        Alert.alert('Suppression réussie', `"${documentToDelete.name}" a été supprimé.`, [
          { text: 'OK' },
        ]);
      } else {
        console.log('❌ Échec de la suppression côté hook');
        throw new Error('La suppression a échoué');
      }
    } catch (error) {
      console.error('❌ Erreur dans la suppression:', error);
      Alert.alert(
        'Erreur de suppression',
        error instanceof Error ? error.message : 'Impossible de supprimer le document',
        [{ text: 'OK' }]
      );
    } finally {
      setDeleteModalVisible(false);
      setDocumentToDelete(null);
    }
  }, [documentToDelete, deleteDocument]);

  /**
   * Annuler la suppression
   */
  const cancelDelete = useCallback(() => {
    console.log("❌ Suppression annulée par l'utilisateur");
    setDeleteModalVisible(false);
    setDocumentToDelete(null);
  }, []);

  /**
   * Formate la taille des fichiers
   */
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);


  /**
   * Rendu d'un élément de la liste
   */
  const renderDocument = useCallback(
    ({ item }: { item: PdfDocument }) => {
      const isSelected = selectedDocument === item.id;

      return (
        <TouchableOpacity
          style={[styles.documentItem, isSelected && styles.documentItemSelected]}
          onPress={() => setSelectedDocument(isSelected ? null : item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.documentHeader}>
            <View style={styles.documentIcon}>
              <Ionicons name="home" size={24} color="#0051BA" />
            </View>
            <View style={styles.documentInfo}>
              <Text style={styles.documentName} numberOfLines={2}>
                {item.originalName || item.name || 'Design sans nom'}
              </Text>
              {/* Tags pour le design d'intérieur */}
              {item.tags && item.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {item.tags.slice(0, 3).map((tag, index) => {
                    // Déterminer le texte et le style du tag selon son type
                    let displayText = tag;
                    let isSpecialTag = false;

                    if (tag === 'design-interieur') {
                      displayText = '🎨 Design';
                      isSpecialTag = true;
                    } else if (tag === 'generated') {
                      displayText = '🏠 Créé';
                      isSpecialTag = true;
                    } else if (['low', 'medium', 'high'].includes(tag.toLowerCase())) {
                      displayText =
                        tag === 'low'
                          ? '📱 Standard'
                          : tag === 'medium'
                            ? '💻 HD'
                            : tag === 'high'
                              ? '🖥️ Ultra HD'
                              : tag;
                      isSpecialTag = true;
                    }

                    return (
                      <View key={index} style={[styles.tag, isSpecialTag && styles.specialTag]}>
                        <Text style={[styles.tagText, isSpecialTag && styles.specialTagText]}>
                          {displayText}
                        </Text>
                      </View>
                    );
                  })}
                  {item.tags.length > 3 && (
                    <Text style={styles.moreTagsText}>+{item.tags.length - 3}</Text>
                  )}
                </View>
              )}
              {/* Description du design */}
              {item.description && (
                <Text style={styles.documentDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setSelectedDocument(isSelected ? null : item.id)}
            >
              <Ionicons name={isSelected ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Actions (affichées quand sélectionné) */}
          {isSelected && (
            <View style={styles.documentActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.viewButton]}
                onPress={() => {
                  console.log('👁️ Bouton Voir design cliqué pour:', item.name);
                  handleView(item);
                }}
              >
                <Ionicons name="eye" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Voir Design</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => {
                  console.log('🗑️ Bouton Supprimer design cliqué pour:', item.name, 'ID:', item.id);
                  handleDelete(item.id, item.name || item.originalName || 'Design');
                }}
              >
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedDocument, formatFileSize, handleView, handleDelete]
  );

  /**
   * Rendu du composant vide
   */
  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="home-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>
          {searchQuery ? 'Aucun design trouvé pour votre recherche' : 'Aucun design disponible'}
        </Text>
        {!searchQuery && (
          <TouchableOpacity style={styles.syncButton} onPress={() => loadDocuments(true)}>
            <Text style={styles.syncButtonText}>Synchroniser</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
    [searchQuery, loadDocuments]
  );

  // Affichage du loading principal
  if (loading && documents.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Chargement de vos designs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Titre de la section */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>🏠 Mes Créations AIKEA</Text>
        <Text style={styles.headerSubtitle}>Gérez vos designs d'intérieur</Text>
      </View>
      {/* Barre de recherche et actions */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />{' '}
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un design..."
            value={searchQuery}
            onChangeText={handleSearch}
            clearButtonMode="while-editing"
          />
        </View>

        <TouchableOpacity style={styles.syncIconButton} onPress={syncDocuments} disabled={loading}>
          <Ionicons name="sync" size={20} color="#3498db" />
        </TouchableOpacity>
      </View>
      {/* Aide rapide */}
      <View style={styles.helpContainer}>
        <Ionicons name="information-circle" size={16} color="#3498db" />{' '}
        <Text style={styles.helpText}>
          Synchronisez vos designs, développez un document pour le visualiser ou le supprimer. Créez
          de nouveaux designs depuis l&apos;onglet principal.
        </Text>
      </View>
      {/* Message d'erreur */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Text style={styles.dismissError}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}{' '}
      {/* Liste des documents */}
      <FlatList
        data={searchResults}
        keyExtractor={item => item.id}
        renderItem={renderDocument}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
      />
      {/* Modal de confirmation de suppression */}
      <Modal
        transparent={true}
        visible={deleteModalVisible}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color="#e74c3c" />
              <Text style={styles.modalTitle}>Confirmer la suppression</Text>
            </View>

            <Text style={styles.modalMessage}>
              Êtes-vous sûr de vouloir supprimer &quot{documentToDelete?.name}&quot ?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmDelete}
              >
                <Text style={styles.confirmButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  syncIconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0f8ff',
  },
  addButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e8f5e8',
    marginRight: 8,
  },
  helpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f8ff',
    marginHorizontal: 16,
    marginVertical: 20,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    color: '#2c3e50',
    marginLeft: 8,
    lineHeight: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fee',
    borderBottomWidth: 1,
    borderBottomColor: '#f5c6cb',
  },
  errorText: {
    flex: 1,
    color: '#721c24',
    fontSize: 14,
  },
  dismissError: {
    color: '#721c24',
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  listContainer: {
    flexGrow: 1,
  },
  statsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  documentItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  documentItemSelected: {
    borderColor: '#3498db',
    borderWidth: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  documentIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  documentMeta: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  documentSize: {
    fontSize: 12,
    color: '#666',
    marginRight: 16,
  },
  documentDate: {
    fontSize: 12,
    color: '#666',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#1976d2',
    fontWeight: '500',
  }, // Styles spécifiques pour les tags AIKEA
  specialTag: {
    backgroundColor: '#fff3cd', // Jaune IKEA clair
    borderColor: '#FFDB00',
    borderWidth: 1,
  },
  specialTagText: {
    color: '#856404',
    fontWeight: '600' as const,
  },
  moreTagsText: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic' as const,
  },
  imagePreviewContainer: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e8f5e8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  imagePreviewText: {
    fontSize: 10,
    color: '#28a745',
    fontWeight: '500' as const,
  },
  documentDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    lineHeight: 16,
  },
  expandButton: {
    padding: 4,
  },
  documentActions: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
    justifyContent: 'space-evenly',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  viewButton: {
    backgroundColor: '#3498db',
  },
  downloadButton: {
    backgroundColor: '#27ae60',
  },
  shareButton: {
    backgroundColor: '#f39c12',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  syncButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Styles pour la modal de confirmation
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#e74c3c',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#0051BA', // Bleu IKEA
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center' as const,
  },
});

export default PdfListScreen;
