/* =========================================================
   CUENTAS DEL CANAL PROPIO · Grupo Los Panchos
   Regla decidida por Ricardo el 17 nov 2026.
   ÚNICO lugar para cambiar precios, envío, horario de envío y mensajes.
   Lo usan: la página de pedidos, la ficha de cocina y el panel.
   ========================================================= */
(function(){
  /* ── TABULADOR DE ENVÍO ──────────────────────────────────
     Cuando llegue el tabulador del grupo de repartidores, se cambia
     SOLO aquí (función envioReal). Tabulador del grupo (17 nov): $50 hasta 5 km + $5 por km extra. */
  const TABULADOR = {
    base: 50,           // pesos hasta los km incluidos
    kmIncluidos: 5,
    porKm: 5,           // cada km empezado después de los incluidos cuenta completo
    factorCalles: 1.3   // línea recta × 1.3 ≈ lo que recorre el repartidor por calles
  };
  const MARGEN_PAGINA = 0.10;                                // precio de página = local + 10%
  const HORARIO_DOMICILIO = {desde: '11:00', hasta: '23:00'}; // horario del grupo de repartidores
  const AVISO_GRATIS_MAX = 200;                              // "Agrega $X más…" solo si faltan $200 o menos
  const COCINA = {nombre: 'Los Panchos', lat: 20.6024719, lng: -100.3932257};
  COCINA.mapa = 'https://maps.google.com/?q=' + COCINA.lat + ',' + COCINA.lng;
  const WHATSAPP_INTERNO = '527448176464';

  const r2 = x => Math.round(x * 100) / 100;                 // evita errores de decimales (150 × 1.1 = 165.00000003)
  const pesos = n => '$' + Math.round(+n || 0).toLocaleString('es-MX');
  const kmTxt = km => (Math.round(km * 10) / 10).toLocaleString('es-MX') + ' km';

  /* Precio que ve el cliente: local + 10%, redondeado al peso de arriba ($15 → $17) */
  function precioPagina(local){ return Math.ceil(r2((+local || 0) * (1 + MARGEN_PAGINA))); }

  /* Distancia por calles a partir de la línea recta */
  function kmCalle(kmRecta, tab){ return Math.round(kmRecta * (tab || TABULADOR).factorCalles * 10) / 10; }

  /* Envío real que cobra el repartidor (tabulador) */
  function envioReal(km, tab){
    const t = tab || TABULADOR;
    return t.base + Math.max(0, Math.ceil(r2(km - t.kmIncluidos))) * t.porKm;
  }

  /* Lo que paga el cliente de envío: la mitad en múltiplos de $5 (hacia arriba),
     o GRATIS si el 10% extra de su pedido cubre el envío completo */
  function envioCliente(real, extra){
    if (real == null) return null;
    if (extra >= real) return 0;
    return Math.ceil(r2(real / 2 / 5)) * 5;
  }

  /* Cuánto más (a precios de página) le falta para que el envío salga gratis */
  function faltaParaGratis(real, extra){
    if (real == null || extra >= real) return 0;
    return Math.ceil(r2((real - extra) * (1 + MARGEN_PAGINA) / MARGEN_PAGINA));
  }

  /* Cuentas de un pedido.
     L = comida a precio de local, P = comida a precio de página,
     real = envío real (null si aún no se sabe), modo = 'domicilio'|'recoger',
     pagado = true si ya pagó por transferencia o Mercado Pago */
  function cuentas(o){
    const L = +o.L || 0, P = +o.P || 0, extra = P - L;
    if (o.modo === 'recoger') return {extra, real: 0, cliente: 0, gratis: false, total: P, recibe: P, aporte: L - P, falta: 0};
    if (o.real == null) return {extra, real: null, cliente: null, gratis: false, total: null, falta: null};
    const c = envioCliente(o.real, extra), total = P + c;
    const r = {extra, real: o.real, cliente: c, gratis: c === 0, total, falta: faltaParaGratis(o.real, extra)};
    r.recibe = total - o.real;            // lo que le queda al negocio
    r.aporte = L - r.recibe;              // > 0: lo que puso Ricardo · < 0: lo que sobró
    if (o.pagado) r.darle = o.real;       // ya pagado: en el local se le da el envío completo al repartidor
    else { r.pagaLocal = total - o.real; r.cobra = total; }
    return r;
  }

  const SEP = '━━━━━━━━━━━━━━';

  /* Mensaje para el GRUPO de repartidores: sin pedido, sin teléfono, sin descuentos */
  function mensajeGrupo(x){
    const c = cuentas(x);
    if (x.modo === 'recoger' || c.real == null) return '';
    const L = [];
    L.push('🛵 *PEDIDO PARA REPARTIR #' + x.folio + '*');
    L.push('');
    L.push('📍 *Recoges en:* ' + COCINA.nombre);
    L.push(COCINA.mapa);
    L.push('🏠 *Entregas en:* ' + (x.colonia ? 'Col. ' + x.colonia.replace(/^col(\.|onia)?\s+/i, '') : 'colonia por confirmar'));
    if (x.km != null) L.push('📏 *Distancia:* ' + kmTxt(x.km));
    L.push('');
    L.push('💰 *Tu ganancia: ' + pesos(c.real) + '*');
    if (x.pagado){
      L.push('');
      L.push('✅ *YA PAGADO.* No cobras nada al cliente.');
      L.push('🤝 En el local te damos *' + pesos(c.darle) + '*');
    } else {
      L.push('');
      L.push('💵 Pagas en el local: *' + pesos(c.pagaLocal) + '*');
      L.push('💵 Cobras al cliente: *' + pesos(c.cobra) + '*');
      const paga = parseFloat(String(x.cambio || '').replace(/[^0-9.]/g, ''));
      if (paga > c.cobra) L.push('🪙 El cliente paga con ' + pesos(paga) + ': lleva *' + pesos(paga - c.cobra) + '* de cambio');
    }
    L.push('');
    L.push('Contesta *"Yo"* si lo llevas.');
    return L.join('\n');
  }

  /* Mensaje PRIVADO para el repartidor que lo tome */
  function mensajePrivado(x){
    if (x.modo === 'recoger') return '';
    const L = [];
    L.push('🔒 *Datos de entrega #' + x.folio + '*');
    L.push('');
    L.push('👤 *Recibe:* ' + (x.nombre || 'por confirmar'));
    if (x.tel) L.push('📞 *Teléfono:* ' + String(x.tel).replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3'));
    L.push('🏠 *Dirección:* ' + [x.calle, x.colonia ? 'Col. ' + x.colonia.replace(/^col(\.|onia)?\s+/i, '') : ''].filter(Boolean).join(', '));
    if (x.refs) L.push('📝 *Referencias:* ' + x.refs);
    if (x.gps){
      L.push('📍 Ubicación exacta: https://maps.google.com/?q=' + x.gps.lat + ',' + x.gps.lng);
      L.push('🛵 Ruta desde ' + COCINA.nombre + ': https://www.google.com/maps/dir/?api=1&origin=' + COCINA.lat + ',' + COCINA.lng + '&destination=' + x.gps.lat + ',' + x.gps.lng + '&travelmode=driving');
    } else if (x.calle){
      L.push('🗺️ Mapa: https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([x.calle, x.colonia, 'Querétaro, Qro.'].filter(Boolean).join(', ')));
    }
    return L.join('\n');
  }

  /* Mensaje INTERNO para Ricardo y la cocina: pedido completo y cuentas */
  function mensajeInterno(x){
    const c = cuentas(x), rec = x.modo === 'recoger';
    const L = [];
    L.push('📋 *INTERNO #' + x.folio + '* · ' + (rec ? 'Paso a recoger' : 'A domicilio') + ' · ' + (x.pago || '') + (x.pagado ? ' (ya pagado)' : ''));
    L.push('');
    (x.items || []).forEach(i => {
      L.push(i.q + ' × ' + i.n + ' — ' + pesos(i.q * i.p) + (i.p0 != null ? ' (local ' + pesos(i.q * i.p0) + ')' : ''));
      if (i.nota) L.push('   ↳ ' + i.nota);
    });
    if (x.regalo) L.push('1 × Agua de Jamaica — REGALO 1er pedido');
    if (x.notas) L.push('Indicaciones: ' + x.notas);
    L.push('');
    L.push('Comida: ' + pesos(x.P) + ' (local ' + pesos(x.L) + ')');
    if (rec){
      L.push('Sin envío (pasa a recoger' + (x.hora ? ': ' + x.hora : '') + ')');
      L.push('*Cliente paga: ' + pesos(c.total) + '*');
    } else if (c.real == null){
      L.push('Envío: *por confirmar* (falta la ubicación del cliente)');
      L.push('*Cliente paga: ' + pesos(x.P) + ' + envío*');
    } else {
      L.push('Envío real: ' + pesos(c.real) + (x.km != null ? ' (' + kmTxt(x.km) + ')' : ''));
      L.push('Envío que vio el cliente: ~' + pesos(c.real) + '~ ' + (c.gratis ? 'GRATIS' : pesos(c.cliente)));
      L.push('*Cliente paga: ' + pesos(c.total) + '*');
      L.push('');
      if (x.pagado) L.push('👉 *Darle al repartidor: ' + pesos(c.darle) + '*');
      else L.push('👉 *Cobrarle al repartidor: ' + pesos(c.pagaLocal) + '*');
    }
    if (c.aporte != null){
      if (c.aporte > 0) L.push('🔴 *Pusiste: ' + pesos(c.aporte) + '*');
      else if (c.aporte < 0) L.push('🟢 *Te sobró: ' + pesos(-c.aporte) + '*');
      else L.push('⚪ *Pusiste: $0*');
    }
    L.push('');
    L.push('👤 ' + (x.nombre || 'Sin nombre') + (x.tel ? ' · ' + x.tel : ''));
    if (!rec) L.push('🏠 ' + [x.calle, x.colonia].filter(Boolean).join(', ') + (x.refs ? ' · Ref: ' + x.refs : ''));
    if (x.cambio && !x.pagado) L.push('💵 Paga con $' + x.cambio);
    return L.join('\n');
  }

  /* Clave corta que viaja en el mensaje del cliente para que la ficha de cocina
     recupere las cuentas exactas (no es secreta, solo no se lee a simple vista) */
  const ALF = '0123456789abcdefghijklmnopqrstuvwxyz', MEZ = 'k3x9qa7mz1w5tbe0v2n8yrcghjupf6dlo4si';
  function codificar(o){
    const v = [1, o.L, o.P, o.real == null ? '' : o.real, o.km == null ? '' : Math.round(o.km * 10), o.modo === 'recoger' ? 1 : 0];
    const s = v.map(n => n === '' ? '' : (+n).toString(36)).join('-');
    let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1296;
    return (s + '-' + h.toString(36)).replace(/[0-9a-z]/g, ch => MEZ[ALF.indexOf(ch)]).toUpperCase();
  }
  function decodificar(txt){
    const s = String(txt || '').trim().toLowerCase().replace(/[0-9a-z]/g, ch => ALF[MEZ.indexOf(ch)]);
    const p = s.split('-'); if (p.length !== 7) return null;
    const cuerpo = p.slice(0, 6).join('-');
    let h = 0; for (const ch of cuerpo) h = (h * 31 + ch.charCodeAt(0)) % 1296;
    if (h.toString(36) !== p[6] || parseInt(p[0], 36) !== 1) return null;
    const n = x => x === '' ? null : parseInt(x, 36);
    return {L: n(p[1]), P: n(p[2]), real: n(p[3]), km: p[4] === '' ? null : n(p[4]) / 10, modo: n(p[5]) === 1 ? 'recoger' : 'domicilio'};
  }

  window.CUENTAS = {TABULADOR, MARGEN_PAGINA, HORARIO_DOMICILIO, AVISO_GRATIS_MAX, COCINA, WHATSAPP_INTERNO,
    precioPagina, kmCalle, envioReal, envioCliente, faltaParaGratis, cuentas,
    mensajeGrupo, mensajePrivado, mensajeInterno, codificar, decodificar, pesos};
})();
