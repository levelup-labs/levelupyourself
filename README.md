# LEVEL UP YOURSELF

Eine App zur persönlichen Weiterentwicklung im Stil eines modernen Rollenspiels: Du entwickelst deinen eigenen Charakter, trainierst fünf Skills und erreichst mit echten Aufgaben dein nächstes Level.

## Funktionen

- **Charakter** mit Level, Rang (Rookie bis Legende), Gesamt-XP und Profilbild
- **Skills:** Geist, Körper, Disziplin, Kreativität, Soziales, dazu freischaltbare Spezial-Skills und Prestige ab Level 100
- **Quests:** Daily Quests, Weekly Challenges, freie Quests und Ziele mit Schritten, die nacheinander freigeschaltet werden
- **10 Ziel-Vorlagen** (z. B. 10-km-Lauf, neue Sprache, Meditation) mit je 25 Schritten und Medaillen bei Abschluss
- **Fortschritt:** Tagesziel, Streak, XP der letzten 7 Tage, Auszeichnungen
- **Feedback:** Konfetti, XP-Animation zu den Skills, Level-up-Einblendungen, Rückgängig für jede Aktion
- **Onboarding:** Name, Selbsteinschätzung, vorgeschlagene Start-Quests

## Starten

Die App ist eine einzelne Datei ohne Build-Schritt. `index.html` im Browser öffnen genügt, oder über einen beliebigen statischen Host (z. B. GitHub Pages) bereitstellen.

## Daten

- Als Artifact auf claude.ai werden die Daten privat im claude.ai-Konto gespeichert und sind auf allen Geräten verfügbar.
- Als eigenständige Datei oder auf einem anderen Host liegen Konten und Spielstände im `localStorage` des jeweiligen Browsers. Passwörter werden dort nur als PBKDF2-Hash abgelegt.
