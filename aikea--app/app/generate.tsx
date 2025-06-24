import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { v4 as uuidv4 } from 'uuid';
import { pdfService } from '@/services/PdfService';

export default function GenerateScreen() {
    const [prompt, setPrompt] = useState('');
    const [quality, setQuality] = useState('Low');
    const [generatedPdf, setGeneratedPdf] = useState<string | null>(null);
    const [pdfUri, setPdfUri] = useState<string | null>(null);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [loading, setLoading] = useState(false);
    const [_uploadedToBucket, setUploadedToBucket] = useState<{
        url: string;
        idExterne: string;
    } | null>(null);

    const generatePdf = async () => {
        if (!prompt.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir un prompt');
            return;
        }
        setLoading(true);
        console.log('🚀 Début génération PDF avec prompt:', prompt, 'qualité:', quality);
        try {
            // Appel à l'API pour générer le PDF
            const response = await fetch('http://localhost:8080/generate-pdf/create', {
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
                throw new Error('Erreur lors de la génération du PDF');
            } // Récupérer le PDF en blob
            const blob = await response.blob();
            console.log('📄 PDF blob créé:', blob.size, 'bytes');
            setPdfBlob(blob);

            if (Platform.OS === 'web') {
                // Pour le web, créer un URL Object
                const url = URL.createObjectURL(blob);
                console.log('🌐 URL créée pour le web:', url);
                setPdfUri(url);

                // Convertir en base64 pour la sauvegarde
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64data = reader.result?.toString().split(',')[1] || '';
                    console.log('📋 Base64 généré:', base64data.length, 'caractères');
                    setGeneratedPdf(base64data);
                };
            } else {
                // Pour mobile, utiliser FileSystem
                const reader = new FileReader();
                reader.readAsDataURL(blob);

                reader.onloadend = async () => {
                    const base64data = reader.result?.toString().split(',')[1] || '';
                    setGeneratedPdf(base64data);

                    // Sauvegarder temporairement le PDF sur le système de fichiers (mobile seulement)
                    const filename = `generated_pdf_${Date.now()}.pdf`;
                    const fileUri = `${FileSystem.documentDirectory}${filename}`;

                    await FileSystem.writeAsStringAsync(fileUri, base64data, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    setPdfUri(fileUri);
                };
            }
        } catch (error) {
            console.error('❌ Erreur génération PDF:', error);
            Alert.alert('Erreur', 'Impossible de générer le PDF');
        } finally {
            console.log('✅ Fin génération PDF (loading=false)');
            setLoading(false);
        }
    };

    const openPdf = async () => {
        if (!pdfUri && !pdfBlob) {
            Alert.alert('Erreur', 'Aucun PDF disponible');
            return;
        }

        try {
            if (Platform.OS === 'web') {
                if (pdfBlob) {
                    // Pour le web, créer un lien de téléchargement/ouverture
                    const url = URL.createObjectURL(pdfBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.click();

                    // Nettoyer l'URL après utilisation
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } else if (pdfUri) {
                    window.open(pdfUri, '_blank');
                }
            } else {
                // Pour mobile
                if (pdfUri) {
                    const isAvailable = await Sharing.isAvailableAsync();
                    if (isAvailable) {
                        await Sharing.shareAsync(pdfUri, {
                            mimeType: 'application/pdf',
                            dialogTitle: 'Ouvrir le PDF avec...',
                        });
                    } else {
                        await Linking.openURL(pdfUri);
                    }
                }
            }
        } catch (error) {
            console.error("Erreur lors de l'ouverture du PDF:", error);
            Alert.alert('Erreur', "Impossible d'ouvrir le PDF");
        }
    };

    const downloadPdf = async () => {
        if (Platform.OS === 'web' && pdfBlob) {
            // Pour le web, télécharger le PDF
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `generated_pdf_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            Alert.alert('Succès', 'PDF téléchargé avec succès');
        } else {
            // Pour mobile, utiliser la fonction de sauvegarde existante
            saveGeneratedPdf();
        }
    };

    const saveGeneratedPdf = async () => {
        if (!generatedPdf) {
            Alert.alert('Erreur', 'Aucun PDF généré');
            return;
        }

        try {
            // Récupérer les PDFs existants
            const existingPdfsStr = await AsyncStorage.getItem('@generated_pdfs');
            const existingPdfs = existingPdfsStr ? JSON.parse(existingPdfsStr) : [];

            // Créer l'objet pour le nouveau PDF
            const newPdf = {
                id: uuidv4(),
                prompt,
                quality,
                pdf: generatedPdf,
                fileUri: Platform.OS === 'web' ? null : pdfUri,
                createdAt: new Date().toISOString(),
            };

            // Ajouter le nouveau PDF et enregistrer
            const updatedPdfs = [newPdf, ...existingPdfs];
            await AsyncStorage.setItem('@generated_pdfs', JSON.stringify(updatedPdfs));

            Alert.alert('Succès', 'PDF sauvegardé avec succès', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error("Erreur lors de l'enregistrement:", error);
            Alert.alert('Erreur', "Impossible d'enregistrer le PDF");
        }
    };

    // Fonction pour uploader le PDF généré vers le bucket
    const uploadGeneratedPdfToBucket = async () => {
        if (!pdfBlob || !prompt.trim()) {
            Alert.alert('Erreur', 'Aucun PDF à uploader');
            return;
        }

        try {
            console.log('📤 Upload du PDF généré vers le bucket...');

            // Vérifier la taille du fichier
            const maxSize = 45 * 1024 * 1024; // 45MB (un peu moins que la limite serveur)
            if (pdfBlob.size > maxSize) {
                Alert.alert(
                    'Fichier trop volumineux',
                    `Le PDF généré est trop volumineux (${(pdfBlob.size / (1024 * 1024)).toFixed(1)}MB). Essayez avec une qualité plus basse.`
                );
                return;
            }

            // Créer un File à partir du Blob
            const fileName = `generated_${Date.now()}_${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // Générer un ID unique pour ce PDF
            const idExterne = uuidv4();

            console.log(`📄 Taille du fichier: ${(pdfBlob.size / (1024 * 1024)).toFixed(2)}MB`);

            // Uploader via le service PdfService qui utilise l'endpoint /student/upload
            const result = await pdfService.uploadFileToAdmin(
                file,
                idExterne,
                'generated', // tag1
                quality.toLowerCase(), // tag2
                prompt.slice(0, 50) // tag3 - premier 50 caractères du prompt
            );

            console.log('✅ PDF uploadé vers le bucket:', result);
            setUploadedToBucket(result);

            Alert.alert(
                'Succès',
                "PDF généré et sauvegardé dans le système!\nVous pouvez maintenant le retrouver dans l'onglet Admin.",
                [
                    { text: 'OK' },
                    {
                        text: 'Voir dans Admin',
                        onPress: () => router.push('/(tabs)/admin'),
                    },
                ]
            );
        } catch (error) {
            console.error('❌ Erreur upload bucket:', error);
            Alert.alert(
                "Erreur d'upload",
                error instanceof Error ? error.message : "Impossible d'uploader le PDF vers le système"
            );
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
                <Text style={styles.title}>Générer un PDF</Text>
                <TextInput
                    style={styles.promptInput}
                    placeholder="Décrivez le contenu du PDF que vous souhaitez générer..."
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    numberOfLines={4}
                />
                <Text style={styles.label}>Qualité du PDF :</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={quality}
                        onValueChange={itemValue => setQuality(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Basse" value="LOW" />
                        <Picker.Item label="Moyenne" value="MEDIUM" />
                        <Picker.Item label="Haute" value="HIGH" />
                    </Picker>
                </View>
                <TouchableOpacity
                    style={[styles.button, styles.generateButton]}
                    onPress={generatePdf}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'Génération en cours...' : 'Générer le PDF'}
                    </Text>
                </TouchableOpacity>{' '}
                {loading && <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />}
                {pdfBlob && (
                    <View style={styles.pdfContainer}>
                        <Text style={styles.generatedTitle}>PDF généré:</Text>
                        <View style={styles.pdfPreview}>
                            <Text style={styles.pdfInfo}>📄 PDF généré avec succès</Text>
                            <Text style={styles.pdfDetails}>
                                Prompt: {prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}
                            </Text>
                            <Text style={styles.pdfDetails}>Qualité: {quality}</Text>
                        </View>

                        <TouchableOpacity style={[styles.button, styles.openButton]} onPress={openPdf}>
                            <Text style={styles.buttonText}>
                                {Platform.OS === 'web' ? 'Ouvrir le PDF' : 'Ouvrir le PDF'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.downloadButton]} onPress={downloadPdf}>
                            <Text style={styles.buttonText}>
                                {Platform.OS === 'web' ? 'Télécharger le PDF' : 'Enregistrer le PDF'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={saveGeneratedPdf}>
                            <Text style={styles.buttonText}>Sauvegarder le PDF</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.uploadButton]}
                            onPress={uploadGeneratedPdfToBucket}
                        >
                            <Text style={styles.buttonText}>Uploader vers le système</Text>
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
    openButton: {
        backgroundColor: '#e74c3c',
    },
    downloadButton: {
        backgroundColor: '#f39c12',
    },
    saveButton: {
        backgroundColor: '#2ecc71',
    },
    uploadButton: {
        backgroundColor: '#9b59b6',
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
    pdfContainer: {
        marginVertical: 20,
        alignItems: 'center',
    },
    generatedTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    pdfPreview: {
        width: '100%',
        padding: 20,
        backgroundColor: '#f8f9fa',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#dee2e6',
        marginBottom: 15,
        alignItems: 'center',
    },
    pdfInfo: {
        fontSize: 24,
        marginBottom: 10,
        color: '#495057',
    },
    pdfDetails: {
        fontSize: 14,
        color: '#6c757d',
        marginBottom: 5,
        textAlign: 'center',
    },
});
