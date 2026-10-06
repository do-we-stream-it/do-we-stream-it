# Quellen-Fixtures

Am 2026-10-06 von Netflix' öffentlicher Veröffentlichungsliste abgerufen:

- `https://about.netflix.com/api/data/releases?country=DE&language=de&page=1&collection=2694103`
- `https://about.netflix.com/api/data/releases?country=DE&language=de&page=1&collection=2170013`

Die JSON-Dateien enthalten die originalen Pagination-Metadaten sowie
`collection`, `country`, `startTime`, `title1` und `videoID` aller Datensätze
der jeweiligen Antwort. Unbenutzte Bild-, Genre- und Untertitelfelder wurden
entfernt. Titel, Identitäten und Zeitstempel sind unverändert.

Parser-Tests verwenden diese aufgezeichneten Antworten. Fehlerfälle und
Pagination-Fälle verändern gezielt Felder beziehungsweise teilen diese
Datensätze auf mehrere Seiten auf; es werden keine künstlichen Produktions-
Releases verwendet. Live-Netzwerkzugriffe gehören nicht zum Unit-Testlauf.
