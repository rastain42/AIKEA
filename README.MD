# AIKEA

plateforme de creation de thème de décoration d'interieur,

lien du doc : https://docs.google.com/document/d/1usnwLm5GG8u7cwWLxyNX_pWZDjNFtTqoPhXH3lamoUM/edit?usp=sharing

lien du cours : https://docs.google.com/presentation/d/16FulfszIIGmVhNe2AIovsLeA6VnXa4pm_TshXbgQnmU/edit?usp=sharing

## fonctionnement

- premier prompt sur le générateur d'images : "fais moi une décoration d'interieur pour une maison/appartement: {input utilisateur}"
- deuxième prompt décris cet intérieur et propose moi du mobilier dans ce style

## attendus techniques

- Des entités propres permettant la création et l’utilisation d’une DB
- Des routes REST permettant d'interagir avec votre AI.
- Des traitements complexes permettant d'exécuter votre logique métier de façon propre
- Une page présentant votre produit (Réactive)
- Une page permettant d'utiliser votre produit (Pas nécessairement réactive)
- Une page permettant de configurer votre produit (Pas besoin de vrai système d’identification). (Pas nécessairement réactive)

### Pour Votre Back

Créer une API connectée à une IA capable de contacter une LLM et un générateur d’image (possiblement tous deux d’Open AI).
Il devra permettre la création d’un PDF basé sur une jointure entre votre texte et l’image
Il devra pouvoir enregistrer
Dans un bucket externe permettant d’afficher ce dernier publiquement sur internet
La métadata du PDF
Localement
Dans une DB distante (Celle ou l’image est enregistrée)

### Pour votre Front (Desktop)

Il vous faudra une page d’administration permettant de faire du CRUD avec vos données derrière une application local et sécurisé. (Affectant vos données locales et distantes)
Il vous faudra pouvoir configurer et lancé un évènement de génération à la chaine (création de 2 ou plus d’éléments à insérer en base)

### Pour votre Front (mobile)

Il faudra que, depuis votre téléphone, vous soyez en mesure d’afficher une liste de données basée sur une requête avec quelques règles métiers

## how to use

### back

- run le docker compose
- run aikea server

exemple:
POST http://localhost:8080/generate-image/justImage

body: {
"prompt": "Une maison moderne au bord de la mer avec de grandes fenêtres, des meubles minimalistes et une vue sur l'océan au coucher du soleil",
"quality": "High"
}

### front

npx expo start

pour se logger :

- username : admin
- password : admin123

# TODO

- git ignore les fichiers générés