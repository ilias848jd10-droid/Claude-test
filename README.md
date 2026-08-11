# Στατιστικά Μετοχών & Κρύπτο

Progressive Web App (PWA) που κάθε βράδυ τραβάει στατιστικά για μετοχές και
κρυπτονομίσματα, τα αποθηκεύει ως ιστορικό, και τα παρουσιάζει με γραφήματα,
αναζήτηση και φιλτράρισμα ανά κατηγορία. Τρέχει σε browser σε κινητό και
υπολογιστή, και μπορεί να εγκατασταθεί σαν εφαρμογή (Add to Home Screen /
Install app) χάρη στο PWA manifest + service worker.

## Πώς δουλεύει

```
public/data/symbols.json   λίστα μετοχών/κρύπτο με κατηγορία
        │
        ▼
scripts/fetch-stats.mjs    Node script: Yahoo Finance (μετοχές) + CoinGecko (κρύπτο)
        │                  χωρίς API key
        ▼
public/data/latest.json    στιγμιότυπο τελευταίων τιμών όλων των assets
public/data/history/*.json ιστορικές ημερήσιες τιμές ανά asset (append-only)
        │
        ▼
React app (Vite)           Dashboard + σελίδα ανά asset με γράφημα & ιστορικό
```

- **Χωρίς API keys**: μετοχές μέσω του δημόσιου Yahoo Finance chart endpoint,
  κρύπτο μέσω του δωρεάν CoinGecko API.
- **Νυχτερινή ενημέρωση**: το `.github/workflows/nightly-fetch.yml` τρέχει
  κάθε βράδυ (23:30 UTC) μέσω GitHub Actions scheduled job, τρέχει το script,
  και κάνει commit τα ενημερωμένα δεδομένα πίσω στο repo.
- **Δημοσίευση**: το `.github/workflows/deploy.yml` χτίζει το React app και
  το δημοσιεύει σε GitHub Pages σε κάθε push στο `main` (άρα και μετά από
  κάθε νυχτερινή ενημέρωση δεδομένων).
- **Ιστορικό**: κάθε βράδυ προστίθεται μια νέα ημερήσια τιμή ανά asset· τα
  αρχεία `public/data/history/<id>.json` μεγαλώνουν με τον καιρό (dedupe ανά
  ημερομηνία, οπότε ξανά-τρέξιμο την ίδια μέρα δεν δημιουργεί διπλότυπα).

## Εκκίνηση δεδομένων (πρώτη φορά)

```bash
node scripts/fetch-stats.mjs
```

Το πρώτο τρέξιμο γεμίζει ιστορικό ~3 μηνών (μετοχές) / ~90 ημερών (κρύπτο).
Το CoinGecko free tier έχει αυστηρό rate limit — το script κάνει αυτόματα
retry με backoff σε 429· αν κάποιο coin αποτύχει, ξανατρέξτο (idempotent,
κάνει upsert ανά ημερομηνία).

## Τοπική ανάπτυξη

```bash
npm install
npm run dev       # dev server
npm run build     # production build στο dist/
npm run preview   # προεπισκόπηση του production build
```

## Ανάπτυξη σε GitHub Pages

1. Κάντε merge αυτό το branch στο `main` (τα workflows είναι φτιαγμένα να
   ενεργοποιούνται σε push στο `main`).
2. Στις ρυθμίσεις του repo: **Settings → Pages → Source: GitHub Actions**.
3. Το `deploy.yml` θα χτίσει και θα δημοσιεύσει αυτόματα. Το `vite.config.ts`
   έχει `base: "/Claude-test/"` ώστε τα assets να φορτώνουν σωστά κάτω από
   `https://<user>.github.io/Claude-test/` (προσοχή στα κεφαλαία — το GitHub
   Pages είναι case-sensitive στο path). Αν το repo μετονομαστεί, αλλάξτε
   αναλόγως το `base` (και το `start_url`/`scope` στο PWA manifest).
4. Το `nightly-fetch.yml` χρειάζεται να τρέξει τουλάχιστον μία φορά (ή να
   περιμένετε το πρώτο βράδυ) ώστε να υπάρχουν δεδομένα στο `main` — μπορείτε
   να το τρέξετε χειροκίνητα από το tab **Actions → Nightly stats fetch → Run
   workflow**.

## Προσθήκη νέων μετοχών/κρύπτο

Επεξεργαστείτε το `public/data/symbols.json`:

- Μετοχές: `symbol` = Yahoo Finance ticker (π.χ. `"AAPL"`, `"MSFT"`).
- Κρύπτο: `id` = CoinGecko coin id (π.χ. `"bitcoin"`, `"ethereum"` — βρίσκεται
  στο URL της σελίδας του νομίσματος στο coingecko.com).
- `category` καθορίζει το φίλτρο κατηγορίας στο dashboard.

Μετά την προσθήκη, τρέξτε `node scripts/fetch-stats.mjs` για να γεμίσει το
ιστορικό του νέου asset.

## Δομή project

```
public/data/            δεδομένα (symbols, latest snapshot, ιστορικό ανά asset)
scripts/fetch-stats.mjs νυχτερινό script άντλησης δεδομένων
src/lib/                types, API client, μορφοποίηση τιμών
src/hooks/               useAssets, useHistory (φόρτωση δεδομένων)
src/components/          SearchBar, CategoryFilter, AssetCard, Sparkline
src/pages/                Dashboard (λίστα + αναζήτηση + φίλτρα), AssetDetail (γράφημα + ιστορικό)
.github/workflows/       nightly-fetch.yml, deploy.yml
```
