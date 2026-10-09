import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { dbConfig } from './config/db.js';
dotenv.config();

export async function migrateAndSeedCensus() {
  const { host, port, user, password, database: dbName } = dbConfig;

  console.log(`Connecting to ${dbName} at ${host}:${port}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database: dbName });

  async function safeAddCol(col, definition) {
    try {
      const [cols] = await conn.query(`SHOW COLUMNS FROM residents LIKE ?`, [col]);
      if (cols.length === 0) {
        await conn.query(`ALTER TABLE residents ADD COLUMN ${col} ${definition}`);
        console.log(`Added column ${col} to residents table.`);
      }
    } catch (e) {
      console.warn(`safeAddCol(${col}) notice:`, e.message);
    }
  }

  // 1. Ensure columns exist
  await safeAddCol('household_number', "VARCHAR(50) DEFAULT NULL");
  await safeAddCol('family_name', "VARCHAR(100) DEFAULT NULL");
  await safeAddCol('is_head_of_household', "TINYINT(1) DEFAULT 0");
  await safeAddCol('relationship_to_head', "VARCHAR(50) DEFAULT 'Member'");
  await safeAddCol('employment_status', "VARCHAR(50) DEFAULT 'Employed'");

  // 2. Backfill existing residents in smart_db if any household_number is null
  const [existing] = await conn.query("SELECT id, first_name, last_name, purok, date_of_birth, household_number FROM residents");
  console.log(`Found ${existing.length} existing residents.`);

  // Group existing by Purok and assign households
  for (let i = 0; i < existing.length; i++) {
    const r = existing[i];
    if (!r.household_number) {
      const p = r.purok ? r.purok.replace(/purok\s*/i, '').trim() : '1';
      const hhNum = `HH-P${p}-${String(Math.floor(i / 3) + 1).padStart(3, '0')}`;
      const famName = r.last_name || 'Resident';
      const isHead = (i % 3 === 0) ? 1 : 0;
      const rel = isHead ? 'Head' : (i % 3 === 1 ? 'Spouse' : 'Child');
      
      // Compute employment status based on birth date if available
      let emp = 'Employed';
      if (r.date_of_birth) {
        const age = new Date().getFullYear() - new Date(r.date_of_birth).getFullYear();
        if (age >= 60) {
          emp = i % 2 === 0 ? 'Retired' : 'Employed';
        } else if (age < 18) {
          emp = 'Student';
        } else {
          emp = i % 4 === 0 ? 'Unemployed' : 'Employed';
        }
      }

      await conn.query(`
        UPDATE residents 
        SET household_number = ?, family_name = ?, is_head_of_household = ?, relationship_to_head = ?, employment_status = ?
        WHERE id = ?
      `, [hhNum, famName, isHead, rel, emp, r.id]);
    }
  }

  // 3. Ensure all 7 Puroks (Purok 1 through Purok 7) have rich, realistic household data for Barangay Pianing
  // Check count of residents in each Purok
  const [purokCounts] = await conn.query(`
    SELECT purok, COUNT(*) as count FROM residents GROUP BY purok
  `);
  const existingPuroks = new Set(purokCounts.map(p => (p.purok || '').toString().replace(/purok\s*/i, '').trim()));

  const seedPuroksData = [
    {
      purok: '1',
      households: [
        {
          hh: 'HH-P1-001',
          family: 'Dela Cruz',
          members: [
            { first: 'Juan', last: 'Dela Cruz', dob: '1962-05-14', gender: 'Male', civil: 'Married', rel: 'Head', isHead: 1, emp: 'Employed' }, // Senior 64yo Male
            { first: 'Corazon', last: 'Dela Cruz', dob: '1965-09-20', gender: 'Female', civil: 'Married', rel: 'Spouse', isHead: 0, emp: 'Self-Employed' }, // Senior 61yo Female
            { first: 'Mark', last: 'Dela Cruz', dob: '1996-03-10', gender: 'Male', civil: 'Single', rel: 'Son', isHead: 0, emp: 'Employed' },
            { first: 'Jenny', last: 'Dela Cruz', dob: '2012-11-05', gender: 'Female', civil: 'Single', rel: 'Daughter', isHead: 0, emp: 'Student' } // Child 13yo
          ]
        },
        {
          hh: 'HH-P1-002',
          family: 'Santos',
          members: [
            { first: 'Roberto', last: 'Santos', dob: '1978-02-18', gender: 'Male', civil: 'Married', rel: 'Head', isHead: 1, emp: 'Employed' },
            { first: 'Elena', last: 'Santos', dob: '1981-07-22', gender: 'Female', civil: 'Married', rel: 'Spouse', isHead: 0, emp: 'Unemployed' },
            { first: 'Angelo', last: 'Santos', dob: '2010-04-12', gender: 'Male', civil: 'Single', rel: 'Son', isHead: 0, emp: 'Student' } // Child
          ]
        }
      ]
    },
    {
      purok: '2',
      households: [
        {
          hh: 'HH-P2-001',
          family: 'Mendoza',
          members: [
            { first: 'Guillermo', last: 'Mendoza', dob: '1958-10-12', gender: 'Male', civil: 'Widowed', rel: 'Head', isHead: 1, emp: 'Retired' }, // Senior 67yo Male
            { first: 'Eduardo', last: 'Mendoza', dob: '1986-04-05', gender: 'Male', civil: 'Married', rel: 'Son', isHead: 0, emp: 'Employed' },
            { first: 'Lourdes', last: 'Mendoza', dob: '1989-08-19', gender: 'Female', civil: 'Married', rel: 'Daughter-in-law', isHead: 0, emp: 'Employed' },
            { first: 'Gabriel', last: 'Mendoza', dob: '2016-01-30', gender: 'Male', civil: 'Single', rel: 'Grandson', isHead: 0, emp: 'Student' } // Child
          ]
        },
        {
          hh: 'HH-P2-002',
          family: 'Villanueva',
          members: [
            { first: 'Arnel', last: 'Villanueva', dob: '1984-12-03', gender: 'Male', civil: 'Married', rel: 'Head', isHead: 1, emp: 'Employed' },
            { first: 'Marites', last: 'Villanueva', dob: '1987-03-25', gender: 'Female', civil: 'Married', rel: 'Spouse', isHead: 0, emp: 'Unemployed' }
          ]
        }
      ]
    },
    {
      purok: '3',
      households: [
        {
          hh: 'HH-P3-001',
          family: 'Bautista',
          members: [
            { first: 'Rosalinda', last: 'Bautista', dob: '1955-08-14', gender: 'Female', civil: 'Widowed', rel: 'Head', isHead: 1, emp: 'Retired' }, // Senior 71yo Female
            { first: 'Noel', last: 'Bautista', dob: '1980-06-21', gender: 'Male', civil: 'Married', rel: 'Son', isHead: 0, emp: 'Employed' },
            { first: 'Grace', last: 'Bautista', dob: '1983-09-15', gender: 'Female', civil: 'Married', rel: 'Daughter-in-law', isHead: 0, emp: 'Unemployed' },
            { first: 'Chloe', last: 'Bautista', dob: '2014-05-18', gender: 'Female', civil: 'Single', rel: 'Granddaughter', isHead: 0, emp: 'Student' } // Child
          ]
        },
        {
          hh: 'HH-P3-002',
          family: 'Flores',
          members: [
            { first: 'Danilo', last: 'Flores', dob: '1961-01-11', gender: 'Male', civil: 'Married', rel: 'Head', isHead: 1, emp: 'Employed' }, // Senior 65yo Male
            { first: 'Norma', last: 'Flores', dob: '1964-07-09', gender: 'Female', civil: 'Married', rel: 'Spouse', isHead: 0, emp: 'Retired' }, // Senior 62yo Female
            { first: 'Christian', last: 'Flores', dob: '1992-11-28', gender: 'Male', civil: 'Single', rel: 'Son', isHead: 0, emp: 'Employed' }
          ]
        }
      ]
    },
    {
      purok: '4',
      households: [
        {
          hh: 'HH-P4-001',
          family: 'Reyes',
          members: [
            { first: 'Antonio', last: 'Reyes', dob: '1975-03-29', gender: 'Male', civil: 'Married', rel: 'Head', isHead: 1, emp: 'Employed' },
            { first: 'Carmela', last: 'Reyes', dob: '1977-10-14', gender: 'Female', civil: 'Married', rel: 'Spouse', isHead: 0, emp: 'Employed' },
            { first: 'Bea', last: 'Reyes', dob: '2011-09-02', gender: 'Female', civil: 'Single', rel: 'Daughter', isHead: 0, emp: 'Student' } // Child
          ]
        },
        {
          hh: 'HH-P4-002',
          family: 'Navarro',
          members: [
            { first: 'Felicidad', last: 'Navarro', dob: '1952-04-18', gender: 'Female', civil: 'Widowed', rel: 'Head', isHead: 1, emp: 'Retired' }, // Senior 74yo Female
            { first: 'Rogelio', last: 'Navarro', dob: '1979-05-22', gender: 'Male', civil: 'Single', rel: 'Son', isHead: 0, emp: 'Unemployed' }
          ]
        }
      ]
    },
    {
      purok: '5',
      households: [
        {
          hh: 'HH-P5-001',
          family: 'Castro',
          members: [
            { first: 'Benjamin', last: 'Castro', dob: '1960-12-05', gender: 'Male', civil: 'Married', rel: 'Head', isHead: 1, emp: 'Employed' }, // Senior 65yo Male
            { first: 'Lydia', last: 'Castro', dob: '1963-04-16', gender: 'Female', civil: 'Married', rel: 'Spouse', isHead: 0, emp: 'Unemployed' }, // Senior 63yo Female
            { first: 'Paolo', last: 'Castro', dob: '1995-07-25', gender: 'Male', civil: 'Single', rel: 'Son', isHead: 0, emp: 'Employed' },
            { first: 'Princess', last: 'Castro', dob: '2015-12-10', gender: 'Female', civil: 'Single', rel: 'Granddaughter', isHead: 0, emp: 'Student' } // Child
          ]
        }
      ]
    },
    {
      purok: '6',
      households: [
        {
          hh: 'HH-P6-001',
          family: 'Aquino',
          members: [
            { first: 'Severino', last: 'Aquino', dob: '1957-02-14', gender: 'Male', civil: 'Married', rel: 'Head', isHead: 1, emp: 'Retired' }, // Senior 69yo Male
            { first: 'Teresita', last: 'Aquino', dob: '1960-09-08', gender: 'Female', civil: 'Married', rel: 'Spouse', isHead: 0, emp: 'Retired' }, // Senior 66yo Female
            { first: 'Dennis', last: 'Aquino', dob: '1988-06-19', gender: 'Male', civil: 'Married', rel: 'Son', isHead: 0, emp: 'Employed' },
            { first: 'Rhea', last: 'Aquino', dob: '1990-01-27', gender: 'Female', civil: 'Married', rel: 'Daughter-in-law', isHead: 0, emp: 'Unemployed' },
            { first: 'Ethan', last: 'Aquino', dob: '2017-08-14', gender: 'Male', civil: 'Single', rel: 'Grandson', isHead: 0, emp: 'Student' } // Child
          ]
        }
      ]
    },
    {
      purok: '7',
      households: [
        {
          hh: 'HH-P7-001',
          family: 'Pascual',
          members: [
            { first: 'Vicente', last: 'Pascual', dob: '1959-11-30', gender: 'Male', civil: 'Married', rel: 'Head', isHead: 1, emp: 'Employed' }, // Senior 66yo Male
            { first: 'Remedios', last: 'Pascual', dob: '1962-03-12', gender: 'Female', civil: 'Married', rel: 'Spouse', isHead: 0, emp: 'Self-Employed' }, // Senior 64yo Female
            { first: 'Jayson', last: 'Pascual', dob: '1994-08-04', gender: 'Male', civil: 'Single', rel: 'Son', isHead: 0, emp: 'Unemployed' },
            { first: 'Aaliyah', last: 'Pascual', dob: '2013-05-20', gender: 'Female', civil: 'Single', rel: 'Daughter', isHead: 0, emp: 'Student' } // Child
          ]
        }
      ]
    }
  ];

  for (const pGroup of seedPuroksData) {
    for (const hh of pGroup.households) {
      for (const m of hh.members) {
        // Check if member already exists by first_name and last_name
        const [existingMember] = await conn.query(
          "SELECT id FROM residents WHERE first_name = ? AND last_name = ? LIMIT 1",
          [m.first, m.last]
        );

        if (existingMember.length === 0) {
          const email = `${m.first.toLowerCase()}.${m.last.toLowerCase().replace(/\s+/g, '')}@pianing.gov`;
          const address = `Purok ${pGroup.purok}, Barangay Pianing, Butuan City`;
          await conn.query(`
            INSERT INTO residents (
              first_name, last_name, date_of_birth, gender, civil_status,
              address, purok, barangay, phone, email, verification_status,
              household_number, family_name, is_head_of_household, relationship_to_head, employment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pianing', '09171234567', ?, 'Verified', ?, ?, ?, ?, ?)
          `, [
            m.first, m.last, m.dob, m.gender, m.civil,
            address, pGroup.purok, email,
            hh.hh, hh.family, m.isHead, m.rel, m.emp
          ]);
          console.log(`Seeded resident ${m.first} ${m.last} in ${hh.hh} (Purok ${pGroup.purok}).`);
        } else {
          // Update household details
          await conn.query(`
            UPDATE residents 
            SET household_number = ?, family_name = ?, is_head_of_household = ?, relationship_to_head = ?, employment_status = ?, purok = ?
            WHERE id = ?
          `, [hh.hh, hh.family, m.isHead, m.rel, m.emp, pGroup.purok, existingMember[0].id]);
        }
      }
    }
  }

  console.log("Census migration and seed completed successfully!");
  await conn.end();
}

if (process.argv[1] && process.argv[1].endsWith('seedCensusData.js')) {
  migrateAndSeedCensus().catch(console.error);
}
