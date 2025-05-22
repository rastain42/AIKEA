import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { v4 as uuidv4 } from 'uuid';

export default function GenerateScreen() {
    const [prompt, setPrompt] = useState('');
    const [quality, setQuality] = useState('Low');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const generateImage = async () => {

        if (!prompt.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir un prompt');
            return;
        }

        setLoading(true);
        try {

            // Appel à l'API pour générer l'image
            const response = await fetch('http://localhost:8080/generate-image/justImage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt,
                    quality,
                }),
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la génération de l\'image');
            }

            // Convertir l'image en base64
            const blob = await response.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);

            reader.onloadend = async () => {
                const base64data = reader.result?.toString().split(',')[1] || '';
                setGeneratedImage(base64data);
            };
        } catch (error) {
            console.error('Erreur:', error);
            Alert.alert('Erreur', 'Impossible de générer l\'image');
        } finally {
            setLoading(false);
        }
    };

    const saveGeneratedImage = async () => {
        if (!generatedImage) {
            Alert.alert('Erreur', 'Aucune image générée');
            return;
        }

        try {
            // Récupérer les images existantes
            const existingImagesStr = await AsyncStorage.getItem('@generated_images');
            const existingImages = existingImagesStr ? JSON.parse(existingImagesStr) : [];

            // Créer l'objet pour la nouvelle image
            const newImage = {
                id: uuidv4(),
                prompt,
                quality,
                image: generatedImage,
                createdAt: new Date().toISOString(),
            };

            // Ajouter la nouvelle image et enregistrer
            const updatedImages = [newImage, ...existingImages];
            await AsyncStorage.setItem('@generated_images', JSON.stringify(updatedImages));

            Alert.alert('Succès', 'Image sauvegardée avec succès', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement:', error);
            Alert.alert('Erreur', 'Impossible d\'enregistrer l\'image');
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
                <Text style={styles.title}>Générer une Image</Text>

                <TextInput
                    style={styles.promptInput}
                    placeholder="Décrivez l'image que vous souhaitez générer..."
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    numberOfLines={4}
                />

                <Text style={styles.label}>Qualité de l'image :</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={quality}
                        onValueChange={(itemValue) => setQuality(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Basse" value="Low" />
                        <Picker.Item label="Moyenne" value="Medium" />
                        <Picker.Item label="Haute" value="High" />
                    </Picker>
                </View>

                <TouchableOpacity
                    style={[styles.button, styles.generateButton]}
                    onPress={generateImage}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'Génération en cours...' : 'Générer l\'image'}
                    </Text>
                </TouchableOpacity>

                {loading && <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />}

                {generatedImage && (
                    <View style={styles.imageContainer}>
                        <Text style={styles.generatedTitle}>Image générée:</Text>
                        <Image
                            source={{ uri: `data:image/png;base64,${generatedImage}` }}
                            style={styles.generatedImage}
                            resizeMode="contain"
                        />
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={saveGeneratedImage}
                        >
                            <Text style={styles.buttonText}>Enregistrer l'image</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => router.back()}
                >
                    <Text style={styles.buttonText}>Retour</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
    },
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    promptInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 20,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        marginBottom: 20,
    },
    picker: {
        height: 50,
        width: '100%',
    },
    button: {
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
        marginBottom: 10,
    },
    generateButton: {
        backgroundColor: '#3498db',
    },
    saveButton: {
        backgroundColor: '#2ecc71',
    },
    cancelButton: {
        backgroundColor: '#95a5a6',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    loader: {
        marginVertical: 20,
    },
    imageContainer: {
        marginVertical: 20,
        alignItems: 'center',
    },
    generatedTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    generatedImage: {
        width: '100%',
        height: 300,
        borderRadius: 5,
        marginBottom: 15,
    },
});
