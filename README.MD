# 🚀 AIKEA - Plateforme de Génération IA

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-brightgreen)
![React Native](https://img.shields.io/badge/React%20Native-Expo-blue)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)

Plateforme complète de génération de contenu IA avec backend Spring Boot et application mobile React Native/Expo.

## 📋 Prérequis

- **Java 17** ou supérieur
- **Node.js 18** ou supérieur
- **Docker** et **Docker Compose**
- **Git**

## 🏗️ Architecture du Projet

```
AIKEA/
├── Aikea-server/          # Backend Spring Boot
│   ├── src/
│   ├── docker-compose.yml
│   ├── pom.xml
│   └── ...
├── aikea--app/           # Application mobile Expo
│   ├── app/
│   ├── package.json
│   └── ...
└── README.MD            # Ce fichier
```

## 🚀 Installation et Démarrage

### 1. 📥 Cloner le Projet

```bash
git clone <URL_DU_REPO>
cd AIKEA
```

### 2. 🐳 Démarrer la Base de Données (MySQL)

```bash
cd Aikea-server
docker-compose up -d
```

**Vérifier que MySQL est démarré :**

```bash
docker ps
# Vous devriez voir le container mysql-db running
```

**Configuration MySQL :**

- **Host :** localhost:3306
- **Database :** javadb
- **User :** javauser
- **Password :** javapass

### 3. 🔧 Configurer et Lancer le Backend

```bash
# Rester dans le dossier Aikea-server
cd Aikea-server

# Nettoyer et compiler le projet
./mvnw clean install

# Lancer l'application Spring Boot
./mvnw spring-boot:run
```

**Le serveur sera disponible sur :** `http://localhost:8080`

**Endpoints principaux :**

- `GET /api/health` - Vérification santé
- `POST /api/auth/login` - Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/images/generate` - Génération d'images
- `POST /api/text/generate` - Génération de texte

### 4. 📱 Lancer l'Application Mobile

```bash
# Aller dans le dossier de l'app
cd ../aikea--app

# Installer les dépendances
npm install

# Lancer l'application Expo
npx expo start
```

**Options d'exécution :**

- Scannez le QR code avec l'app **Expo Go** sur votre téléphone
- Appuyez sur **`a`** pour ouvrir dans un émulateur Android
- Appuyez sur **`i`** pour ouvrir dans un simulateur iOS
- Appuyez sur **`w`** pour ouvrir dans le navigateur web

## 🛠️ Commandes Utiles

### Backend (Spring Boot)

```bash
# Compilation seule
./mvnw compile

# Tests (nécessite MySQL)
./mvnw test

# Package JAR
./mvnw package

# Redémarrer uniquement MySQL
docker-compose restart mysql

# Logs MySQL
docker-compose logs mysql

# Arrêter MySQL
docker-compose down
```

### Frontend (Expo)

```bash
# Installer les dépendances
npm install

# Démarrer en mode développement
npx expo start

# Démarrer en mode tunnel (pour tester sur réseau externe)
npx expo start --tunnel

# Build pour production
npx expo build

# Reset cache
npx expo start -c
```

## 🔧 Configuration

### Variables d'Environnement Backend

Créez un fichier `application-local.yml` dans `src/main/resources/` :

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/javadb
    username: javauser
    password: javapass

openai:
  api-key: YOUR_OPENAI_API_KEY

cloudinary:
  cloud-name: YOUR_CLOUD_NAME
  api-key: YOUR_API_KEY
  api-secret: YOUR_API_SECRET
```

### Configuration App Mobile

Modifiez les URLs dans l'app pour pointer vers votre backend :

```javascript
// Dans les fichiers de configuration
const API_BASE_URL = "http://localhost:8080/api";
```

## 🐛 Dépannage

### Problèmes Courants

**1. Erreur de connexion MySQL**

```bash
# Vérifier que Docker est lancé
docker ps

# Redémarrer MySQL
docker-compose down && docker-compose up -d

# Vérifier les logs
docker-compose logs mysql
```

**2. Erreur de compilation Java**

```bash
# Vérifier la version Java
java --version
# Doit être 17 ou supérieur

# Nettoyer complètement
./mvnw clean
rm -rf target/
./mvnw install
```

**3. Problèmes avec l'app Expo**

```bash
# Nettoyer le cache
npx expo start -c

# Réinstaller les dépendances
rm -rf node_modules
npm install
```

**4. Port déjà utilisé**

```bash
# Changer le port MySQL (dans docker-compose.yml)
ports:
  - "3307:3306"  # Au lieu de 3306:3306

# Puis modifier application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3307/javadb
```

## 📚 Technologies Utilisées

### Backend

- **Spring Boot 3.2.5** - Framework principal
- **Spring Security** - Authentification et autorisation
- **Spring Data JPA** - ORM et accès aux données
- **MySQL 8.0** - Base de données
- **Flyway** - Migration de base de données
- **OpenAI API** - Génération IA
- **Cloudinary** - Stockage d'images
- **JWT** - Tokens d'authentification

### Frontend

- **React Native** - Framework mobile
- **Expo** - Plateforme de développement
- **TypeScript** - Langage typé
- **Expo Router** - Navigation

## 🚀 Déploiement

### Backend (Production)

```bash
# Build du JAR
./mvnw clean package -DskipTests

# Le JAR sera dans target/Aikea-0.0.1-SNAPSHOT.jar

# Lancer en production
java -jar target/Aikea-0.0.1-SNAPSHOT.jar
```

### App Mobile

```bash
# Build Android
npx expo build:android

# Build iOS
npx expo build:ios
```

## 🤝 Contribution

1. Fork le projet
2. Créez votre branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE.md](LICENSE.md) pour plus de détails.

## 📞 Support

Pour toute question ou problème :

- Ouvrez une **Issue** sur GitHub
- Consultez la **documentation** des technologies utilisées
- Vérifiez les **logs** pour identifier les erreurs

---

**🎉 Bon développement avec AIKEA !**
