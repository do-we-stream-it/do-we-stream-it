# Netflix-Scraper und Queue-Worker (Issue #2)

## Umfang und Voraussetzung

Dieser Workspace enthält Scraper, Worker und lokale Hilfsskripte.
`packages/scraper-queue` liefert den Queue-Produzenten für die Backend-API.
MongoDB-Schema, gemeinsame DTOs, Repository-Implementierungen und die lokale
MongoDB-/Redis-Infrastruktur werden in Issue #1 geliefert. Neue HTTP-Endpunkte
und die Benutzeroberfläche gehören zu Issues #3 und #4.

Der Scraper und die Queue-Tests können bereits unabhängig ausgeführt werden.
Der produktive Worker benötigt zusätzlich das Datenbank-Paket aus Issue #1.
Fehlt es, bricht der Start mit einer konkreten Fehlermeldung ab.

## Quelle und Grenzen

- Öffentliche Netflix-Seite: https://about.netflix.com/de/new-to-watch
- JSON-Daten derselben Seite: https://about.netflix.com/api/data/releases
- Parameter: `country=DE`, `language=de`, `page=N`, `collection=2694103` für Filme
  beziehungsweise `collection=2170013` für Serien.
- Unterstützte Region im MVP: **DE**. Andere Regionen ergeben
  `UNSUPPORTED_COUNTRY`; Sprache allein identifiziert keine Region.
- `videoID` ist die stabile Quellen-ID. `startTime` ist der Veröffentlichungszeitpunkt;
  dessen Kalendertag in `Europe/Berlin` wird als `releaseDate` gespeichert.
  `scrapedAt` erzeugt das Release-Repository beim Upsert.
- Alle Seiten beider Kategorien werden gelesen. Länder-, Kategorie- und
  Pagination-Metadaten werden geprüft; unvollständige Antworten werden verworfen.
- Die Quelle enthält einen wechselnden Veröffentlichungskalender für angekündigte
  Titel, einschließlich neuer Staffeln. Sie ist kein vollständiger Katalog aller
  Netflix-Lizenztitel und besitzt keine garantierte historische Monatsabfrage.
  Angefragte Monate müssen im aktuellen Kalender vorkommen. Ein nicht verfügbarer
  Monat ergibt `SOURCE_DATE_UNAVAILABLE`; ein Tag ohne Titel in einem vorhandenen
  Monat ist eine erfolgreiche leere Abfrage. Bei einem vollständig leeren Kalender
  ist nur der aktuelle UTC-Monat zulässig.
- Dies ist eine öffentliche, undokumentierte Datenquelle der Website. Änderungen
  an deren Struktur führen zu `SOURCE_PARSE_FAILED` statt erfundenen Ergebnissen.
  Es werden keine Zugangsdaten und kein Browser benötigt.
- Abrufe besitzen zehn Sekunden Timeout pro Seite und ein Gesamtbudget von
  60 Sekunden pro Versuch. Maximal 25 Seiten pro Kategorie werden akzeptiert.

## Installation und direkte Quellen-Vorschau

Aus dem Repository-Root:

```sh
npm install
npm run scraper:preview -- --date 2026-10-06 --country DE
```

Die Vorschau schreibt normalisierte Releases auf stdout und verändert weder
MongoDB noch die Queue. Ohne Datum wird der heutige UTC-Tag verwendet.

## Worker starten

Nach Integration des Datenbank-Workspaces aus Issue #1:

```sh
cp apps/worker/.env.example apps/worker/.env
# MongoDB und Redis gemäß Issue #1 starten und die Verbindungsdaten eintragen.
npm run dev:worker
```

Der Worker liest zuerst die Root-`.env`, danach `apps/worker/.env`.
Bereits gesetzte Prozess-Umgebungsvariablen haben Vorrang.

| Variable | Bedeutung |
| --- | --- |
| `REDIS_URL` | Redis-URL, standardmäßig `redis://127.0.0.1:6379` |
| `MONGO_URI` | Erforderliche MongoDB-Verbindung, einschließlich passendem `authSource` |
| `MONGO_DATABASE` | Datenbankname, standardmäßig `netflix-releases` |
| `WORKER_DATA_PACKAGE` | Modulname des Datenbank-Pakets, standardmäßig `@do-we-stream-it/data` |

Für den kompilierten Worker:

```sh
npm run build
npm run start:worker
```

`SIGINT` und `SIGTERM` beenden zuerst den Worker nach Abschluss seiner aktiven
Arbeit, dann die Redis-Verbindungen und zuletzt die MongoDB-Verbindung.

## Queue-Produzent für Issue #3

```ts
import {
  enqueueScraperJob,
  closeScraperQueue,
} from '@do-we-stream-it/scraper-queue';

// Die API hat diesen Job zuvor in MongoDB angelegt.
await enqueueScraperJob({ jobId: job.id, date: job.date, country: job.country });

// Beim Backend-Shutdown aufrufen.
await closeScraperQueue();
```

Das API-Paket muss `@do-we-stream-it/scraper-queue` als Workspace-Abhängigkeit
deklarieren. Die exportierte strukturelle Payload-Schnittstelle entspricht
`ScraperJobPayload` aus dem vorgegebenen Vertrag; sie implementiert keine
gemeinsamen Datenbank-DTOs.

Die Queue heißt `netflix-scraper`; die Job-ID ist exakt die MongoDB-Job-UUID.
Ein bereits verwendeter UUID-Wert wird dedupliziert. Ein weiterer Nutzerstart
verwendet eine neue UUID. Das Promise bestätigt nur das Enqueue. Redis-Ausfälle
werden mit begrenzter Wartezeit zurückgegeben; der nächste Aufruf stellt eine
neue Producer-Verbindung her.

Ein bereits **in MongoDB gespeicherter** Job kann auch manuell eingereiht werden:

```sh
npm run scraper:enqueue -- --job-id <UUID> --date 2026-10-06 --country DE
```

Das Hilfsskript legt keinen DB-Job an. Datum/Region müssen zum bestehenden Job
passen. Die Job-Erstellung und HTTP-Antworten werden in Issue #3 implementiert.

## Übergabe an Issue #1

`src/persistence.ts` lädt das Datenbank-Paket erst beim Worker-Start, damit
Issue #2 ohne das noch fehlende Paket gebaut und getestet werden kann. Das
Modul muss die folgenden Exporte aus dem gelieferten Entwurf bereitstellen:

```text
connectMongo({ uri, database }) → Promise<Db>
initializeMongoSchema(db) → Promise<void>
closeMongo() → Promise<void>

new JobRepository(db)
  .findById(id) → Promise<JobDto | null>
  .markRunning(id) → Promise<JobDto | null>
  .markSucceeded(id, releaseCount) → Promise<JobDto | null>
  .markFailed(id, { code, message }) → Promise<JobDto | null>

new ReleaseRepository(db)
  .upsert(Omit<ReleaseDto, "id" | "scrapedAt">) → Promise<ReleaseDto>
```

`markRunning` wird auch bei Wiederholungen aufgerufen. Der erste Übergang muss
`startedAt` setzen; `running → running` muss diesen Wert erhalten. Terminale
Jobs dürfen nicht erneut auf `running` wechseln. Der Release-Upsert muss die
eindeutige Identität `(provider, country, sourceId, releaseDate)` verwenden.
Die Implementierung dieser Regeln gehört ausschließlich zum Datenbank-Ticket.

Der Worker dedupliziert jeden Ergebnisbatch und setzt `succeeded` erst, nachdem
alle Upserts bestätigt sind. `releaseCount` zählt eindeutige Releases dieses Laufs.
Teilweise gespeicherte Ergebnisse sind durch erneute Upserts wiederaufnehmbar.

Pro Job gibt es maximal drei normale Verarbeitungsversuche mit exponentiellem
Backoff ab einer Sekunde. BullMQ erkennt verwaiste aktive Jobs und stellt sie
nach Ablauf ihrer Sperre erneut zu. Endgültige Queue-Fehler werden in MongoDB
nachgetragen, auch nach einem Worker-Neustart oder einer vorübergehenden
DB-Störung. Öffentliche Fehlermeldungen stammen aus einer festen Liste.

Queue-Historie wird für Deduplizierung und Fehlernachtragung erhalten. Ein späterer
Bereinigungsprozess darf gescheiterte Einträge erst nach einem in MongoDB
bestätigten terminalen Zustand entfernen. Terminale DB-Jobs verhindern erneutes
Scraping selbst nach manueller Entfernung ihrer Queue-Historie.

## Tests

Ohne Infrastruktur:

```sh
npm run test:worker
```

Mit einem erreichbaren Redis aus der Test- oder Issue-#1-Infrastruktur:

```sh
REDIS_TEST_URL=redis://127.0.0.1:6379 npm run test:worker:integration
```

Die Integrationstests verwenden echte Redis-Queues mit jeweils eigener UUID
im Namen und entfernen ausschließlich diese Test-Queues. MongoDB-Repositories
werden über den vereinbarten Vertrag gemockt; damit werden keine Datenbanktests
oder Repository-Implementierungen aus Issue #1 vorweggenommen.

Geprüft werden Speicherung vor Erfolg, leere Ergebnisse, Wiederholungen,
endgültige Fehler, spätere Fehlernachtragung, Deduplizierung, DB-Status beim
Replay und Wiederaufnahme nach `SIGKILL` eines Worker-Prozesses.

## Dokumentation

- [BullMQ-Verbindungen](https://docs.bullmq.io/guide/connections)
- [Wiederholungen](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [Verwaiste Jobs](https://docs.bullmq.io/guide/workers/stalled-jobs)
- [Graceful Shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown)
