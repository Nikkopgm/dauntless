# Écho des Colosses

Jeu mobile d'action-RPG en monde ouvert : chasse aux colosses et chaîne de quêtes.
Jouable dans le navigateur du téléphone (HTML5 + Three.js, aucune installation).

## Lancer
    cd game && python3 -m http.server 8000
Puis ouvrir http://<ip-du-pc>:8000 sur le téléphone (même Wi-Fi), en paysage.
« Ajouter à l'écran d'accueil » pour le lancer comme une appli.

## Contenu
- 5 classes jouables : Guerrier, Paladin, Voleur, Chasseur, Mage (compétence spéciale propre à chacune)
- Textures procédurales (herbe, bois, tuiles, pierre, métal, cuir, écailles, fourrure), ciel en dégradé, reflets sur les armures
- Monde ouvert 600×600 : village de Brumeval, Prés d'Or, Sylve Noire, Marais Brumeux, Crêtes de Braise
- 4 types de monstres, 2 colosses (boss) avec attaques signalées au sol et phase de furie
- 10 quêtes enchaînées (tuer, récolter, livrer un message), 5 PNJ avec ❗ / ?
- Combo à 3 coups, esquive avec invulnérabilité, compétence de zone, potions
- Niveaux, XP, or, améliorations d'arme, mini-carte, sauvegarde automatique

## Modifier le contenu
Tout est dans `data.js` (monstres, PNJ, quêtes, objets). Le moteur est dans `main.js`.
