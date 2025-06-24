import { useAuth } from '@/context/AuthProvider';
import { usePdfService } from '@/hooks/usePdfService';
import { PdfDocument } from '@/services/PdfService';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function AdminScreen() {
    const { isAuthenticated, logout } = useAuth();
    const {
        documents,
        loading,
        syncing,
        error,
        syncDocuments,
        deleteDocument,
        searchDocuments,
        addDocument,
        getStats,
        loadDocuments
    } = usePdfService();

    const [searchText, setSearchText] = useState('');
    const [filteredDocuments, setFilteredDocuments] = useState<PdfDocument[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        // Attendre un peu pour s'assurer que le routeur est prêt
        const timer = setTimeout(() => {
            if (!isAuthenticated) {
                router.replace('/login');
            } else {
                loadStats();
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [isAuthenticated]);

    useEffect(() => {
        // Filtrer les documents quand la recherche change
        handleSearch();
    }, [searchText, documents]);

    const loadStats = async () => {
        try {
            const statsData = await getStats();
            setStats(statsData);
        } catch (err) {
            console.error('Erreur stats:', err);
        }
    };

    const handleSearch = async () => {
        if (!searchText.trim()) {
            setFilteredDocuments(documents);
            return;
        }

        try {
            const results = await searchDocuments(searchText);
            setFilteredDocuments(results);
        } catch (err) {
            console.error('Erreur de recherche:', err);
            setFilteredDocuments([]);
        }
    };

    const handleSync = async () => {
        try {
            const result = await syncDocuments();
            if (result?.success) {
                Alert.alert(
                    'Synchronisation réussie',
                    `📄 ${result.newDocuments} nouveaux documents\n` +
                    `🔄 ${result.updatedDocuments} mis à jour\n` +
                    `🗑️ ${result.deletedDocuments} supprimés`
                );
                await loadStats();
            } else if (result?.errors.length) {
                Alert.alert('Erreurs de sync', result.errors.join('\n'));
            }
        } catch (err) {
            Alert.alert('Erreur', 'Impossible de synchroniser');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        Alert.alert(
            "Confirmation",
            `Supprimer le document "${name}" ?`,
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: async () => {
                        const success = await deleteDocument(id);
                        if (success) {
                            Alert.alert('Succès', 'Document supprimé');
                            await loadStats();
                        } else {
                            Alert.alert('Erreur', 'Impossible de supprimer le document');
                        }
                    }
                }
            ]
        );
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadDocuments(true); // Force sync
            await loadStats();
        } finally {
            setRefreshing(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
            Alert.alert('Erreur', 'Impossible de se déconnecter');
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Gestionnaire PDF</Text>

            {/* Stats Section */}
            {stats && (
                <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>
                        📄 {stats.totalPdfs} documents • 💾 {stats.totalSizeMB} MB
                    </Text>
                    {stats.lastSync && (
                        <Text style={styles.lastSync}>
                            Dernière sync: {formatDate(stats.lastSync)}
                        </Text>
                    )}
                </View>
            )}

            {/* Error Display */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>❌ {error}</Text>
                </View>
            )}

            {/* Header avec recherche et actions */}
            <View style={styles.header}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher des PDF..."
                    value={searchText}
                    onChangeText={setSearchText}
                    editable={!loading && !syncing}
                />

                <TouchableOpacity
                    style={[styles.syncButton, syncing && styles.buttonDisabled]}
                    onPress={handleSync}
                    disabled={syncing}
                >
                    {syncing ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text style={styles.buttonText}>🔄 Sync</Text>
                    )}
                </TouchableOpacity>


                {/* BOUTON GÉNÉRER AJOUTÉ */}
                <TouchableOpacity
                    style={styles.generateButton}
                    onPress={() => router.push('/generate')}
                >
                    <Text style={styles.buttonText}>✨ Générer</Text>
                </TouchableOpacity>
            </View>

            {/* Liste des documents */}
            {loading && documents.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2ecc71" />
                    <Text style={styles.loadingText}>Chargement des documents...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredDocuments}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#2ecc71']}
                        />
                    }
                    renderItem={({ item }) => (
                        <View style={styles.documentItem}>
                            <View style={styles.documentIcon}>
                                <Text style={styles.iconText}>📄</Text>
                            </View>

                            <View style={styles.documentDetails}>
                                <Text style={styles.documentName} numberOfLines={2}>
                                    {item.name}
                                </Text>

                                <Text style={styles.documentInfo}>
                                    📅 {formatDate(item.uploadedAt)}
                                </Text>

                                <Text style={styles.documentInfo}>
                                    💾 {formatFileSize(item.size)}
                                </Text>

                                {item.tags && item.tags.length > 0 && (
                                    <View style={styles.tagsContainer}>
                                        {item.tags.map((tag, index) => (
                                            <Text key={index} style={styles.tag}>
                                                #{tag}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => handleDelete(item.id, item.name)}
                            >
                                <Text style={styles.deleteButtonText}>🗑️</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {searchText ?
                                    `Aucun document trouvé pour "${searchText}"` :
                                    'Aucun document PDF disponible'
                                }
                            </Text>
                            {!searchText && (
                                <TouchableOpacity
                                    style={styles.syncButton}
                                    onPress={handleSync}
                                    disabled={syncing}
                                >
                                    <Text style={styles.buttonText}>
                                        {syncing ? 'Synchronisation...' : '🔄 Synchroniser'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                />
            )}

            {/* Footer Actions */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Text style={styles.buttonText}>🚪 Déconnexion</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f8f9fa',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#2c3e50',
        textAlign: 'center',
    },
    statsContainer: {
        backgroundColor: '#e8f5e8',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    statsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#27ae60',
        textAlign: 'center',
    },
    lastSync: {
        fontSize: 12,
        color: '#7f8c8d',
        textAlign: 'center',
        marginTop: 4,
    },
    errorContainer: {
        backgroundColor: '#ffe6e6',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: '#e74c3c',
        fontSize: 14,
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 12,
        backgroundColor: 'white',
        fontSize: 16,
    },
    syncButton: {
        backgroundColor: '#3498db',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        justifyContent: 'center',
        minWidth: 80,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
        textAlign: 'center',
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: '#7f8c8d',
    },
    documentItem: {
        flexDirection: 'row',
        padding: 12,
        marginBottom: 8,
        backgroundColor: 'white',
        borderRadius: 8,
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
        } : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        }),
        alignItems: 'center',
    },
    documentIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e8f5e8',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconText: {
        fontSize: 20,
    },
    documentDetails: {
        flex: 1,
        gap: 2,
    },
    documentName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 4,
    },
    documentInfo: {
        fontSize: 12,
        color: '#7f8c8d',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    tag: {
        fontSize: 10,
        color: '#3498db',
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    deleteButton: {
        backgroundColor: '#e74c3c',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    deleteButtonText: {
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        gap: 16,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 16,
    },
    footer: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    logoutButton: {
        backgroundColor: '#e74c3c',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    generateButton: {
        backgroundColor: '#9b59b6',  // Violet pour se distinguer
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 8,
        justifyContent: 'center',
        minWidth: 80,
    },

    footerActions: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
    },

    // Si vous préférez des boutons pleine largeur
    footerButton: {
        flex: 1,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
});
