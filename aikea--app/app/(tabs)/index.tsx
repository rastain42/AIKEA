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

export default function HomeScreen() {
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
      Alert.alert('Description manquante', 'Veuillez décrire votre intérieur rêvé');
      return;
    }
    setLoading(true);
    console.log('🚀 Début création design avec description:', prompt, 'qualité:', quality);
    try {
      // Appel à l'API pour générer le design d'intérieur
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
        throw new Error('Erreur lors de la création du design');
      } // Récupérer le design en blob
      const blob = await response.blob();
      console.log('📄 Design créé:', blob.size, 'bytes');
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

          // Sauvegarder temporairement le design sur le système de fichiers (mobile seulement)
          const filename = `aikea_design_${Date.now()}.pdf`;
          const fileUri = `${FileSystem.documentDirectory}${filename}`;

          await FileSystem.writeAsStringAsync(fileUri, base64data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          setPdfUri(fileUri);
        };
      }
    } catch (error) {
      console.error('❌ Erreur création design:', error);
      Alert.alert('Erreur', "Impossible de créer votre design d'intérieur");
    } finally {
      console.log('✅ Fin création design (loading=false)');
      setLoading(false);
    }
  };

  const openPdf = async () => {
    if (!pdfUri && !pdfBlob) {
      Alert.alert('Erreur', 'Aucun design disponible');
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
              dialogTitle: "Voir votre design d'intérieur...",
            });
          } else {
            await Linking.openURL(pdfUri);
          }
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'ouverture du design:", error);
      Alert.alert('Erreur', "Impossible d'ouvrir votre design");
    }
  };

  const downloadPdf = async () => {
    if (Platform.OS === 'web' && pdfBlob) {
      // Pour le web, télécharger le guide design
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aikea_design_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      Alert.alert('Succès', 'Guide design téléchargé avec succès');
    } else {
      // Pour mobile, utiliser la fonction de sauvegarde existante
      saveGeneratedPdf();
    }
  };

  const saveGeneratedPdf = async () => {
    if (!generatedPdf) {
      Alert.alert('Erreur', 'Aucun design créé');
      return;
    }

    try {
      // Récupérer les designs existants
      const existingPdfsStr = await AsyncStorage.getItem('@generated_pdfs');
      const existingPdfs = existingPdfsStr ? JSON.parse(existingPdfsStr) : [];

      // Créer l'objet pour le nouveau design
      const newPdf = {
        id: uuidv4(),
        prompt,
        quality,
        pdf: generatedPdf,
        fileUri: Platform.OS === 'web' ? null : pdfUri,
        createdAt: new Date().toISOString(),
      };

      // Ajouter le nouveau design et enregistrer
      const updatedPdfs = [newPdf, ...existingPdfs];
      await AsyncStorage.setItem('@generated_pdfs', JSON.stringify(updatedPdfs));

      Alert.alert('Succès', 'Design sauvegardé dans vos projets');
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      Alert.alert('Erreur', "Impossible d'enregistrer le design");
    }
  };

  // Fonction pour uploader le design généré vers le système AIKEA
  const uploadGeneratedPdfToBucket = async () => {
    if (!pdfBlob || !prompt.trim()) {
      Alert.alert('Erreur', 'Aucun design à partager');
      return;
    }

    try {
      console.log('📤 Partage du design avec AIKEA...');

      // Vérifier la taille du fichier
      const maxSize = 45 * 1024 * 1024; // 45MB (un peu moins que la limite serveur)
      if (pdfBlob.size > maxSize) {
        Alert.alert(
          'Fichier trop volumineux',
          `Le design créé est trop volumineux (${(pdfBlob.size / (1024 * 1024)).toFixed(1)}MB). Essayez avec une qualité plus basse.`
        );
        return;
      }

      // Créer un nom de fichier plus descriptif
      const designName = prompt.slice(0, 40).replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
      const qualityPrefix = quality === 'HIGH' ? 'UltraHD' : quality === 'MEDIUM' ? 'HD' : 'Standard';
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `AIKEA_${qualityPrefix}_${designName}_${dateStr}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Générer un ID unique pour ce design
      const idExterne = uuidv4();

      console.log(`📄 Taille du fichier: ${(pdfBlob.size / (1024 * 1024)).toFixed(2)}MB`);

      // Uploader via le service PdfService qui utilise l'endpoint /student/upload
      const result = await pdfService.uploadFileToAdmin(
        file,
        idExterne,
        'design-interieur', // tag1
        quality.toLowerCase(), // tag2
        prompt.slice(0, 50), // tag3 - premier 50 caractères de la description
        fileName // displayName - nom descriptif pour l'affichage
      );

      console.log('✅ Design partagé avec AIKEA:', result);
      setUploadedToBucket(result);

      Alert.alert(
        'Succès',
        'Design partagé avec AIKEA!\nVous pouvez maintenant le retrouver dans vos créations et recevoir des conseils personnalisés.',
        [
          { text: 'OK' },
          {
            text: 'Voir mes créations',
            onPress: () => router.push('/(tabs)/admin'),
          },
        ]
      );
    } catch (error) {
      console.error('❌ Erreur partage design:', error);
      Alert.alert(
        'Erreur de partage',
        error instanceof Error ? error.message : 'Impossible de partager le design avec AIKEA'
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>AIKEA - Design d&apos;Intérieur</Text>
        <Text style={styles.subtitle}>
          Créateur de design d&apos;intérieur personnalisé. Décrivez votre intérieur rêvé et nous
          génèrerons une image avec un PDF contenant une description détaillée et des liens pour
          acheter les meubles.
        </Text>

        <TextInput
          style={styles.promptInput}
          placeholder="Décrivez votre intérieur rêvé (style, couleurs, meubles, ambiance...)&#10;Ex: 'Salon moderne avec canapé gris, table basse en bois, éclairage tamisé, style scandinave'"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          numberOfLines={5}
        />

        <Text style={styles.label}>Qualité de l&apos;image et du PDF :</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={quality}
            onValueChange={itemValue => setQuality(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Basse qualité" value="LOW" />
            <Picker.Item label="Haute définition" value="MEDIUM" />
            <Picker.Item label="Ultra HD" value="HIGH" />
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.generateButton]}
          onPress={generatePdf}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Création en cours...' : "Créer mon design d'intérieur"}
          </Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator size="large" color="#3498db" style={styles.loader} />}

        {pdfBlob && (
          <View style={styles.pdfContainer}>
            <Text style={styles.generatedTitle}>🏠 Votre design d&apos;intérieur est prêt !</Text>
            <View style={styles.pdfPreview}>
              <Text style={styles.pdfInfo}>🎨 Design créé avec succès</Text>
              <Text style={styles.pdfDetails}>
                Description: {prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}
              </Text>
              <Text style={styles.pdfDetails}>Qualité: {quality}</Text>
              <Text style={styles.pdfHint}>
                📄 Le PDF contient l&apos;image de votre intérieur, une description détaillée et des
                liens d&apos;achat
              </Text>
            </View>

            <TouchableOpacity style={[styles.button, styles.openButton]} onPress={openPdf}>
              <Text style={[styles.buttonText, styles.yellowButtonText]}>Voir mon design</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.downloadButton]} onPress={downloadPdf}>
              <Text style={styles.buttonText}>
                {Platform.OS === 'web' ? 'Télécharger le design' : 'Enregistrer le design'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.uploadButton]}
              onPress={uploadGeneratedPdfToBucket}
            >
              <Text style={styles.buttonText}>Sauvegarder dans AIKEA</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.adminButton]}
          onPress={() => router.push('/(tabs)/admin')}
        >
          <Text style={styles.buttonText}>Mes créations & collections AIKEA</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    color: '#7f8c8d',
    lineHeight: 22,
  },
  promptInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
    color: '#2c3e50',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 10,
    marginBottom: 25,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButton: {
    backgroundColor: '#0051BA', // Bleu IKEA
  },
  openButton: {
    backgroundColor: '#FFDB00', // Jaune IKEA
  },
  downloadButton: {
    backgroundColor: '#f39c12',
  },
  saveButton: {
    backgroundColor: '#2ecc71',
  },
  uploadButton: {
    backgroundColor: '#0051BA', // Bleu IKEA
  },
  adminButton: {
    backgroundColor: '#34495e',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  yellowButtonText: {
    color: '#000', // Texte noir sur fond jaune pour plus de lisibilité
  },
  loader: {
    marginVertical: 20,
  },
  pdfContainer: {
    marginVertical: 25,
    alignItems: 'center',
  },
  generatedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#27ae60',
    textAlign: 'center',
  },
  pdfPreview: {
    width: '100%',
    padding: 20,
    backgroundColor: '#ecf0f1',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pdfInfo: {
    fontSize: 18,
    marginBottom: 10,
    color: '#2c3e50',
    fontWeight: '600',
  },
  pdfDetails: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
    textAlign: 'center',
    lineHeight: 18,
  },
  pdfHint: {
    fontSize: 12,
    color: '#3498db',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
