/**
 * SCRIPT.JS — Lógica del Carrito de Compras (Vanilla JS)
 * Cada sección está comentada para que un estudiante de IT pueda entenderla.
 */

// 1. CATÁLOGO DE PLANES
const PLANES = [
  { id: 'plan-3', nombre: 'Plan 3', precio: 10, icono: '⚡', descripcion: 'Rutinas automáticas de 4 días y videos.' },
  { id: 'plan-2', nombre: 'Plan 2', precio: 30000, icono: '🔥', descripcion: 'Rutina personalizada y guía nutricional.' },
  { id: 'plan-1', nombre: 'Plan 1', precio: 64200, icono: '🏆', descripcion: 'Entrenamiento 100% adaptado con viandas.' }
];

// 2. ESTADO DEL CARRITO — array que guarda los items agregados
let carrito = [];

// 3. REFERENCIAS AL DOM
const cartOverlay = document.getElementById('cart-overlay');
const cartSidebar = document.getElementById('cart-sidebar');
const cartItemsContainer = document.getElementById('cart-items');
const cartEmptyMsg = document.getElementById('cart-empty');
const cartTotalEl = document.getElementById('cart-total');
const cartCountEl = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');
const clearCartBtn = document.getElementById('clear-cart-btn');
const checkoutModal = document.getElementById('checkout-modal');
const toastEl = document.getElementById('toast');

// 4. ABRIR / CERRAR CARRITO
function abrirCarrito() {
  cartSidebar.classList.add('open');
  cartOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cerrarCarrito() {
  cartSidebar.classList.remove('open');
  cartOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// 5. AGREGAR AL CARRITO
// Busca el plan por ID. Si ya existe en el carrito, suma 1 a la cantidad.
// Si no existe, lo agrega con cantidad = 1.
function agregarAlCarrito(planId) {
  const plan = PLANES.find(p => p.id === planId);
  if (!plan) return;

  const itemExistente = carrito.find(item => item.id === planId);
  if (itemExistente) {
    itemExistente.cantidad += 1;
  } else {
    carrito.push({ ...plan, cantidad: 1 });
  }

  actualizarCarritoUI();
  mostrarToast('✓ ' + plan.nombre + ' agregado al carrito');
  animarBotonAgregar(planId);
}

// 6. ELIMINAR ITEM — filter() crea un nuevo array sin el item indicado
function eliminarDelCarrito(planId) {
  carrito = carrito.filter(item => item.id !== planId);
  actualizarCarritoUI();
  mostrarToast('🗑️ Producto eliminado');
}

// 7. CAMBIAR CANTIDAD (+1 o -1). Si llega a 0, elimina el item.
function cambiarCantidad(planId, cambio) {
  const item = carrito.find(i => i.id === planId);
  if (!item) return;
  item.cantidad += cambio;
  if (item.cantidad <= 0) { eliminarDelCarrito(planId); return; }
  actualizarCarritoUI();
}

// 8. CALCULAR TOTAL — reduce() suma (precio × cantidad) de cada item
function calcularTotal() {
  return carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0);
}

// 9. FORMATEAR PRECIO — ej: 9990 → "$9.990"
function formatearPrecio(precio) {
  return '$' + precio.toLocaleString('es-AR');
}

// 10. ACTUALIZAR TODA LA UI DEL CARRITO
// Se llama cada vez que el carrito cambia. Re-renderiza items, total y badge.
function actualizarCarritoUI() {
  const estaVacio = carrito.length === 0;
  cartEmptyMsg.style.display = estaVacio ? 'flex' : 'none';

  if (estaVacio) {
    cartItemsContainer.innerHTML = '';
  } else {
    cartItemsContainer.innerHTML = carrito.map(item =>
      '<div class="cart-item" data-id="' + item.id + '">' +
        '<div class="cart-item__icon">' + item.icono + '</div>' +
        '<div class="cart-item__info">' +
          '<div class="cart-item__name">' + item.nombre + '</div>' +
          '<div class="cart-item__price">' + formatearPrecio(item.precio) + '</div>' +
        '</div>' +
        '<div class="cart-item__qty">' +
          '<button onclick="cambiarCantidad(\'' + item.id + '\', -1)" aria-label="Reducir">−</button>' +
          '<span>' + item.cantidad + '</span>' +
          '<button onclick="cambiarCantidad(\'' + item.id + '\', +1)" aria-label="Aumentar">+</button>' +
        '</div>' +
        '<button class="cart-item__remove" onclick="eliminarDelCarrito(\'' + item.id + '\')" aria-label="Eliminar">✕</button>' +
      '</div>'
    ).join('');
  }

  cartTotalEl.textContent = formatearPrecio(calcularTotal());
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  cartCountEl.textContent = totalItems;
  cartCountEl.classList.toggle('active', totalItems > 0);
  checkoutBtn.disabled = estaVacio;
}

// 11. VACIAR CARRITO
function vaciarCarrito() {
  carrito = [];
  actualizarCarritoUI();
  mostrarToast('🧹 Carrito vaciado');
}

// 12. CHECKOUT — Llama al Cloudflare Worker proxy para crear la preferencia de pago

// ⚠️ IMPORTANTE: Reemplazar con la URL real de tu Cloudflare Worker desplegado
const WORKER_URL = 'https://round-surf-b401.ruisotolautaro2007.workers.dev';

function finalizarCompra() {
  if (carrito.length === 0) { mostrarToast('⚠️ Tu carrito está vacío'); return; }

  // Mostrar/ocultar campo de género según si Plan 3 está en el carrito
  const tienePlan3 = carrito.some(item => item.id === 'plan-3');
  const generoField = document.getElementById('genero-field');
  generoField.style.display = tienePlan3 ? 'block' : 'none';

  // Reset del formulario de checkout
  document.getElementById('checkout-error').textContent = '';
  document.getElementById('checkout-email').value = '';
  document.querySelectorAll('input[name="genero"]').forEach(r => r.checked = false);

  // Abrir modal de checkout
  checkoutModal.classList.add('open');
}

// Procesar el pago: se dispara al enviar el formulario de checkout
async function procesarPago(e) {
  e.preventDefault();

  const errorEl = document.getElementById('checkout-error');
  const payBtn = document.getElementById('pay-btn');
  errorEl.textContent = '';

  // 1. Validar email
  const email = document.getElementById('checkout-email').value.trim();
  if (!email || !email.includes('@')) {
    errorEl.textContent = '⚠️ Ingresá un email válido.';
    return;
  }

  // 2. Validar género si Plan 3 está en el carrito
  const tienePlan3 = carrito.some(item => item.id === 'plan-3');
  let genero = null;
  if (tienePlan3) {
    const generoRadio = document.querySelector('input[name="genero"]:checked');
    if (!generoRadio) {
      errorEl.textContent = '⚠️ Seleccioná el género para tu rutina.';
      return;
    }
    genero = generoRadio.value;
  }

  // 3. Armar los datos para el Worker
  const payload = {
    items: carrito.map(item => ({
      id: item.id,
      title: item.nombre,
      description: item.descripcion,
      quantity: item.cantidad,
      unit_price: item.precio
    })),
    email: email,
    genero: genero
  };

  // 4. Estado de carga
  const textoOriginal = payBtn.textContent;
  payBtn.textContent = 'Procesando...';
  payBtn.disabled = true;

  try {
    // 5. Llamar al Worker proxy
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al procesar el pago');
    }

    if (!data.init_point) {
      throw new Error('No se recibió la URL de pago');
    }

    // 6. Redirigir al checkout de Mercado Pago
    mostrarToast('✅ Redirigiendo a Mercado Pago...');
    window.location.href = data.init_point;

  } catch (err) {
    console.error('Error de pago:', err);
    errorEl.textContent = '❌ ' + (err.message || 'Error de conexión. Intentá de nuevo.');
    payBtn.textContent = textoOriginal;
    payBtn.disabled = false;
  }
}

function cerrarCheckoutModal() { checkoutModal.classList.remove('open'); }

// 14. TOAST NOTIFICATION
let toastTimeout;
function mostrarToast(mensaje) {
  clearTimeout(toastTimeout);
  toastEl.textContent = mensaje;
  toastEl.classList.add('show');
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// 15. EFECTO VISUAL en botón al agregar
function animarBotonAgregar(planId) {
  const btn = document.querySelector('[data-plan-id="' + planId + '"]');
  if (!btn) return;
  const textoOriginal = btn.textContent;
  btn.textContent = '✓ Agregado';
  btn.classList.add('added');
  setTimeout(() => { btn.textContent = textoOriginal; btn.classList.remove('added'); }, 1500);
}

// 16. EVENT LISTENERS — Se conectan al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cart-btn').addEventListener('click', abrirCarrito);
  document.getElementById('close-cart-btn').addEventListener('click', cerrarCarrito);
  cartOverlay.addEventListener('click', cerrarCarrito);

  document.querySelectorAll('.plan-card__btn').forEach(btn => {
    btn.addEventListener('click', () => agregarAlCarrito(btn.getAttribute('data-plan-id')));
  });

  clearCartBtn.addEventListener('click', vaciarCarrito);
  checkoutBtn.addEventListener('click', () => { cerrarCarrito(); setTimeout(finalizarCompra, 400); });
  document.getElementById('close-checkout-modal').addEventListener('click', cerrarCheckoutModal);
  checkoutModal.addEventListener('click', (e) => { if (e.target === checkoutModal) cerrarCheckoutModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerrarCarrito(); cerrarCheckoutModal(); } });

  // Formulario de checkout → procesar pago
  document.getElementById('checkout-form').addEventListener('submit', procesarPago);

  actualizarCarritoUI();

  // 17. ANIMACIONES DE SCROLL con IntersectionObserver
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
});

