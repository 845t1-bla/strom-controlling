# Strom-Controlling ⚡

Web-App (PWA) für iPhone und Laptop: Balkon-PV und Zweirichtungszähler erfassen, Erzeugung, Eigenverbrauch,
Einspeisung, Netzbezug, Ersparnis und Amortisation auswerten. Die Daten liegen in Firebase Firestore und sind auf
allen Geräten synchron. Die App läuft auf GitHub Pages.

## Ausprobieren ohne Firebase (Demo)

```bash
npm install
npm run dev:demo
```

Dann <http://localhost:5173/strom-controlling/> öffnen. Die Demo nutzt Beispieldaten, die nur im Browser gespeichert werden.

## Einrichtung (einmalig)

### 1. Firebase-Projekt

1. <https://console.firebase.google.com> → **Projekt hinzufügen** (Google Analytics kannst du ausschalten).
2. **Build → Authentication → Jetzt starten → Anbieter „E-Mail-Adresse/Passwort“ aktivieren.**
3. **Authentication → Users → Nutzer hinzufügen**: deine E-Mail + ein Passwort. Danach die **User UID** kopieren.
4. **Build → Firestore Database → Datenbank erstellen**: Standort **`europe-west3` (Frankfurt)**, Produktionsmodus.
   Der Standort lässt sich später nicht mehr ändern.
5. **Firestore → Regeln**: Inhalt von [`firestore.rules`](firestore.rules) einfügen (die dort eingetragene UID muss
   deine sein) und **Veröffentlichen**.
6. **Projekteinstellungen (Zahnrad) → Allgemein → Deine Apps → Web-App (`</>`) registrieren** (Hosting nicht nötig).
   Die angezeigten Werte (`apiKey`, `authDomain`, `projectId`, …) in [`src/firebase-config.ts`](src/firebase-config.ts) eintragen.
   Diese Werte sind nicht geheim. Geschützt werden die Daten durch Login und Regeln.

### 2. GitHub Pages

1. Auf GitHub ein **öffentliches** Repository mit dem Namen `strom-controlling` anlegen, ohne README.
   Wenn du einen anderen Namen wählst, passe `BASE` in [`vite.config.ts`](vite.config.ts) an.
2. Im Repository: **Settings → Pages → Source: „GitHub Actions“**.
3. Code hochladen (im Projektordner):

   ```bash
   git init -b main
   git add .
   git commit -m "Strom-Controlling"
   git remote add origin https://github.com/<dein-name>/strom-controlling.git
   git push -u origin main
   ```

   Der Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) testet, baut und veröffentlicht automatisch
   unter `https://<dein-name>.github.io/strom-controlling/`.
4. In Firebase: **Authentication → Einstellungen → Autorisierte Domains → `<dein-name>.github.io` hinzufügen.**

### 3. Auf dem iPhone installieren

Die URL in **Safari** öffnen → **Teilen → „Zum Home-Bildschirm“**. Die App startet dann im Vollbild.
Die Home-Bildschirm-App hat einen eigenen Speicher, deshalb meldest du dich dort einmal separat an.

## Bedienung

- **Ablesung**: Datum + PV-Gesamtertrag (aus der Wechselrichter-App) + Zählerstände Bezug (1.8.0) und Einspeisung (2.8.0).
  Einzelne Felder dürfen leer bleiben. Alte Werte (z. B. aus Jahresabrechnungen) mit ihrem damaligen Datum nachtragen.
- **Am besten alle drei Werte gleichzeitig ablesen, ideal abends nach Sonnenuntergang.**
- **Tarife** gelten ab ihrem Datum bis zum Beginn des nächsten Tarifs. Am Stichtag ablesen, dann ist die Aufteilung exakt.
- **Zählerwechsel** (neuer Zähler, neuer Wechselrichter) unter Einstellungen erfassen. Die Reihe läuft dann nahtlos weiter.
- **Backup**: Unter Einstellungen regelmäßig ein JSON-Backup herunterladen. Ein CSV-Export für Excel gibt es auch.

## Rechenlogik

| Kennzahl | Formel (je Ableseintervall) |
|---|---|
| Erzeugung | Δ PV-Gesamtertrag |
| Eigenverbrauch | Δ PV − Δ Einspeisung |
| Gesamtverbrauch | Δ Bezug + Eigenverbrauch |
| Eigenverbrauchsquote | Eigenverbrauch / Erzeugung |
| Autarkie | Eigenverbrauch / Gesamtverbrauch |
| Ersparnis | Eigenverbrauch × Arbeitspreis des jeweiligen Tages |
| Kosten mit PV | Bezug × Arbeitspreis + Grundpreis (Tagessatz = Monatspreis × 12 / 365) |
| Kosten ohne PV | Gesamtverbrauch × Arbeitspreis + Grundpreis |

- Diagramme zeigen die **echten Ableseintervalle** als kWh/Tag (Breite = Dauer, Fläche = Menge).
- Nur wenn ein Intervall über einen Tarif-, Jahres- oder Filterwechsel reicht, wird es **tageweise anteilig** aufgeteilt
  und mit „anteilig“ markiert.
- Amortisationsprognose: Ersparnis der letzten 365 Tage. Bei weniger als einem Jahr Daten wird der Gesamtdurchschnitt
  genutzt und als „unsicher“ markiert.

## Entwicklung

```bash
npm test          # Rechenkern-Tests (Vitest)
npm run build     # Typprüfung + Produktions-Build (dist/)
node scripts/icons.mjs   # App-Icons neu erzeugen
```
