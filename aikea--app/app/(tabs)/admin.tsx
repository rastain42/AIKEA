import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Alert,
    Text,
    View,
    ActivityIndicator,
    RefreshControl,
    Linking,
    Share,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePdfService } from '@/hooks/usePdfService';
import { PdfDocument } from '@/services/PdfService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const PdfListScreen: React.FC = () => {
    // États locaux
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

    // Hook personnalisé
    const {
        documents,
        loading,
        error,
        refreshing,
        searchResults,
        stats,
        loadDocuments,
        syncDocuments,
        deleteDocument,
        searchDocuments,
        addDocument,
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
     * Télécharge un document PDF
     */
    const handleDownload = useCallback(async (document: PdfDocument) => {
        try {
            console.log('📥 Téléchargement de:', document.name);

            if (!document.downloadUrl && !document.url) {
                Alert.alert(
                    'Erreur',
                    'URL de téléchargement non disponible pour ce document',
                    [{ text: 'OK' }]
                );
                return;
            }

            const downloadUrl = document.downloadUrl || document.url!;
            const fileName = `${document.name}.pdf`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            // Afficher un indicateur de téléchargement
            Alert.alert(
                'Téléchargement',
                `Téléchargement de "${document.name}" en cours...`,
                [{ text: 'OK' }]
            );

            console.log('📥 Début du téléchargement:', { downloadUrl, fileUri });

            const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);

            if (downloadResult.status === 200) {
                console.log('✅ Téléchargement réussi:', downloadResult.uri);

                // Partager le fichier téléchargé
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(downloadResult.uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `Partager ${document.name}`,
                        UTI: 'com.adobe.pdf',
                    });
                } else {
                    Alert.alert(
                        'Téléchargement terminé',
                        `"${document.name}" a été téléchargé avec succès!\nEmplacement: ${downloadResult.uri}`,
                        [{ text: 'OK' }]
                    );
                }
            } else {
                throw new Error(`Échec du téléchargement: ${downloadResult.status}`);
            }
        } catch (error) {
            console.error('❌ Erreur téléchargement:', error);
            Alert.alert(
                'Erreur de téléchargement',
                error instanceof Error ? error.message : 'Impossible de télécharger le document',
                [{ text: 'OK' }]
            );
        }
    }, []);

    /**
     * Ouvre un document PDF dans le navigateur
     */
    const handleView = useCallback(async (document: PdfDocument) => {
        try {
            console.log('👁️ Visualisation de:', document.name);

            const viewUrl = document.viewUrl || document.downloadUrl || document.url;
            if (!viewUrl) {
                Alert.alert(
                    'Erreur',
                    'URL de visualisation non disponible pour ce document',
                    [{ text: 'OK' }]
                );
                return;
            }

            const supported = await Linking.canOpenURL(viewUrl);

            if (supported) {
                await Linking.openURL(viewUrl);
                console.log('✅ Document ouvert dans le navigateur');
            } else {
                Alert.alert(
                    'Erreur',
                    'Impossible d\'ouvrir ce document',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('❌ Erreur visualisation:', error);
            Alert.alert(
                'Erreur d\'ouverture',
                'Impossible d\'ouvrir le document',
                [{ text: 'OK' }]
            );
        }
    }, []);

    /**
     * Partage un document
     */
    const handleShare = useCallback(async (document: PdfDocument) => {
        try {
            const shareUrl = document.downloadUrl || document.viewUrl || document.url;
            if (!shareUrl) {
                Alert.alert('Erreur', 'Impossible de partager ce document');
                return;
            }

            await Share.share({
                message: `Consultez ce document: ${document.name}`,
                url: shareUrl,
                title: document.name,
            });
        } catch (error) {
            console.error('❌ Erreur partage:', error);
        }
    }, []);

    /**
     * Gestion de la suppression
     */
    const handleDelete = useCallback(
        async (documentId: string) => {
            const success = await deleteDocument(documentId);
            if (success) {
                console.log('✅ Document supprimé avec succès');
            }
        },
        [deleteDocument]
    );

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
     * Formate la date
     */
    const formatDate = useCallback((dateString: string): string => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return 'Date invalide';
        }
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
                            <Ionicons name="document-text" size={24} color="#e74c3c" />
                        </View>

                        <View style={styles.documentInfo}>
                            <Text style={styles.documentName} numberOfLines={2}>
                                {item.name || item.originalName || 'Document sans nom'}
                            </Text>

                            <View style={styles.documentMeta}>
                                <Text style={styles.documentSize}>
                                    📄 {formatFileSize(item.size)}
                                </Text>
                                <Text style={styles.documentDate}>
                                    🕒 {formatDate(item.uploadedAt)}
                                </Text>
                            </View>

                            {/* Tags */}
                            {item.tags && item.tags.length > 0 && (
                                <View style={styles.tagsContainer}>
                                    {item.tags.slice(0, 3).map((tag, index) => (
                                        <View key={index} style={styles.tag}>
                                            <Text style={styles.tagText}>{tag}</Text>
                                        </View>
                                    ))}
                                    {item.tags.length > 3 && (
                                        <Text style={styles.moreTagsText}>+{item.tags.length - 3}</Text>
                                    )}
                                </View>
                            )}

                            {/* Description */}
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
                            <Ionicons
                                name={isSelected ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#666"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Actions (affichées quand sélectionné) */}
                    {isSelected && (
                        <View style={styles.documentActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.viewButton]}
                                onPress={() => handleView(item)}
                            >
                                <Ionicons name="eye" size={16} color="#fff" />
                                <Text style={styles.actionButtonText}>Voir</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.downloadButton]}
                                onPress={() => handleDownload(item)}
                            >
                                <Ionicons name="download" size={16} color="#fff" />
                                <Text style={styles.actionButtonText}>Télécharger</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.shareButton]}
                                onPress={() => handleShare(item)}
                            >
                                <Ionicons name="share" size={16} color="#fff" />
                                <Text style={styles.actionButtonText}>Partager</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.deleteButton]}
                                onPress={() => handleDelete(item.id)}
                            >
                                <Ionicons name="trash" size={16} color="#fff" />
                                <Text style={styles.actionButtonText}>Supprimer</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </TouchableOpacity>
            );
        },
        [selectedDocument, formatFileSize, formatDate, handleView, handleDownload, handleShare, handleDelete]
    );

    /**
     * Rendu du header avec statistiques
     */
    const renderHeader = useCallback(() => {
        if (!stats) return null;

        return (
            <View style={styles.statsContainer}>
                <Text style={styles.statsTitle}>📊 Statistiques</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{stats.totalDocuments}</Text>
                        <Text style={styles.statLabel}>Documents</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{formatFileSize(stats.totalSize)}</Text>
                        <Text style={styles.statLabel}>Taille totale</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{formatFileSize(stats.averageSize)}</Text>
                        <Text style={styles.statLabel}>Taille moyenne</Text>
                    </View>
                </View>
            </View>
        );
    }, [stats, formatFileSize]);

    /**
     * Rendu du composant vide
     */
    const renderEmpty = useCallback(() => (
        <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
                {searchQuery ? 'Aucun document trouvé pour votre recherche' : 'Aucun document disponible'}
            </Text>
            {!searchQuery && (
                <TouchableOpacity style={styles.syncButton} onPress={() => loadDocuments(true)}>
                    <Text style={styles.syncButtonText}>Synchroniser</Text>
                </TouchableOpacity>
            )}
        </View>
    ), [searchQuery, loadDocuments]);

    // Affichage du loading principal
    if (loading && documents.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Chargement des documents...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>            {/* Barre de recherche et actions */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher un document..."
                        value={searchQuery}
                        onChangeText={handleSearch}
                        clearButtonMode="while-editing"
                    />
                </View>                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push('/generate')}
                >
                    <Ionicons name="add-circle" size={20} color="#27ae60" />
                </TouchableOpacity>                <TouchableOpacity
                    style={styles.syncIconButton}
                    onPress={syncDocuments}
                    disabled={loading}
                >
                    <Ionicons name="sync" size={20} color="#3498db" />
                </TouchableOpacity>
            </View>

            {/* Aide rapide */}
            <View style={styles.helpContainer}>
                <Ionicons name="information-circle" size={16} color="#3498db" />
                <Text style={styles.helpText}>
                    Cliquez sur + pour générer un nouveau PDF, sur sync pour synchroniser, ou développez un document pour plus d'actions
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
            )}

            {/* Liste des documents */}
            <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderDocument}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={refresh} />
                }
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={10}
                removeClippedSubviews={Platform.OS === 'android'}
            />
        </View>
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
    }, syncIconButton: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f0f8ff',
    }, addButton: {
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
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#f0f8ff',
        marginHorizontal: 16,
        marginTop: 8,
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
    },
    moreTagsText: {
        fontSize: 10,
        color: '#666',
        fontStyle: 'italic',
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
        justifyContent: 'space-around',
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
});

export default PdfListScreen;
