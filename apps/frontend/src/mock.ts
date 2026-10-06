// Mock catalog until the backend serves real data.
export const PROVIDERS = {
  netflix: { name: 'Netflix', color: '#e50914' },
  prime: { name: 'Prime Video', color: '#00a8e1' },
  disney: { name: 'Disney+', color: '#2b5cff' },
  apple: { name: 'Apple TV+', color: '#6e6e73' },
  max: { name: 'Max', color: '#7b2ff7' },
  paramount: { name: 'Paramount+', color: '#0064ff' },
} as const;
export type ProviderId = keyof typeof PROVIDERS;

export interface CatalogItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  year: number;
  rating: number;
  genre: string;
  provider: ProviderId;
  description: string;
  poster: string;
}

const rows: [string, 'movie' | 'series', number, number, string, ProviderId, string][] = [
  ['Neon Horizon', 'movie', 2026, 8.2, 'Sci-Fi', 'netflix', 'Eine Pilotin jagt in einer überfluteten Megacity ein verschwundenes Signal.'],
  ['The Last Lighthouse', 'series', 2026, 8.7, 'Mystery', 'max', 'Ein Leuchtturmwärter entdeckt, dass die Küste nachts ihre Form ändert.'],
  ['Paper Moons', 'movie', 2025, 7.6, 'Drama', 'apple', 'Zwei Geschwister erben ein Kino und ein Geheimnis aus den Siebzigern.'],
  ['Quantum Heist', 'movie', 2026, 7.1, 'Action', 'prime', 'Ein Team stiehlt Zeit – wortwörtlich – aus einer Schweizer Bank.'],
  ['Blue Orchard', 'series', 2025, 8.1, 'Thriller', 'netflix', 'Auf einer Obstfarm in Südtirol verschwindet die Ernte – und ein Nachbar.'],
  ['Starlight Academy', 'series', 2026, 6.9, 'Fantasy', 'disney', 'Eine Schule für Sternenfänger beginnt ihr gefährlichstes Jahr.'],
  ['Cold Harbor', 'movie', 2026, 7.8, 'Krimi', 'paramount', 'Ein Hafenermittler stolpert über einen Fall, der älter ist als er selbst.'],
  ['Midnight Bakery', 'series', 2025, 8.4, 'Comedy', 'apple', 'Nachts backt ein Dorf Brot, tagsüber löst es Verbrechen.'],
  ['Echoes of Rome', 'series', 2026, 8.9, 'Historie', 'max', 'Der Aufstieg einer Händlerdynastie im Schatten der Kaiser.'],
  ['Velvet Run', 'movie', 2026, 6.7, 'Action', 'netflix', 'Ein Kurier, ein Oldtimer und 48 Stunden bis zur Grenze.'],
  ['Little Giants', 'movie', 2026, 7.4, 'Familie', 'disney', 'Winzige Helden retten den Wald, in dem sie wohnen.'],
  ['Signal Lost', 'series', 2026, 7.9, 'Sci-Fi', 'prime', 'Eine Raumstation verstummt – die Crew behauptet, nie weg gewesen zu sein.'],
  ['Saltwater Summer', 'movie', 2025, 7.2, 'Romanze', 'prime', 'Ein Sommer an der Ostsee, der alles verändert.'],
  ['Iron Meridian', 'series', 2026, 8.0, 'Action', 'paramount', 'Eine Spezialeinheit jagt Schmuggler entlang der letzten Grenzlinie Europas.'],
  ['Glass Garden', 'movie', 2026, 8.3, 'Drama', 'apple', 'Eine Botanikerin kämpft um das letzte Gewächshaus der Stadt.'],
  ['Hollow Crown', 'series', 2025, 8.5, 'Fantasy', 'max', 'Drei Erben, ein Thron, null Vertrauen.'],
  ['Pixel Pirates', 'series', 2026, 7.0, 'Animation', 'disney', 'Piraten segeln durch vergessene Videospielwelten.'],
  ['Dead Air', 'movie', 2026, 7.5, 'Horror', 'netflix', 'Ein Nachtradio-Moderator bekommt Anrufe von Menschen, die es nicht mehr gibt.'],
  ['Northern Lines', 'series', 2026, 8.2, 'Drama', 'paramount', 'Fünf Familien, ein Zugnetz und ein Winter, der nicht endet.'],
  ['Afterglow', 'movie', 2026, 7.7, 'Musik', 'apple', 'Eine verblasste Popsängerin wagt in Berlin das Comeback.'],
  ['StarCraft: Terran Dawn', 'series', 2026, 8.8, 'Sci-Fi', 'max', 'Marines, Marauder und ein Kommandant, der am Rand des Koprulu-Sektors die letzte Kolonie hält. (Fan-Mock)'],
  ['StarCraft: Zerg Rush', 'movie', 2026, 7.9, 'Sci-Fi', 'netflix', 'Der Schwarm kommt in der sechsten Minute – und niemand hat Bunker gebaut. (Fan-Mock)'],
  ['StarCraft: Aiur Rising', 'series', 2026, 8.6, 'Sci-Fi', 'prime', 'Die Protoss kämpfen um ihre Heimat, bevor die Khala endgültig verstummt. (Fan-Mock)'],
];

export const CATALOG: CatalogItem[] = rows.map(
  ([title, type, year, rating, genre, provider, description], i) => {
    const id = title.toLowerCase().replace(/\W+/g, '-');
    return { id, title, type, year, rating, genre, provider, description, poster: `https://picsum.photos/seed/${id}-${i}/400/600` };
  },
);
