import { useEffect, useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, TextInput, Image, Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthProvider';

interface GeneratedImage {
    id: string;
    prompt: string;
    quality: string;
    image: string; // Base64 encoded image
    createdAt: string;
}

export default function AdminScreen() {
    const { isAuthenticated, logout } = useAuth();
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace('/login');
            return;
        }

        loadImages();
    }, [isAuthenticated]);

    const loadImages = async () => {
        try {
            setLoading(true);
            // Charger les données locales
            const localImagesString = await AsyncStorage.getItem('@generated_images');
            const localImages = localImagesString ? JSON.parse(localImagesString) : [];

            // On pourrait aussi synchroniser avec des données distantes ici
            // const remoteImages = await fetchRemoteImages();
            // const mergedImages = [...localImages, ...remoteImages.filter(img => !localImages.find(local => local.id === img.id))];

            setImages(localImages);
        } catch (error) {
            console.error('Erreur lors du chargement des images', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteImage = async (id: string) => {
        Alert.alert(
            "Confirmation",
            "Êtes-vous sûr de vouloir supprimer cette image ?",
            [
                { text: "Annuler" },
                {
                    text: "Supprimer",
                    onPress: async () => {
                        try {
                            const updatedImages = images.filter(img => img.id !== id);
                            setImages(updatedImages);
                            await AsyncStorage.setItem('@generated_images', JSON.stringify(updatedImages));

                            // Ici, vous pouvez également supprimer l'image du serveur distant
                        } catch (error) {
                            console.error('Erreur lors de la suppression de l\'image', error);
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = async () => {
        await logout();
        router.replace('/');
    };

    const filteredImages = images.filter(img =>
        img.prompt.toLowerCase().includes(searchText.toLowerCase())
    );

    if (!isAuthenticated) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Administration des Images</Text>

            <View style={styles.header}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher par prompt..."
                    value={searchText}
                    onChangeText={setSearchText}
                />

                <TouchableOpacity
                    style={styles.generateButton}
                    onPress={() => router.push('/generate')}
                >
                    <Text style={styles.buttonText}>Générer</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <Text>Chargement...</Text>
            ) : (
                <FlatList
                    data={filteredImages}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.imageItem}>
                            <Image
                                source={{ uri: `data:image/png;base64,${item.image}` }}
                                style={styles.thumbnail}
                            />
                            <View style={styles.imageDetails}>
                                <Text style={styles.promptText} numberOfLines={2}>{item.prompt}</Text>
                                <Text>Qualité: {item.quality}</Text>
                                <Text>Créé le: {new Date(item.createdAt).toLocaleDateString()}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => deleteImage(item.id)}
                            >
                                <Text style={styles.deleteButtonText}>Supprimer</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    ListEmptyComponent={() => (
                        <Text style={styles.emptyText}>Aucune image générée</Text>
                    )}
                />
            )}

            <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
            >
                <Text style={styles.buttonText}>Déconnexion</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        paddingHorizontal: 10,
        marginRight: 10,
    },
    generateButton: {
        backgroundColor: '#2ecc71',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 5,
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    imageItem: {
        flexDirection: 'row',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 5,
        marginRight: 10,
    },
    imageDetails: {
        flex: 1,
    },
    promptText: {
        fontWeight: 'bold',
        marginBottom: 5,
    },
    deleteButton: {
        backgroundColor: '#e74c3c',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 5,
    },
    deleteButtonText: {
        color: 'white',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#777',
    },
    logoutButton: {
        backgroundColor: '#e74c3c',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
        marginTop: 20,
    },
});
