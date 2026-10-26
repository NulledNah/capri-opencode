# Capri pour OpenCode

Capri, le construct *Project Capricorn* de Cyberpunk: Edgerunners saison 2, qui
vit sur votre bureau et vous raconte ce que fait **OpenCode**.

C'est un fork de [mochiiwuff/capri-desktop](https://github.com/mochiiwuff/capri-desktop)
qui surveille OpenCode au lieu de Claude Code : même personnage, mêmes
animations, même menu, un autre assistant. Les crédits, la direction artistique
et le tour complet de ce qu'elle fait sont dans le README d'origine.

## Comment ça marche

OpenCode charge un petit plugin qui traduit ses événements en ceux que Capri
comprend déjà et les envoie à son pont local (`127.0.0.1:47823`). Aucun patch
d'`app.asar`, aucun fork d'OpenCode. Le plugin est dans
[`integrations/opencode/`](integrations/opencode/README.md).

## Prérequis

- [OpenCode 2](https://opencode.ai/v2/docs/) installé (CLI ou bureau). Les
  plugins écrits pour V1 ne tournent pas sous V2 : celui-ci est pour V2.
- Node.js 20 ou plus pour la lancer depuis les sources.
- [Ollama](https://ollama.com) seulement si vous voulez lui parler.

## Depuis les sources

```bash
npm install
npm start
```

## La brancher sur OpenCode

Au premier lancement elle propose **Plug me in** : un clic copie
`capri-opencode.js` dans `%USERPROFILE%\.config\opencode\plugins\`.
Redémarrez ensuite OpenCode (il charge les plugins au démarrage). Son menu de la
barre des tâches a les mêmes boutons :

- *Install OpenCode plugin*
- *Remove OpenCode plugin*

Depuis un terminal, sans l'application :

```bash
npm run plugin:install
npm run plugin:uninstall
```

Ou lancez `integrations/opencode/install.bat`.

## Ce qu'elle surveille

| OpenCode | Capri |
|---|---|
| `session.created` / `session.deleted` | bonjour / au revoir |
| hook de prompt | sa ligne « nouvelle mission » |
| hook `tool.execute.before` | ticker, étincelles, compteur, fichiers |
| `session.tool.failed` | impact, glitch, la ligne d'erreur utile |
| `permission.asked` | elle vient vous chercher |
| `session.execution.succeeded` | séquence de victoire, résumé, dernière réponse |
| `session.execution.failed` | ligne de plantage |
| `session.compaction.started` | la ligne de compactage |

Les sessions de sous-agents sont ignorées : pas de double comptage ni de
célébration trop tôt. Échap (course annulée) n'est pas un plantage.

## Construire l'installeur

```bash
npm run dist
```

La build Windows finit dans `dist/`. L'identifiant de l'application est celui
d'origine (`capri.desktop`) : désinstallez la Capri officielle avant d'installer
ce fork si vous l'aviez.

## Différences avec l'original

- Les textes affichés disent **OpenCode** (une couche à l'exécution réécrit les
  chaînes d'origine, pour garder les fichiers upstream fusionnables).
- Le hook Claude Code est remplacé par le plugin OpenCode, installé depuis son
  menu, `npm run plugin:install` ou `install.bat`.
- « OpenCode's folder » pointe vers `%USERPROFILE%\.config\opencode`, pas `~/.claude`.
- L'anglais et l'italien sont réécrits à la main ; les autres langues
  (FR/ES/PT/RU) reçoivent seulement le changement de nom.

## Vérifier

```bash
node integrations/opencode/test_selfcheck.mjs
```

## Crédits et droits

Capri / Project Capricorn, Cyberpunk et Cyberpunk: Edgerunners appartiennent à CD
PROJEKT RED, Studio Trigger et Netflix. Projet de fan non commercial, sans
affiliation. Les images du personnage dans `assets/capri/` viennent d'images de
la série, d'un cut-out de fan et de fan art ; elles ne sont **pas** couvertes par
la licence MIT du code. Si un ayant droit veut les retirer, ouvrez une issue.

Code : MIT (voir `LICENSE`). Original : mochiiwuff/capri-desktop.
