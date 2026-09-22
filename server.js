const express = require('express');
const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Inicializar cliente de Supabase con las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error("Faltan las variables de entorno de Supabase (SUPABASE_URL, SUPABASE_SERVICE_KEY)");
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.static('Public')); // Sirve los archivos estáticos del frontend

/* ==================== AUTENTICACIÓN ==================== */
function hashPassword(password, salt) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
}
function verificarPassword(password, salt, hash) {
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    try { return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex')); }
    catch (_) { return false; }
}
function nuevoToken() { return crypto.randomBytes(32).toString('base64url'); }

// Middleware para verificar sesión
async function requireAuth(req, res, next) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('token', token)
        .single();

    if (error || !session || new Date(session.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
    req.username = session.username;
    next();
}

// Endpoint de Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Datos incompletos' });

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

    if (error || !user || !verificarPassword(password, user.salt, user.hash)) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = nuevoToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    await supabase.from('sessions').insert({ token, username, expires_at: expiresAt.toISOString() });

    res.json({ token, username, mustChangePassword: !!user.must_change_password });
});

// Endpoint para cambiar contraseña
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('username', req.username)
        .single();

    if (findError || !user || !verificarPassword(currentPassword, user.salt, user.hash)) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const { salt, hash } = hashPassword(newPassword);
    await supabase.from('users').update({ salt, hash, must_change_password: false }).eq('username', req.username);

    res.json({ ok: true });
});

/* ==================== ENDPOINTS DE DATOS ==================== */
// Obtener todo el estado
app.get('/api/state', requireAuth, async (req, res) => {
    const { data, error } = await supabase.from('state').select('data').eq('id', 1).single();
    if (error || !data) return res.json({ state: {}, version: 0 });

    // Devolvemos el estado y una versión basada en la fecha de actualización para que el cliente sepa si hay cambios
    const version = data.data ? (data.data.version || 0) : 0;
    res.json({ state: data.data || {}, version });
});

// Guardar todo el estado
app.put('/api/state', requireAuth, async (req, res) => {
    const newState = req.body.state || {};
    const newVersion = (newState.version || 0) + 1;
    newState.version = newVersion;

    await supabase.from('state').upsert({ id: 1, data: newState, updated_at: new Date().toISOString() });
    res.json({ ok: true, version: newVersion });
});

// Endpoint para que el cliente consulte la versión actual
app.get('/api/version', requireAuth, async (req, res) => {
    const { data, error } = await supabase.from('state').select('data').eq('id', 1).single();
    if (error || !data || !data.data) return res.json({ version: 0 });
    res.json({ version: data.data.version || 0 });
});

// Ruta comodín para servir el index.html en cualquier otra ruta (comportamiento de SPA)
app.get('*', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'Public', 'index.html'));
});

/* ==================== ARRANQUE DEL SERVIDOR ==================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================');
    console.log('  TUBCOR está corriendo');
    console.log('  Puerto: ' + PORT);
    console.log('============================================');
});