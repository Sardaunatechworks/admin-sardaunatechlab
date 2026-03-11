import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials missing' });

    if (req.method === 'GET') {
        try {
            const [servicesRes, productsRes, teamRes, blogsRes, partnersRes] = await Promise.all([
                supabase.from('services').select('*'),
                supabase.from('products').select('*'),
                supabase.from('team').select('*'),
                supabase.from('blogs').select('*'),
                supabase.from('partners').select('*')
            ]);

            return res.status(200).json({
                services: servicesRes.data || [],
                products: productsRes.data || [],
                team: teamRes.data || [],
                blogs: blogsRes.data || [],
                partners: partnersRes.data || []
            });
        } catch (error) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    if (req.method === 'POST') {
        try {
            const providedPassword = req.headers.authorization;
            const correctPassword = process.env.ADMIN_PASSWORD || 'sardaunacms';

            if (providedPassword !== correctPassword) {
                return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
            }

            const { type, items } = req.body;

            if (!type || !['services', 'products', 'team', 'blogs', 'partners'].includes(type) || !Array.isArray(items)) {
                return res.status(400).json({ error: 'Invalid data format' });
            }

            await supabase.from(type).delete().neq('id', 'dummy_id_to_match_all');

            if (items.length > 0) {
                await supabase.from(type).insert(items);
            }

            return res.status(200).json({ status: 'success', message: 'Updated successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}