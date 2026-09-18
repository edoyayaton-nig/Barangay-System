// Official Local Government Units (LGUs) and Barangays of Caraga Region (Region XIII, Philippines)
// Covers all 5 Provinces: Agusan del Norte, Agusan del Sur, Surigao del Norte, Surigao del Sur, Dinagat Islands
// and all 6 Cities: Butuan City (HUC), Cabadbaran City, Bayugan City, Surigao City, Bislig City, Tandag City

import { BUTUAN_BARANGAYS } from './barangays';

export interface CaragaLgu {
  name: string;
  province: 'Agusan del Norte' | 'Agusan del Sur' | 'Surigao del Norte' | 'Surigao del Sur' | 'Dinagat Islands';
  type: 'Highly Urbanized City' | 'Component City' | 'Municipality';
  isCity: boolean;
  barangays: string[];
}

export const CARAGA_LGUS: CaragaLgu[] = [
  // ─── AGUSAN DEL NORTE (Cities & Municipalities) ───
  {
    name: 'Butuan City',
    province: 'Agusan del Norte',
    type: 'Highly Urbanized City',
    isCity: true,
    barangays: [...BUTUAN_BARANGAYS]
  },
  {
    name: 'Cabadbaran City',
    province: 'Agusan del Norte',
    type: 'Component City',
    isCity: true,
    barangays: [
      'Antonio Luna', 'Bayabas', 'Bay-ang', 'Caasinan', 'Cabinet', 'Calamba', 'Calibunan',
      'Comagascas', 'Concepcion', 'Del Pilar', 'Katugasan', 'Kauswagan', 'La Fraternidad',
      'Mabini', 'Mahaba', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4',
      'Poblacion 5', 'Poblacion 6', 'Poblacion 7', 'Poblacion 8', 'Poblacion 9',
      'Poblacion 10', 'Poblacion 11', 'Poblacion 12', 'Puting Bato', 'Sanghan', 'Soriano', 'Tolosa'
    ]
  },
  {
    name: 'Buenavista',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Abilan', 'Agong-ong', 'Alubihid', 'Guinabsan', 'Lower Olave', 'Macalang', 'Malapong',
      'Malpoc', 'Manapa', 'Matabao', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4',
      'Poblacion 5', 'Poblacion 6', 'Poblacion 7', 'Poblacion 8', 'Poblacion 9', 'Poblacion 10',
      'Rizal', 'Sacol', 'Sangay', 'Simbalan', 'Talo-ao'
    ]
  },
  {
    name: 'Carmen',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Cahayagan', 'Gosoon', 'Manoligao', 'Poblacion', 'Rojales', 'San Agustin', 'Tagcatong', 'Vinapor']
  },
  {
    name: 'Jabonga',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'A. Beltran', 'Baleguian', 'Bangonay', 'Bunga', 'Colorado', 'Cuyago', 'Libas',
      'Magdago', 'Magsaysay', 'Maraiging', 'Poblacion', 'San Jose', 'San Pablo', 'San Vicente', 'Santo Niño'
    ]
  },
  {
    name: 'Kitcharao',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bangayan', 'Canaway', 'Hinimbangan', 'Jaliobong', 'Mahayahay', 'Poblacion', 'San Isidro', 'San Roque', 'Songkoy']
  },
  {
    name: 'Las Nieves',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Ambacon', 'Bonifacio', 'Casiklan', 'Consorcia', 'Dungga', 'Eduardo G. Montilla', 'Katipunan',
      'Lingayao', 'Malicato', 'Maningalao', 'Marcos Calo', 'Mat-i', 'Pinana-an', 'Poblacion',
      'Rosario', 'San Isidro', 'San Roque', 'Tinucoran'
    ]
  },
  {
    name: 'Magallanes',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Buhang', 'Caloc-an', 'Guiasan', 'Poblacion', 'Marcos', 'Santo Niño', 'Santo Rosario', 'Taod-oy']
  },
  {
    name: 'Nasipit',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Aclan', 'Amontay', 'Ata-Atahon', 'Camagong', 'Cubi-cubi', 'Culit', 'Jaguimitan', 'Kinabjangan',
      'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5', 'Poblacion 6',
      'Poblacion 7', 'Punta', 'Santa Ana', 'Talisay', 'Triangulo'
    ]
  },
  {
    name: 'Remedios T. Romualdez',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Balangbalang', 'Basilisa', 'Humilog', 'Panaytayon', 'Poblacion 1', 'Poblacion 2', 'San Antonio', 'Tagbuyacan']
  },
  {
    name: 'Santiago',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Curva', 'Jagupit', 'La Paz', 'Pangaylan-IP', 'Poblacion 1', 'Poblacion 2', 'San Isidro', 'Tagbuyacan']
  },
  {
    name: 'Tubay',
    province: 'Agusan del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Binuangan', 'Cabayawa', 'Doña Rosario', 'La Fraternidad', 'Lawigan', 'Poblacion 1',
      'Poblacion 2', 'Santa Ana', 'Tagmamarkay', 'Tagpangahoy', 'Tinigbasan', 'Victory'
    ]
  },

  // ─── AGUSAN DEL SUR (Cities & Municipalities) ───
  {
    name: 'Bayugan City',
    province: 'Agusan del Sur',
    type: 'Component City',
    isCity: true,
    barangays: [
      'Berseba', 'Bucac', 'Cagbas', 'Calaitan', 'Canayugan', 'Charito', 'Claro Cortez', 'Fili',
      'Gamao', 'Getsemane', 'Grace Estate', 'Hamogaway', 'Katipunan', 'Mabuhay', 'Magkiangkang',
      'Mahayag', 'Marcelina', 'Maygatasan', 'Montévista', 'Mt. Ararat', 'Mt. Carmel', 'Mt. Olive',
      'New Salem', 'Noli', 'Osmeña', 'Panaytayon', 'Pinagalaan', 'Poblacion', 'Sagacan', 'Sagmone',
      'Salvacion', 'San Agustin', 'San Antonio', 'San Isidro', 'San Juan', 'San Lorenzo', 'Santa Irene',
      'Santa Teresita', 'Santo Niño', 'Taglatawan', 'Taglibas', 'Taglinao', 'Verdu', 'Villa Undayon'
    ]
  },
  {
    name: 'San Francisco',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Alegria', 'Bitan-agan', 'Borbon', 'Caimpugan', 'Ebro', 'Hubang', 'Lapinigan', 'Lucena',
      'New Visayas', 'Pasta', 'Pisa-an', 'Barangay 1 (Poblacion)', 'Barangay 2 (Poblacion)',
      'Barangay 3 (Poblacion)', 'Barangay 4 (Poblacion)', 'Barangay 5 (Poblacion)', 'Rizal',
      'San Flores', 'San Isidro', 'Santa Ana'
    ]
  },
  {
    name: 'Prosperidad',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Aurora', 'Awa', 'Azpetia', 'La Caridad', 'La Suerte', 'La Union', 'Las Navas', 'Los Arcos',
      'Lucena', 'Mabuhay', 'Magsaysay', 'Mapaga', 'New Maug', 'Napo', 'Patin-ay', 'Poblacion',
      'Salimbogaon', 'Salvacion', 'San Joaquin', 'San Jose', 'San Lorenzo', 'San Martin', 'San Pedro',
      'San Rafael', 'San Salvador', 'San Vicente', 'Santa Irene', 'Santa Maria'
    ]
  },
  {
    name: 'Bunawan',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bunawan Brook', 'Consuelo', 'Imelda', 'Libertad', 'Mambalili', 'Nueva Era', 'Poblacion', 'San Andres', 'San Marcos', 'San Teodoro']
  },
  {
    name: 'Esperanza',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Agsabu', 'Bakingking', 'Bentahon', 'Bunaguit', 'Catmonon', 'Cebulan', 'Crossing Luna', 'Dakutan',
      'Duangan', 'Guadalupe', 'Guibonon', 'Hawilian', 'Labao', 'Maasin', 'Mahagkot', 'Milagros',
      'Nato', 'New Gingoog', 'Odiong', 'Oro', 'Piglawigan', 'Poblacion', 'Remedios', 'Salug',
      'San Isidro', 'San Jose', 'San Toribio', 'Santa Fe', 'Segunda', 'Sinakungan', 'Tagbalili', 'Tahina', 'Tandang Sora', 'Valentia'
    ]
  },
  {
    name: 'La Paz',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bataan', 'Comota', 'Halapitan', 'Langasian', 'Osmeña', 'Poblacion', 'Sagunto', 'San Patricio', 'Valentina', 'Villangit']
  },
  {
    name: 'Loreto',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Binucayan', 'Johnson', 'Magaud', 'Nueva Gracia', 'Poblacion', 'Sabud', 'San Isidro', 'San Mariano', 'San Vicente', 'Santa Teresa', 'Santo Tomas', 'Violanta']
  },
  {
    name: 'Rosario',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bayugan 3', 'Cabantao', 'Cabawan', 'Marfil', 'Novele', 'Poblacion', 'Santa Cruz', 'Tagbina', 'Wasian']
  },
  {
    name: 'San Luis',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Anislagan', 'Balit', 'Baylo', 'Coalicion', 'Doña Flavia', 'Mahagsay', 'Mahaplag', 'Nuevo Trabajo', 'Poblacion', 'San Isidro', 'San Pedro', 'Santa Ines']
  },
  {
    name: 'Santa Josefa',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Angas', 'Aurora', 'Awao', 'Concepcion', 'Pag-asa', 'Patrocinio', 'Poblacion', 'San Jose', 'Santa Isabel', 'Sayon', 'Tapaz']
  },
  {
    name: 'Sibagat',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Anahauan', 'Banagbanag', 'Del Rosario', 'El Rio', 'Ilihan', 'Kauswagan', 'Kolambugan', 'Magsaysay',
      'Mahayahay', 'New Tubigon', 'Pagsabangan', 'Perez', 'Poblacion', 'San Isidro', 'San Vicente', 'Santa Cruz', 'Santa Maria', 'Tabontabon'
    ]
  },
  {
    name: 'Talacogon',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Batucan', 'Buena Gracia', 'Causwagan', 'Culi', 'Del Monte', 'Desamparados', 'Labnig', 'Maharlika', 'Marbon', 'Poblacion', 'Sabang Gibong', 'San Agustin', 'San Isidro', 'San Nicolas', 'Zamora']
  },
  {
    name: 'Trento',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Basa', 'Cuevas', 'Kapatungan', 'Langkila-an', 'Manat', 'New Visayas', 'Poblacion', 'Pulang Lupa', 'Salvacion', 'San Ignacio', 'San Isidro', 'San Roque', 'Santa Maria', 'Tudela']
  },
  {
    name: 'Veruela',
    province: 'Agusan del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Anitap', 'Bacungan', 'Binongan', 'Caigangan', 'Candiis', 'Del Monte', 'Don Mateo', 'La Fortuna', 'Limot', 'Magsaysay', 'Masayan', 'Poblacion', 'Sampaguita', 'San Gabriel', 'Santa Cruz', 'Santa Emelia', 'Sinobong']
  },

  // ─── SURIGAO DEL NORTE (Cities & Municipalities) ───
  {
    name: 'Surigao City',
    province: 'Surigao del Norte',
    type: 'Component City',
    isCity: true,
    barangays: [
      'Alang-alang', 'Alegria', 'Anomar', 'Aurora', 'Balibayon', 'Baybay', 'Bilabid', 'Bitaugan',
      'Bonifacio', 'Buenavista', 'Cabontoy', 'Cagdianao', 'Cagutsan', 'Canlanipa', 'Cantiasay',
      'Capalayan', 'Catadman', 'Danawan', 'Day-as', 'Ipil', 'Libuac', 'Lipata', 'Lisondra', 'Luna',
      'Mabini', 'Mabua', 'Manyagao', 'Mapawa', 'Mat-i', 'Nabago', 'Nonoc', 'Orok', 'Poctoy',
      'Punta Bilar', 'Quezon', 'Rizal', 'Sabang', 'San Isidro', 'San Jose', 'San Juan', 'San Pedro',
      'San Roque', 'Serna', 'Sidlakan', 'Silop', 'Sugar', 'Sukailang', 'Taft', 'Talisay', 'Togbongon',
      'Trinidad', 'Washington', 'Zaragosa'
    ]
  },
  {
    name: 'Alegria',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Alipao', 'Amontay', 'Anahaw', 'Budlingin', 'Camp Edward', 'Ferlda', 'Gamuton', 'Julio Ouano', 'Ombong', 'Poblacion', 'San Juan', 'San Pedro']
  },
  {
    name: 'Bacuag',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Cabugao', 'Cambuayon', 'Campo', 'Dugsangon', 'Pambuan', 'Payapag', 'Poblacion', 'Pungtod', 'Santo Rosario']
  },
  {
    name: 'Burgos',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Baybay', 'Bitaug', 'Matin-ao', 'Poblacion 1', 'Poblacion 2', 'San Mateo']
  },
  {
    name: 'Claver',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Cabugo', 'Cagdianao', 'Daywan', 'Hayanggabon', 'Ladgaron', 'Lapinigan', 'Magallanes', 'Panatao', 'Poblacion', 'Sapa', 'Taganito', 'Urbiztondo']
  },
  {
    name: 'Dapa',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Bagakay', 'Barangay 1 (Poblacion)', 'Barangay 2 (Poblacion)', 'Barangay 3 (Poblacion)', 'Barangay 4 (Poblacion)',
      'Barangay 5 (Poblacion)', 'Barangay 6 (Poblacion)', 'Barangay 7 (Poblacion)', 'Barangay 8 (Poblacion)', 'Barangay 9 (Poblacion)',
      'Barangay 10 (Poblacion)', 'Barangay 11 (Poblacion)', 'Barangay 12 (Poblacion)', 'Barangay 13 (Poblacion)',
      'Bacjao', 'Cabawa', 'Cambas-ac', 'Corregidor', 'Dagho', 'Montserrat', 'Osmeña', 'San Carlos', 'San Miguel', 'Santa Fe', 'Union'
    ]
  },
  {
    name: 'Del Carmen',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Antipolo', 'Bagakay', 'Bitoon', 'Cabugao', 'Cancohoy', 'Caub', 'Esperanza', 'Halian',
      'Jamoyaon', 'Katipunan', 'Lobogon', 'Mabuhay', 'Mahayahay', 'Poblacion', 'San Fernando', 'San Jose', 'Sayak', 'Tuboran'
    ]
  },
  {
    name: 'General Luna',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Anajawan', 'Cabitoonan', 'Catangnan', 'Consuelo', 'Coring', 'Daku', 'La Januza', 'Libertad',
      'Magsaysay', 'Malinao', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5',
      'Santa Cruz', 'Santa Fe', 'Suyangan', 'Tawin-tawin'
    ]
  },
  {
    name: 'Gigaquit',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Alambique', 'Anibongan', 'Camam-onan', 'Cambreven', 'Ipil', 'Lahi', 'Mahanub', 'Poniente', 'San Antonio', 'San Isidro', 'Sani-sani', 'Villaflor', 'Villafranca']
  },
  {
    name: 'Mainit',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Bingacon', 'Bobona-on', 'Cantugas', 'Dayano', 'Mabini', 'Magpayang', 'Magsaysay',
      'Mansayao', 'Marayag', 'Matin-ao', 'Paco', 'Poblacion', 'Quezon', 'San Francisco', 'San Isidro', 'San Roque', 'Silop', 'Tagbuyawan', 'Tapi-an', 'Tolingon'
    ]
  },
  {
    name: 'Malimono',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Binucayan', 'Cansayuda', 'Cantapoy', 'Cayawan', 'Doro', 'Hababagay', 'Hanagdong', 'Karihatag', 'Masgad', 'Pili', 'Poblacion', 'San Isidro', 'Tinago', 'Villarica']
  },
  {
    name: 'Pilar',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Asinan', 'Caridad', 'Centro', 'Consuelo', 'Datu', 'Dayhagan', 'Jaboy', 'Katipunan', 'Maasin', 'Mabini', 'Mabuhay', 'Pilaring', 'Poblacion', 'Salvacion', 'San Roque']
  },
  {
    name: 'Placer',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Amoslog', 'Anislagan', 'Bad-as', 'Boyongan', 'Bugas-bugas', 'Central', 'Ellaperal', 'Ipil',
      'Lakandula', 'Mabini', 'Magsaysay', 'Magupange', 'Panikian', 'Poblacion', 'San Isidro', 'San Jose', 'Santa Cruz', 'Suyoc', 'Tagbongabong'
    ]
  },
  {
    name: 'San Benito',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bongdo', 'Maribojoc', 'Nuevo Campo', 'Poblacion', 'San Juan', 'Talisay']
  },
  {
    name: 'San Francisco (Anao-aon)',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Amontay', 'Balite', 'Banbanon', 'Diaz', 'Honrado', 'Linungganan', 'Macopa', 'Magtangale', 'Osmeña', 'Poblacion', 'San Panganuran']
  },
  {
    name: 'San Isidro',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Buhing Calipay', 'Del Carmen', 'Del Pilar', 'Macapagal', 'Pacifico', 'Pelaez', 'Poblacion', 'Roxas', 'San Miguel', 'Santa Paz', 'Santo Niño', 'Tigbawan']
  },
  {
    name: 'Santa Monica (Sapao)',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Abad Santos', 'Alegria', 'Bailan', 'Garcia', 'Libertad', 'Mabini', 'Mabuhay', 'Magsaysay', 'Poblacion', 'Rizal', 'T. Arlan']
  },
  {
    name: 'Sison',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Biyabid', 'Gakao', 'Ima', 'Lower Biyabid', 'Mabuhay', 'Mayag', 'Poblacion', 'San Isidro', 'San Pablo', 'San Pedro', 'Santa Cruz', 'Upper Patag']
  },
  {
    name: 'Socorro',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Albay', 'Delingnan', 'Helene', 'Honrado', 'Navarro', 'Nueva Estrella', 'Pamosaingan', 'Poblacion', 'Rizal', 'Salog', 'San Roque', 'Santa Cruz', 'Songkoy', 'Sudlon']
  },
  {
    name: 'Tagana-an',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Azucena', 'Banban', 'Cawilan', 'Fabrica', 'Himama-ug', 'Laperian', 'Lower Libas', 'Opong', 'Patino', 'Poblacion', 'Sampaguita', 'Talavera', 'Union', 'Upper Libas']
  },
  {
    name: 'Tubod',
    province: 'Surigao del Norte',
    type: 'Municipality',
    isCity: false,
    barangays: ['Capayahan', 'Cawilan', 'Del Rosario', 'Marga', 'Motorpool', 'Poblacion', 'San Isidro', 'San Ricaredo', 'Timamana']
  },

  // ─── SURIGAO DEL SUR (Cities & Municipalities) ───
  {
    name: 'Bislig City',
    province: 'Surigao del Sur',
    type: 'Component City',
    isCity: true,
    barangays: [
      'Bucto', 'Burboanan', 'Caguyao', 'Coleto', 'Comawas', 'Kahayag', 'Labangal', 'Lawigan',
      'Maharlika', 'Mangagoy', 'Mone', 'Pamanlinan', 'Pamaypayan', 'Poblacion', 'San Antonio',
      'San Fernando', 'San Isidro', 'San Jose', 'San Roque', 'San Vicente', 'Santa Cruz', 'Sibaroy', 'Tabon', 'Tisa'
    ]
  },
  {
    name: 'Tandag City',
    province: 'Surigao del Sur',
    type: 'Component City',
    isCity: true,
    barangays: [
      'Awasian', 'Bag-ong Lungsod', 'Bioto', 'Bongtod', 'Buenavista', 'Dagocdoc', 'Mabua', 'Mabuhay',
      'Maitum', 'Maticdum', 'Pandanon', 'Pangi', 'Quezon', 'Rosario', 'Salvacion', 'San Agustin Norte',
      'San Agustin Sur', 'San Antonio', 'San Isidro', 'San Jose', 'Telaje'
    ]
  },
  {
    name: 'Barobo',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Amaga', 'Bahi', 'Cabacungan', 'Cambang-on', 'Chemar', 'Dapdap', 'Javier', 'Kinayan',
      'Magsaysay', 'Poblacion', 'Rizal', 'San Antonio', 'San Jose', 'San Roque', 'San Vicente',
      'Sua', 'Sudlon', 'Tambis', 'Unidad', 'Wakat'
    ]
  },
  {
    name: 'Bayabas',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Amag', 'Balete', 'Cabugo', 'Cagba-oto', 'La Paz', 'Magobawok', 'Panaon', 'Poblacion']
  },
  {
    name: 'Cagwait',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Aras-asan', 'Baculin', 'Bitaugan East', 'Bitaugan West', 'La Purisima', 'Macton', 'Mat-i', 'Poblacion', 'Tubigan', 'Tawagan', 'Unidad']
  },
  {
    name: 'Cantilan',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Buntalid', 'Cabangahan', 'Cabugao', 'Calagdaan', 'Consuelo', 'General Island', 'Lininti-an',
      'Lobo', 'Magasaysay', 'Magosilom', 'Pag-Antayan', 'Palasao', 'Parang', 'Poblacion', 'San Pedro', 'Tapi', 'Tigabongan'
    ]
  },
  {
    name: 'Carmen',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Antao', 'Cancavan', 'Esperanza', 'Gacub', 'Hinapuyan', 'Poblacion', 'San Jose', 'Santa Cruz']
  },
  {
    name: 'Carrascal',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Adlay', 'Babuyan', 'Bacolod', 'Baybay', 'Bon-ot', 'Caglayag', 'Dahican', 'Doyos', 'Embarcadero', 'Gamut', 'Panikian', 'Pantukan', 'Poblacion', 'Saca']
  },
  {
    name: 'Cortes',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Balibadon', 'Burgos', 'Capandan', 'Mabahin', 'Madrelino', 'Manlico', 'Matho', 'Poblacion', 'Pugova', 'Tag-anongan', 'Tuboran', 'Uba']
  },
  {
    name: 'Hinatuan',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Bigaan', 'Cambatong', 'Campa', 'Dugmanon', 'Harip', 'La Casa', 'Loyola', 'Maligaya',
      'Pagtilaan', 'Poblacion', 'Port Lamon', 'San Juan', 'Sasa', 'Tagasaka', 'Talisay', 'Tarusan', 'Tidman', 'Tiwi'
    ]
  },
  {
    name: 'Lanuza',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Agunan', 'Bocawe', 'Bunga', 'Gamut', 'Habag', 'Mampuyog', 'Nurcia', 'Pakil', 'Poblacion', 'Sibahay']
  },
  {
    name: 'Lianga',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Ban-as', 'Banahao', 'Baucawe', 'Diabot', 'Ganayon', 'Liatimco', 'Manyayao', 'Payasan', 'Poblacion', 'Saint Christine', 'San Isidro', 'San Pedro']
  },
  {
    name: 'Lingig',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Anibongan', 'Barcelona', 'Bogak', 'Bonglo', 'Handangan', 'Mahayahay', 'Mandus', 'Mansang-an', 'Poblacion', 'Pagtilaan', 'Rajah Cabungsuan', 'San Roque', 'Tagbina', 'Union', 'Valencia']
  },
  {
    name: 'Madrid',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bagnan', 'Bayogo', 'Linibonan', 'Magsaysay', 'Manga', 'Panaygon', 'Patong Patong', 'Poblacion', 'San Antonio', 'San Juan', 'San Roque', 'San Vicente', 'Songkit', 'Union']
  },
  {
    name: 'Marihatag',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Alegria', 'Amontay', 'Antipolo', 'Arorogan', 'Bayabas', 'Mararag', 'Poblacion', 'San Antonio', 'San Isidro', 'San Pedro', 'Santa Cruz']
  },
  {
    name: 'San Agustin',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bretania', 'Buatong', 'Buhisan', 'Gata', 'Hornasan', 'Janipaan', 'Kauswagan', 'Oteiza', 'Poblacion', 'Pontevedra', 'Salvio', 'Santo Niño', 'Sibahay']
  },
  {
    name: 'San Miguel',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bagyang', 'Baras', 'Bitoon', 'Bolhoon', 'Cal-o', 'Carromata', 'Castillo', 'Gumamela', 'Libas Gua', 'Magroyong', 'Mahayag', 'Patong', 'Poblacion', 'San Roque', 'Siagao', 'Tina', 'Umalag']
  },
  {
    name: 'Tagbina',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Batunan', 'Bongtod', 'Cagba-oto', 'Carpenito', 'Doña Carmen', 'Hinagdanan', 'Kahayagan',
      'Lago', 'Maglambing', 'Maglatab', 'Magsaysay', 'Malixi', 'Manambia', 'Osmeña', 'Poblacion',
      'Quezon', 'San Vicente', 'Santa Cruz', 'Santa Fe', 'Santa Maria', 'Sayon', 'Soriano', 'Tagongon', 'Trinidad', 'Ubos'
    ]
  },
  {
    name: 'Tago',
    province: 'Surigao del Sur',
    type: 'Municipality',
    isCity: false,
    barangays: [
      'Alba', 'Anahao Bag-o', 'Anahao Daan', 'Badong', 'Bajao', 'Bangsud', 'Cabangahan', 'Cagdapao',
      'Camancan', 'Carcang', 'Dayo-an', 'Gamut', 'Jubang', 'Kinabigtasan', 'Layog', 'Lindaban',
      'Mercedes', 'Purisima', 'San Antonio', 'San Isidro', 'San Pedro', 'San Roque', 'Sumo-sumo', 'Unaban', 'Victoria'
    ]
  },

  // ─── DINAGAT ISLANDS (Municipalities) ───
  {
    name: 'San Jose',
    province: 'Dinagat Islands',
    type: 'Municipality',
    isCity: false,
    barangays: ['Aurelio', 'Cuarinta', 'Don Ruben Ecleo', 'Jacquez', 'Justiniana Edera', 'Luna', 'Mahayahay', 'Matingbe', 'Poblacion', 'San Jose', 'San Juan', 'Santa Cruz']
  },
  {
    name: 'Basilisa (Rizal)',
    province: 'Dinagat Islands',
    type: 'Municipality',
    isCity: false,
    barangays: ['Benglen', 'Catadman', 'Columbus', 'Coring', 'Cortes', 'Diegas', 'Doña Helene', 'Edera', 'Ferdinand', 'Geotina', 'Imee', 'Melgar', 'Navarro', 'New Nazareth', 'Poblacion', 'Puerto Princesa', 'Rita Glenda', 'Roma', 'Roxas', 'San Jose', 'San Miguel', 'San Vicente', 'Santa Monica', 'Santo Niño', 'Sering', 'Sombrado', 'Tag-abaca']
  },
  {
    name: 'Cagdianao',
    province: 'Dinagat Islands',
    type: 'Municipality',
    isCity: false,
    barangays: ['Boa', 'Cabunga-an', 'Del Rosario', 'Gaas', 'Laguna', 'Legaspi', 'Ma-atas', 'Mabini', 'Nueva Estrella', 'Poblacion', 'R. Ecleo Sr.', 'San Jose', 'Santa Rita', 'Tigbao']
  },
  {
    name: 'Dinagat',
    province: 'Dinagat Islands',
    type: 'Municipality',
    isCity: false,
    barangays: ['Bagumbayan', 'Cab-ilan', 'Cabawan', 'Cayetano', 'Escolta', 'Gomez', 'Magsaysay', 'Mauswagon', 'New Mabuhay', 'Plaridel', 'Poblacion', 'Wadas']
  },
  {
    name: 'Libjo (Albor)',
    province: 'Dinagat Islands',
    type: 'Municipality',
    isCity: false,
    barangays: ['Albor', 'Arellano', 'Bayani', 'Doña Helen', 'General Aguinaldo', 'Kanihaan', 'Magsaysay', 'Osmeña', 'Plaridel', 'Poblacion', 'Quezon', 'Rosita', 'San Antonio', 'San Jose', 'Santo Niño', 'Tubigon']
  },
  {
    name: 'Loreto',
    province: 'Dinagat Islands',
    type: 'Municipality',
    isCity: false,
    barangays: ['Carmen', 'Esperanza', 'Ferdinand', 'Helene', 'Magsaysay', 'Panamaon', 'Poblacion', 'San Juan', 'Santa Cruz', 'Santiago']
  },
  {
    name: 'Tubajon',
    province: 'Dinagat Islands',
    type: 'Municipality',
    isCity: false,
    barangays: ['Diaz', 'Imelda', 'Mabini', 'Malinao', 'Navarro', 'Poblacion', 'San Roque', 'San Vicente', 'Santa Cruz']
  }
];

/**
 * Returns all LGUs in Agusan del Norte only (Cities & Municipalities)
 */
export const AGUSAN_DEL_NORTE_LGUS = CARAGA_LGUS.filter(lgu => lgu.province === 'Agusan del Norte');

export function getAgusanDelNorteLgus(): CaragaLgu[] {
  return AGUSAN_DEL_NORTE_LGUS;
}

/**
 * Returns all LGUs in Caraga Region
 */
export function getCaragaLgus(): CaragaLgu[] {
  return CARAGA_LGUS;
}

/**
 * Returns only the cities in Caraga Region
 */
export function getCaragaCities(): CaragaLgu[] {
  return CARAGA_LGUS.filter((lgu) => lgu.isCity);
}

/**
 * Finds an LGU by exact or normalized name
 */
export function findCaragaLgu(cityName?: string): CaragaLgu | undefined {
  if (!cityName) return undefined;
  const clean = cityName.toLowerCase().trim();
  return CARAGA_LGUS.find(
    (lgu) =>
      lgu.name.toLowerCase() === clean ||
      lgu.name.toLowerCase().replace(/\s+city$/i, '') === clean.replace(/\s+city$/i, '')
  );
}

/**
 * Returns the list of official barangays for a given city or municipality in Agusan del Norte / Caraga
 * Defaults to Butuan City's 86 barangays if not found or empty
 */
export function getBarangaysForCity(cityName?: string): string[] {
  if (!cityName) return [...BUTUAN_BARANGAYS];
  const lgu = findCaragaLgu(cityName);
  if (lgu && lgu.barangays && lgu.barangays.length > 0) {
    return lgu.barangays;
  }
  // Default to Butuan City if Butuan or unrecognized
  if (cityName.toLowerCase().includes('butuan')) {
    return [...BUTUAN_BARANGAYS];
  }
  return [...BUTUAN_BARANGAYS];
}

