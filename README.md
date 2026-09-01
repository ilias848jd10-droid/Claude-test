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
- **ETH/USDT Παράγωγα** (σελίδα `/derivatives`, 3 tabs): ωριαία δεδομένα,
  ζωντανά στο browser (όχι μέσω nightly script, γιατί ο χρήστης διαλέγει
  ελεύθερα ημερομηνία/συμβόλαιο):
  - **Perpetual**: τιμή/candlestick, όγκος, funding rate, open interest από
    το δωρεάν public API του **OKX** (`src/lib/okx.ts`).
  - **Quarterly Futures** και **Options** (με επιλογέα λήξης/strike/call-put):
    από το public API του **Binance** (`src/lib/binance.ts`), γιατί μόνο εκεί
    υπάρχουν πραγματικά USDT-margined αυτού του τύπου για ETH — στο OKX τα
    quarterly/options είναι μόνο σε ETH ή USD/USDC margin.
  - Το Binance μπλοκάρει με HTTP 451 σε κάποια δίκτυα/datacenters (π.χ. το
    dev sandbox όπου φτιάχτηκε η εφαρμογή) αλλά όχι απαραίτητα στον τελικό
    χρήστη — επιβεβαιώθηκε ότι δουλεύει σε πραγματικό κινητό στην Ελλάδα.
- **Νυχτερινή ενημέρωση**: το `.github/workflows/nightly-fetch.yml` τρέχει
  κάθε βράδυ (23:30 UTC) μέσω GitHub Actions scheduled job, τρέχει το script,
  και κάνει commit τα ενημερωμένα δεδομένα πίσω στο repo.
- **Δημοσίευση**: το `.github/workflows/deploy.yml` χτίζει το React app και
  το δημοσιεύει σε GitHub Pages σε κάθε push στο `main` (άρα και μετά από
  κάθε νυχτερινή ενημέρωση δεδομένων).
- **Ιστορικό**: κάθε βράδυ προστίθεται μια νέα ημερήσια τιμή ανά asset· τα
  αρχεία `public/data/history/<id>.json` μεγαλώνουν με τον καιρό (dedupe ανά
  ημερομηνία, οπότε ξανά-τρέξιμο την ίδια μέρα δεν δημιουργεί διπλότυπα).

## KINO — ιστορικό &amp; στατιστικά (σελίδα `/kino`)

⚠️ **Σημαντικό**: το KINO είναι τυχαία κλήρωση με πιστοποιημένη γεννήτρια
τυχαίων αριθμών· κάθε κλήρωση είναι ανεξάρτητη από τις προηγούμενες. Δεν
υπάρχει πραγματικό μαθηματικό προβάδισμα από ιστορικά στοιχεία — ό,τι
ακολουθεί είναι περιγραφικά στατιστικά για διασκέδαση, όχι πρόβλεψη.

```
scripts/fetch-kino.mjs      OPAP public API (game 1100) → ΟΛΕΣ οι κληρώσεις
        │                   κάθε ημέρας (~288/ημέρα, μία κάθε 5') για τις
        │                   τελευταίες ~2 μήνες (rolling window)
        ▼
public/data/kino/draws/<ημερομηνία>.json   όλες οι κληρώσεις της ημέρας
public/data/kino/history.json              1 σύνοψη/ημέρα (πλήθος + κλείσιμο)
        │
        ▼
scripts/analyze-kino.mjs    συχνότητα ανά αριθμό, "ζεστοί/κρύοι/καθυστερημένοι"
        │                   αριθμοί, συχνά ζευγάρια — υπολογισμένα πάνω σε
        │                   ΟΛΕΣ τις κληρώσεις του παραθύρου (~17.000+)
        ▼
public/data/kino/stats.json
        │
        ▼
React σελίδες /kino (σύνοψη ανά ημέρα) και /kino/:date (όλες οι κληρώσεις
        της συγκεκριμένης ημέρας)
```

- **Πηγή δεδομένων**: το δημόσιο REST API του ΟΠΑΠ
  (`https://api.opap.gr/draws/v3.0/1100/...`), χωρίς API key.
- Ενημερώνεται μαζί με τα υπόλοιπα δεδομένα από το ίδιο nightly workflow
  (`.github/workflows/nightly-fetch.yml`).
- Πρώτο τρέξιμο / backfill: `node scripts/fetch-kino.mjs` (γεμίζει ιστορικό
  60 ημερών) και μετά `node scripts/analyze-kino.mjs`.

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
public/data/             δεδομένα (symbols, latest snapshot, ιστορικό ανά asset)
public/data/kino/        ιστορικό &amp; στατιστικά KINO (draws/*.json, history.json, stats.json)
scripts/fetch-stats.mjs  νυχτερινό script άντλησης δεδομένων μετοχών/κρύπτο
scripts/fetch-kino.mjs   νυχτερινό script άντλησης ημερήσιου κλεισίματος KINO
scripts/analyze-kino.mjs υπολογισμός στατιστικών KINO (συχνότητα, hot/cold)
src/lib/                 types, API client, μορφοποίηση τιμών
src/hooks/               useAssets, useHistory, useKino (φόρτωση δεδομένων)
src/components/          SearchBar, CategoryFilter, AssetCard, Sparkline
src/pages/                Dashboard (λίστα + αναζήτηση + φίλτρα), AssetDetail (γράφημα + ιστορικό), Kino, KinoDay
.github/workflows/       nightly-fetch.yml, deploy.yml
```
