import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Nodemailer Transport
// IN PRODUCTION: Use environment variables for credentials
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER || 'test@example.com',
        pass: process.env.SMTP_PASS || 'password'
    }
});

// Contact Form API Endpoint
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Basic server-side validation
        if (!name || !email || !message) {
            return res.status(400).json({
                status: 'error',
                message: 'Name, email, and message are required fields.'
            });
        }

        const mailOptions = {
            from: `"${name}" <${email}>`,
            to: process.env.CONTACT_EMAIL || 'info@sardaunatechlab.xyz', // Your receiving email
            subject: subject ? `Contact Form: ${subject}` : 'New Website Inquiry',
            text: `
Name: ${name}
Email: ${email}

Message:
${message}
            `,
            html: `
<h3>New Website Inquiry</h3>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Subject:</strong> ${subject || 'N/A'}</p>
<hr/>
<p>${message.replace(/\n/g, '<br/>')}</p>
            `
        };

        // Send Email
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);

        // If using Ethereal (test account), log the URL to view the message
        if (info.messageId && info.envelope.to.includes('ethereal.email') === false) {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return res.status(200).json({
            status: 'success',
            message: 'Your inquiry has been sent successfully.'
        });

    } catch (error) {
        console.error('Nodemailer Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to send message. Please try again later.'
        });
    }
});



// --- Lightweight CMS Integration (Supabase) --- //

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// GET Content
app.get('/api/content', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Supabase credentials not configured in .env' });
        }

        // Fetch each table
        const [servicesRes, productsRes, teamRes, blogsRes, partnersRes] = await Promise.all([
            supabase.from('services').select('*'),
            supabase.from('products').select('*'),
            supabase.from('team').select('*'),
            supabase.from('blogs').select('*'),
            supabase.from('partners').select('*')
        ]);

        if (servicesRes.error || productsRes.error || teamRes.error || blogsRes.error || partnersRes.error) {
            console.error('Supabase fetch error:', servicesRes.error || productsRes.error || teamRes.error || blogsRes.error || partnersRes.error);
            return res.status(500).json({ error: 'Failed to fetch content from Supabase' });
        }

        const data = {
            services: servicesRes.data || [],
            products: productsRes.data || [],
            team: teamRes.data || [],
            blogs: blogsRes.data || [],
            partners: partnersRes.data || []
        };

        res.setHeader('Content-Type', 'application/json');
        res.send(data);

    } catch (error) {
        console.error('Error reading Supabase data:', error);
        res.status(500).json({ error: 'Internal Server Error fetching content' });
    }
});

// POST (Update) Content
// Accepts { type: 'services|products|team|blogs', data: array_of_objects }
app.post('/api/content', async (req, res) => {
    try {
        const providedPassword = req.headers.authorization;
        const correctPassword = process.env.ADMIN_PASSWORD || 'sardaunacms';

        if (providedPassword !== correctPassword) {
            return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase credentials not configured' });
        }

        const { type, items } = req.body;

        if (!type || !['services', 'products', 'team', 'blogs', 'partners'].includes(type) || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Invalid data format. Requires { type, items: [] }' });
        }

        // 1. Delete all existing rows in that table
        // We use a trick to delete all rows by matching anything that ISN'T a dummy value
        const { error: deleteError } = await supabase
            .from(type)
            .delete()
            .neq('id', 'dummy_id_to_match_all_rows');

        if (deleteError) {
            console.error(`[CMS] Failed to clear table ${type}:`, deleteError);
            return res.status(500).json({ error: `Failed to clear table ${type}` });
        }

        // 2. Insert new rows if items exist
        if (items.length > 0) {
            // Clean items: remove auto-generated fields if they exist to avoid conflicts
            const cleanedItems = items.map(({ created_at, ...rest }) => rest);
            
            const { error: insertError } = await supabase
                .from(type)
                .insert(cleanedItems);

            if (insertError) {
                console.error(`[CMS] Failed to insert into ${type}:`, insertError);
                // CRITICAL bit: if we fail here, the table is now EMPTY. 
                // In a production app, we'd use transactions or a temp table.
                return res.status(500).json({ error: `Failed to insert new items into ${type}. The section might be empty.` });
            }
        }

        console.log(`[CMS] Successfully updated ${type} (${items.length} items)`);
        res.status(200).json({ status: 'success', message: `${type} updated successfully` });

    } catch (error) {
        console.error('Error writing to Supabase:', error);
        res.status(500).json({ error: 'Failed to update content data' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running smoothly on http://localhost:${PORT}`);
});


