export const APP_CONFIG = {
  csvManifestPath: './data/csv_manifest.json',
  playerManifestPath: './data/player_manifest.json',
  minMatchesForLeaderboards: 25,
  defaultPlayerSearchLimit: 8,
  defaultInitialPlayerName: 'Carlos Alcaraz',
  liveYear: 2026,
  liveYearSourceTemplates: [
    '/api/historic-data/atp/{year}.csv',
    'http://localhost:5001/api/historic-data/atp/{year}.csv',
    'https://stats.tennismylife.org/data/{year}.csv',
  ],
};

export const CATEGORY_LABELS = {
  'grand-slam': 'Grand Slam',
  'masters-1000': 'Masters 1000',
  'atp-500': 'ATP 500',
  'atp-250': 'ATP 250',
  'atp-125': 'ATP 125',
  finals: 'Tour Finals',
  other: 'Other'
};

export const SURFACE_LABELS = {
  'surface-hard': 'Hard',
  'surface-clay': 'Clay',
  'surface-grass': 'Grass',
  'surface-indoor': 'Indoor',
  'surface-carpet': 'Carpet'
};

export const TOP_PLAYER_IMAGE_MAP = {
  'Novak Djokovic': 'https://www.itftennis.com/remote.axd/media.itftennis.com/assetbank-itf/servlet/display?cropmode=percentage&file=22137ab7cf680b76887ffd08.jpg%3Fcrop%3D0.28944414909327193%2C0.073837793136038762%2C0.27934313899226171%2C0.09327190028944396&height=420&rnd=133452065080000000&width=340',
  'Carlos Alcaraz': 'https://www.itftennis.com/remote.axd/media.itftennis.com/assetbank-itf/servlet/display?cropmode=percentage&file=22137ab7e56b0948907afd2e.jpg%3Fcrop%3D0.0000000000000001297794951160%2C0.016257472481415305%2C0%2C0.06682107956676149&height=420&rnd=133353580110000000&width=340',
  'Jannik Sinner': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Jannik_Sinner_Queen%27s_Club_Championships_2023_%28cropped%29.jpg/320px-Jannik_Sinner_Queen%27s_Club_Championships_2023_%28cropped%29.jpg',
  'Daniil Medvedev': 'https://www.itftennis.com/remote.axd/media.itftennis.com/asset-bank/servlet/display?cropmode=percentage&file=221379a7c3240858ba7c.jpg%3Fcrop%3D0.34884103089493274%2C0.034261496040929283%2C0.29415583921461341%2C0.27618451334874194&height=420&rnd=133353579380000000&width=340',
  'Alexander Zverev': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Zverev_RG21_%2828%29_%2848132302537%29.jpg/320px-Zverev_RG21_%2828%29_%2848132302537%29.jpg',
  'Andrey Rublev': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Rublev_RG21_%2823%29_%2848134080902%29.jpg/320px-Rublev_RG21_%2823%29_%2848134080902%29.jpg',
  'Holger Rune': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Rune_RG22_%2819%29_%2852082101786%29.jpg/320px-Rune_RG22_%2819%29_%2852082101786%29.jpg',
  'Stefanos Tsitsipas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Tsitsipas_RG21_%2827%29_%2848132382667%29.jpg/320px-Tsitsipas_RG21_%2827%29_%2848132382667%29.jpg',
  'Taylor Fritz': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Taylor_Fritz_at_the_2023_US_Open_%28cropped%29.jpg/320px-Taylor_Fritz_at_the_2023_US_Open_%28cropped%29.jpg'
};

export const COUNTRY_NAME_TO_CODE = {
  Spain: 'ESP', Italy: 'ITA', Serbia: 'SRB', Germany: 'GER', Russia: 'RUS', Denmark: 'DEN',
  Greece: 'GRE', Poland: 'POL', Norway: 'NOR', 'United States': 'USA', Canada: 'CAN',
  'Great Britain': 'GBR', 'United Kingdom': 'GBR', France: 'FRA', Australia: 'AUS',
  Argentina: 'ARG', Belarus: 'BLR', Kazakhstan: 'KAZ', Tunisia: 'TUN', 'Czech Republic': 'CZE',
  Czechia: 'CZE', China: 'CHN', Latvia: 'LAT', Brazil: 'BRA', Japan: 'JPN',
  'South Korea': 'KOR', Korea: 'KOR', Bulgaria: 'BUL', Chile: 'CHI', Switzerland: 'SUI',
  Belgium: 'BEL', Netherlands: 'NED', Sweden: 'SWE', Austria: 'AUT', Colombia: 'COL',
  Croatia: 'CRO', 'South Africa': 'RSA', Ukraine: 'UKR', India: 'IND',
  'Chinese Taipei': 'TPE', Taiwan: 'TPE', Romania: 'ROU', Hungary: 'HUN', Portugal: 'POR',
  Georgia: 'GEO', Finland: 'FIN', Slovakia: 'SVK', Slovenia: 'SLO', Mexico: 'MEX',
  Peru: 'PER', Uruguay: 'URU', Israel: 'ISR', Turkey: 'TUR', Türkiye: 'TUR',
  Thailand: 'THA', Indonesia: 'INA', 'New Zealand': 'NZL', Ireland: 'IRL', Egypt: 'EGY'
};

export const COUNTRY_TO_ISO2 = {
  SRB: 'rs', ESP: 'es', ITA: 'it', RUS: 'ru', GER: 'de', DEN: 'dk', GRE: 'gr', POL: 'pl', NOR: 'no',
  USA: 'us', CAN: 'ca', GBR: 'gb', FRA: 'fr', AUS: 'au', ARG: 'ar', BLR: 'by', KAZ: 'kz', TUN: 'tn',
  CZE: 'cz', CHN: 'cn', LAT: 'lv', BRA: 'br', JPN: 'jp', KOR: 'kr', BUL: 'bg', CHI: 'cl', SUI: 'ch',
  BEL: 'be', NED: 'nl', SWE: 'se', AUT: 'at', COL: 'co', CRO: 'hr', RSA: 'za', UKR: 'ua', IND: 'in',
  TPE: 'tw', ROU: 'ro', HUN: 'hu', POR: 'pt', GEO: 'ge', FIN: 'fi', SVK: 'sk', SLO: 'si', MEX: 'mx',
  PER: 'pe', URU: 'uy', ISR: 'il', TUR: 'tr', THA: 'th', INA: 'id', NZL: 'nz', IRL: 'ie', EGY: 'eg',
  ARM: 'am', MAS: 'my', TGO: 'tg', SRI: 'lk', ESA: 'sv', BOL: 'bo', BRN: 'bh', KSA: 'sa', CIV: 'ci',
  GUA: 'gt', TOG: 'tg', HAI: 'ht', LTU: 'lt', URS: 'su', JAM: 'jm', MKD: 'mk', IRI: 'ir', LIB: 'lb'
};
