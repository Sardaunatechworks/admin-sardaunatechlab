import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
    try {
        const dataPath = path.join(__dirname, 'data.json');
        if (!fs.existsSync(dataPath)) {
            console.error('data.json not found');
            return;
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const tables = ['services', 'products', 'team', 'blogs'];

        for (const table of tables) {
            const items = data[table] || [];
            if (items.length > 0) {
                console.log(`Clearing ${table}...`);
                await supabase.from(table).delete().neq('id', 'dummy_id_to_match_all');

                console.log(`Seeding ${items.length} items to ${table}...`);
                const { error } = await supabase.from(table).insert(items);
                if (error) {
                    console.error(`Error inserting into ${table}:`, error);
                } else {
                    console.log(`Successfully seeded ${table}`);
                }
            } else {
                console.log(`No items to seed for ${table}`);
            }
        }

        console.log('Database seeding complete!');
    } catch (e) {
        console.error('Execution error:', e);
    }
}

seedDatabase();
