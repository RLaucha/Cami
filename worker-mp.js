/**
 * Cloudflare Worker — Proxy seguro para Mercado Pago
 *
 * VARIABLE DE ENTORNO REQUERIDA:
 *   MP_ACCESS_TOKEN  →  tu Access Token de producción de Mercado Pago
 *
 * SETUP en Cloudflare Dashboard:
 *   1. Workers & Pages  →  Create Worker
 *   2. Pegar este código
 *   3. Settings  →  Variables  →  agregar  MP_ACCESS_TOKEN  (encriptada)
 *   4. Copiar la URL del Worker (ej: https://mp-proxy.tu-cuenta.workers.dev)
 *      y pegarla en WORKER_URL dentro de script.js
 */

// Orígenes permitidos (actualizar con tu dominio real en producción)
const ALLOWED_ORIGINS = [
  'http://localhost',
  'http://127.0.0.1',
  'https://rlaucha.github.io',
  'https://camifit.com.ar',
  'https://www.camifit.com.ar'
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // --- Preflight CORS ---
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // --- Solo POST ---
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }

    try {
      // 1. Leer el body del frontend
      const body = await request.json();
      const { items, email, genero, first_name, last_name } = body;

      // 2. Validaciones básicas
      if (!items || !Array.isArray(items) || items.length === 0) {
        return jsonError('Faltan los items del carrito', 400, origin);
      }
      if (!email || !email.includes('@')) {
        return jsonError('Email inválido', 400, origin);
      }

      // 3. Construir metadata para automatización (Make)
      const metadata = {
        plan_ids: items.map(i => i.id).join(','),
        email: email,
        timestamp: new Date().toISOString()
      };

      // Solo agregar género si fue enviado (Plan 3)
      if (genero) {
        metadata.genero = genero;
      }

      // 4. Armar la preferencia de pago
      const preference = {
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          currency_id: 'ARS'
        })),
        payer: {
          email: email,
          first_name: first_name || '',
          last_name: last_name || ''
        },
        metadata: metadata,
        notification_url: 'https://hook.us2.make.com/mgx9j0c47o9i8lfmu2mxbm1woyb3x9mk',
        back_urls: {
          success: 'https://camifit.com.ar/?status=success',
          failure: 'https://camifit.com.ar/?status=failure',
          pending: 'https://camifit.com.ar/?status=pending'
        },
        auto_return: 'approved'
      };

      // 5. Crear la preferencia en Mercado Pago
      const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preference)
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error('MP Error:', JSON.stringify(mpData));
        return jsonError('Error al crear la preferencia de pago', mpResponse.status, origin);
      }

      // 6. Devolver la URL de checkout al frontend
      return new Response(JSON.stringify({
        init_point: mpData.init_point,
        preference_id: mpData.id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });

    } catch (err) {
      console.error('Worker error:', err);
      return jsonError('Error interno del servidor', 500, origin);
    }
  }
};

function jsonError(message, status, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}
