# LEVEL UP YOURSELF

Eine App zur persönlichen Weiterentwicklung im Stil eines modernen Rollenspiels: Du entwickelst deinen eigenen Charakter, trainierst fünf Skills und erreichst mit echten Aufgaben dein nächstes Level.

## Funktionen

- **Charakter** mit Level, Rang (Rookie bis Legende), Gesamt-XP und Profilbild
- **Skills:** Geist, Körper, Disziplin, Kreativität, Soziales (Level 0–100), dazu freischaltbare Spezial-Skills. Wer über Level 100 hinauskommt, steigt automatisch in die nächste Prestige-Stufe auf
- **Quests:** Daily Quests, Weekly Challenges, freie Quests und Ziele mit Schritten, die nacheinander freigeschaltet werden
- **21 Ziel-Vorlagen** in Themengruppen (z. B. eigene App bauen, 10-km-Lauf, neue Sprache, Notgroschen, Rauchfrei) mit je 25 Schritten und Medaillen bei Abschluss
- **Fortschritt:** Tagesziel, Streak, XP der letzten 7 Tage, Auszeichnungen
- **Feedback:** Konfetti, XP-Animation zu den Skills, Level-up-Einblendungen, Rückgängig für jede Aktion
- **Onboarding:** Name, Selbsteinschätzung (0–10 ergibt Start-Skill 0–100, mit „Alles auf 0“), vorgeschlagene Start-Quests
- **Zurücksetzen:** Im Profil lässt sich alles auf 0 setzen (Skills, XP, Quests, Ziele); Name, Profilbild und Tagesziel bleiben erhalten

## Starten

Die Oberfläche liegt in `public/index.html` und benötigt keinen Build-Schritt. Netlify veröffentlicht ausschließlich `public/` und stellt die serverseitigen Konten- und Spielstand-Endpunkte bereit. Zur lokalen Entwicklung: `npm install` und `netlify dev --port 8889`.

## Daten

- Netlify Identity verwaltet Registrierung, Anmeldung, E-Mail-Bestätigung und Passwort-Wiederherstellung. Neue Konten bestätigen zuerst ihre E-Mail-Adresse.
- Netlify Database speichert pro angemeldetem Konto den Spielstand. Die Endpunkte verwenden ausschließlich die serverseitig geprüfte Konto-ID. Passwörter und alte Passwort-Hashes werden nicht in der Spielstand-Datenbank gespeichert.
- Beim ersten Anmelden wird ein vorhandener Browser-Spielstand mit derselben E-Mail-Adresse importiert, sofern online noch kein Spielstand existiert. Dafür zuerst ein neues Online-Konto registrieren und bestätigen; bestehende lokale Konten werden nicht automatisch zu Online-Konten.
- Geteilte Ziele liegen in der Tabelle `shared_goals` (Endpunkt `netlify/functions/shared-goals.mts`). Alle angemeldeten Nutzer sehen sie unter „Ziele entdecken“ und können sie übernehmen. Gespeichert werden nur Name, Beschreibung und Quests; die Konto-ID dient ausschließlich dazu, dass der Autor das Teilen beenden kann, und wird nie ausgeliefert. Pro Konto sind höchstens 30 geteilte Ziele möglich.
- Die Demo speichert keine Daten. Lokale Anzeige-Einstellungen bleiben im Browser.
- Die Datenbankschemata liegen in `db/schema.ts`. Migrationen unter `netlify/database/migrations/` werden beim Deploy automatisch angewendet. Änderungen mit `npx drizzle-kit generate --name beschreibender_name` vorbereiten.
- Änderungen werden automatisch gespeichert. Bei Verbindungsfehlern erscheint eine Wiederholungsoption; ungespeicherte Änderungen verhindern das Abmelden. Gleichzeitig geänderte Spielstände anderer Geräte werden durch eine Versionsprüfung geschützt. Vor dem Wechsel des Geräts das Speichern abwarten und dort die Seite neu laden.

## Prüfung

`npm test` prüft Zugriffsschutz, Kontozuordnung, Versionskonflikte und Browser-JavaScript-Syntax. `npm run typecheck` prüft den Servercode.
