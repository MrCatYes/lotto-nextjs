# Lotto Viewer - Next.js + GraphQL

## Description
Applicationweb permettant de **visualiser des tirages de loto** et d’**analyser les probabilités** des numéros.  
Elle combine un front-end moderne en Next.js/React et un back-end GraphQL avec une base de données SQLite.

---

##  Fonctionnalités principales
- Affichage des tirages de loto récents
- Statistiques sur les tirages
- Mode « Simulation Premium » pour des analyses avancées
- Interaction en temps réel via GraphQL
- Gestion des tirages dans une base SQLite

---

##  Structure du projet
frontend/ → front-end (Next.js + React + Apollo Client)
backend/ → back-end (Node.js + Apollo Server GraphQL + SQLite)


---

## 🔧 Installation & Lancement

### Prérequis
- Node.js v16 ou supérieur
- npm ou yarn

---

### Lancer le back-end

cd backend
npm install
node server.js

---

### Lancer le front-end
cd frontend
npm install
npm run dev


---

### Technologies utilisées

Next.js

React

Apollo Client / Server

SQLite

JavaScript / TypeScript


### Améliorations futures

Ajout d'un Intelligence Articielle qui calcule les probabilité en temps réel

Authentification pour utilisateurs premium

Tests automatisés front-end et back-end

Déploiement sur Vercel et base de données en ligne

Documentation détaillée des endpoints GraphQL
