# Installer SleepTransit (App native iPhone avec GPS en arrière-plan) depuis Windows

Votre projet natif iOS (`capacitor-app/ios/`) intègre :
- **GPS natif en arrière-plan** (`@capacitor-community/background-geolocation` + `UIBackgroundModes: location`) : le suivi continue même si vous changez d'application ou verrouillez l'iPhone.
- **Notifications locales natives + vibration** (`@capacitor/local-notifications` + `@capacitor/haptics`) : sonnerie et alerte système même écran éteint.
- **Alarme de secours anti-tunnel** : notification programmée sur l'horaire d'arrivée en cas de perte GPS souterraine.

---

## Étape 1 — Compiler `SleepTransit-iOS.ipa` gratuitement dans le cloud (sans Mac)
1. Créez un dépôt sur **GitHub** (même **privé**, gratuit) et envoyez le contenu du dossier `sleeptransit/`.
2. Ouvrez l'onglet **Actions** du dépôt → sélectionnez **Build SleepTransit iOS IPA (iPhone)** → cliquez sur **Run workflow**.
3. Attendez ~4–6 minutes, puis téléchargez l'artefact **`SleepTransit-iOS-IPA`** (dézippez-le pour obtenir `SleepTransit-iOS.ipa`).

---

## Étape 2 — Installer `SleepTransit-iOS.ipa` sur votre iPhone depuis Windows
1. Installez **Sideloadly** sur votre PC Windows (https://sideloadly.io/) ainsi qu'**iTunes** (version site Apple, pas Microsoft Store).
2. Branchez votre iPhone en USB et déverrouillez-le (*Faire confiance à cet ordinateur*).
3. Ouvrez **Sideloadly**, glissez-déposez **`SleepTransit-iOS.ipa`**, entrez votre identifiant Apple et cliquez sur **Start**.
4. Sur votre iPhone : **Réglages → Général → VPN et gestion de l'appareil** → touchez votre identifiant Apple → **Faire confiance**.
   *(Sur iOS 16+, activez aussi **Réglages → Confidentialité et sécurité → Mode développeur** si demandé.)*

> **Renouvellement** : avec un identifiant Apple gratuit, Sideloadly renouvelle automatiquement la signature tous les **7 jours** en Wi-Fi dès que le PC est allumé (option *Wi-Fi Sideloading* dans Sideloadly). Avec un compte Apple Developer (99 €/an), c'est valable 1 an / TestFlight.

---

## Étape 3 — Réglages iPhone indispensables pour le GPS en arrière-plan
Au premier lancement de **SleepTransit** :
1. Acceptez les **Notifications**.
2. Allez dans **Réglages iPhone → SleepTransit → Position** → choisissez **« Toujours »** et activez **« Position exacte »**.
3. Lancez un trajet → activez **Mode Alerte** ou **Mode Sommeil** : l'icône bleue de localisation iOS confirme que le suivi GPS reste actif même quand vous passez sur une autre application !
