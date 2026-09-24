/* ================================================================
   TUBCOR — Extension v1.1
   Agrega sin tocar el core:
     - $/kWh configurable en Costos de Insumos
     - Ayuda memoria (Ingeniería)
     - Gastos fijos mensuales con historial y KPIs
     - Evolución del PE con datos reales (Producción)
   ================================================================ */
(function(){
'use strict';

function $id(id){ return document.getElementById(id); }
function N(v){ const x = parseFloat(v); return Number.isFinite(x) ? x : 0; }
function money(v){ return N(v).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}); }
function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getState(){ try { return STATE; } catch(e) { return null; } }
function saveState(keys){ try { return save(keys); } catch(e){ return Promise.resolve(); } }
function toastMsg(m, t){ try { toast(m, t); } catch(e){ alert(m); } }

function mesActualKey(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}

/* ============ $/kWh CONFIGURABLE ============ */
function inyectarKwh(){
  const costoDiv = $id('precioCP')?.parentElement?.parentElement;
  if (!costoDiv || $id('costoKwhExt')) return;
  const row = document.createElement('div');
  row.id = 'costoKwhExt';
  row.style = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;grid-column:span 2;margin-top:8px';
  row.innerHTML = `<div>
      <label>Consumo eléctrico (kWh/mes)</label>
      <input id="kwhMensual" type="number" value="${N(getState()?.config?.kwhMensual) || 973}" step="1" min="0"
             oninput="window.tubcorGuardarKwh()"/>
    </div>
    <div>
      <label>Energía ($/kWh)</label>
      <input id="costoKwh" type="number" value="${N(getState()?.config?.costoKwh) || 536}" step="1" min="0"
             oninput="window.tubcorGuardarKwh()"/>
    </div>`;
  costoDiv.appendChild(row);
}
window.tubcorGuardarKwh = function(){
  const st = getState(); if (!st) return;
  st.config = st.config || {};
  st.config.costoKwh = N($id('costoKwh').value);
  saveState(['config']);
  try { recalcular(); } catch(_){}
};
function cargarKwhGuardado(){
  const st = getState(); if (!st || !$id('costoKwh')) return;
  const v = N(st.config?.costoKwh) || 520;
  if ($id('costoKwh').value !== String(v)) $id('costoKwh').value = v;
}

/* ============ AYUDA MEMORIA ============ */
function inyectarAyuda(){
  const ing = $id('tab-ingenieria');
  if (!ing || $id('ayudaMemoriaExt')) return;
  const div = document.createElement('div');
  div.className = 'card mt-3';
  div.id = 'ayudaMemoriaExt';
  div.innerHTML = `
    <button type="button" onclick="window.tubcorToggleAyuda()" style="background:transparent;border:0;padding:0;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.4px">
        ❓ Ayuda memoria — cómo calcular cada campo
      </div>
      <span id="ayudaChevronExt" style="color:#64748b;font-weight:800;font-size:18px">＋</span>
    </button>
    <div id="ayudaContenidoExt" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:11.5px;line-height:1.55">

        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px">MD50 ($/kg pasta)</div>
          <div style="color:#475569">Precio del tambor tal como sale del envase (pasta húmeda, 41% sólidos). La app convierte a seco automáticamente con el campo "Sólidos MD50 (%)".</div>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px">Sólidos MD50 (%)</div>
          <div style="color:#475569">Dato de ficha técnica Romial MD50: <b>41%</b>. Fracción del peso de la pasta que queda en el tubo después del secado (el resto es agua). Ajustar si cambia el producto.</div>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px">% MD50 seco / papel</div>
          <div style="color:#475569">Adhesivo seco que queda vs peso del papel interno. Valor inicial: <b>15%</b>. Se recalibra solo con los pesajes del Calibrador.</div>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px">Adhesivo tapa ($/kg)</div>
          <div style="color:#475569">Precio del adhesivo usado solo en la faja exterior (tapa). Romial recomienda <b>vinílico o dextrina</b>. Suele ser más caro que el MD50.</div>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px">% adhesivo tapa seco / papel tapa</div>
          <div style="color:#475569">Aplicado solo a la tapa exterior. Como no pega entre capas, usa menos adhesivo. Valor inicial: <b>8%</b>. Se calibra con pesajes reales.</div>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px">EPEC (Luz) — en Gastos Fijos</div>
          <div style="color:#475569">Cargo fijo de la factura EPEC, <b>mensualizado</b>. Si la factura es bimestral: cargo fijo ÷ 2. Ejemplo: $5.028 ÷ 2 = <b>$2.514/mes</b>. El consumo variable NO va acá.</div>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px">Energía ($/kWh) — en Costos</div>
          <div style="color:#475569">Costo variable real con impuestos.<br><b>Cálculo:</b> (Total factura − Cargo fijo) ÷ kWh consumidos.<br>Ejemplo EPEC: ($540.497 − $5.028) ÷ 1.038 kWh = <b>$516/kWh</b>. Actualizar con cada factura.</div>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px">Producción mensual (kg de tubo)</div>
          <div style="color:#475569">Cuántos <b>kg de tubo terminado</b> producís por mes. Se usa para prorratear los gastos fijos. <b>En kg, no en unidades.</b></div>
        </div>

      </div>
    </div>`;
  ing.appendChild(div);
}
window.tubcorToggleAyuda = function(){
  const c = $id('ayudaContenidoExt');
  const ch = $id('ayudaChevronExt');
  if (!c) return;
  const abierto = c.style.display === 'block';
  c.style.display = abierto ? 'none' : 'block';
  if (ch) ch.textContent = abierto ? '＋' : '−';
};

/* ============ GASTOS FIJOS POR MES ============ */
const CAMPOS_GF = ['gfAlq','gfExp','gfCon','gfSue','gfArca','gfRen','gfMun','gfPre','gfEpec','gfPro'];

function leerGFUI(){
  const out = {};
  CAMPOS_GF.forEach(id => { const el = $id(id); if (el) out[id] = N(el.value); });
  const p = $id('prodMensual'); if (p) out.prodMensual = N(p.value);
  return out;
}
function escribirGFUI(datos){
  if (!datos) return;
  CAMPOS_GF.forEach(id => { const el = $id(id); if (el) el.value = datos[id] || 0; });
  const p = $id('prodMensual'); if (p && datos.prodMensual != null) p.value = datos.prodMensual;
}
function totalGFUI(){
  return CAMPOS_GF.reduce((s,id)=>{ const el = $id(id); return s + (el ? N(el.value) : 0); }, 0);
}

function inyectarPanelGF(){
  const panel = $id('gfTotal')?.closest('.card') || $id('gfTotal')?.parentElement?.parentElement?.parentElement;
  if (!panel || $id('panelGFExt')) return;
  const div = document.createElement('div');
  div.id = 'panelGFExt';
  div.style = 'margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0';
  div.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
      <div class="kpi"><div class="k-label">Mes seleccionado</div><div class="k-value text-[13px]" id="gfMesActualExt">$0</div></div>
      <div class="kpi"><div class="k-label">Promedio año</div><div class="k-value text-[13px]" id="gfPromAnioExt">$0</div></div>
      <div class="kpi"><div class="k-label">Total año</div><div class="k-value text-[13px]" id="gfTotalAnioExt">$0</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label>Mes que estás cargando</label>
        <input id="gfMesExt" type="month"/>
      </div>
      <div style="display:flex;align-items:flex-end">
        <button class="btn btn-secondary" style="width:100%" type="button" onclick="window.tubcorCargarMesGF()">
          ⬇ Cargar mes
        </button>
      </div>
      <div style="display:flex;align-items:flex-end">
        <button class="btn btn-primary" style="width:100%" type="button" onclick="window.tubcorGuardarMesGF()">
          💾 Guardar / actualizar este mes
        </button>
      </div>
    </div>
    <div id="gfEstadoExt" style="font-size:10px;color:#64748b;text-align:center;min-height:14px"></div>
    <div style="margin-top:12px">
      <div style="font-size:11px;font-weight:800;color:#334155;text-transform:uppercase;text-align:center;margin-bottom:8px">
        Historial de gastos fijos guardados
      </div>
      <div style="max-height:220px;overflow:auto">
        <table>
          <thead><tr><th>Mes</th><th class="num">Total</th><th style="width:140px">Acciones</th></tr></thead>
          <tbody id="gfHistExt"></tbody>
        </table>
      </div>
    </div>`;
  panel.appendChild(div);
}

window.tubcorGuardarMesGF = async function(){
  const st = getState(); if (!st) return;
  const mes = $id('gfMesExt').value || mesActualKey();
  st.config = st.config || {};
  st.config.gastosFijosHistorial = st.config.gastosFijosHistorial || {};
  const existente = st.config.gastosFijosHistorial[mes];
  if (existente && !confirm('Ya hay gastos guardados para ' + mes + '. ¿Sobrescribir?')) return;
  const datos = leerGFUI();
  datos.total = totalGFUI();
  datos.guardado = new Date().toISOString();
  st.config.gastosFijosHistorial[mes] = datos;
  await saveState(['config']);
  renderHistGF();
  renderKPIsGF();
  renderEvolucion();
  toastMsg('Gastos fijos de ' + mes + ' guardados', 'ok');
};

window.tubcorCargarMesGF = function(){
  const st = getState(); if (!st) return;
  const mes = $id('gfMesExt').value;
  if (!mes) return;
  const hist = st.config?.gastosFijosHistorial || {};
  const datos = hist[mes];
  if (datos){
    escribirGFUI(datos);
    $id('gfEstadoExt').textContent = '✓ Datos cargados desde el historial';
    $id('gfEstadoExt').style.color = '#15803d';
  } else {
    $id('gfEstadoExt').textContent = 'Sin datos para este mes. Cargá los valores y guardá.';
    $id('gfEstadoExt').style.color = '#64748b';
  }
  try { recalcular(); } catch(_){}
  renderKPIsGF();
  renderHistGF();
};;

window.tubcorEliminarMesGF = async function(mes){
  if (!confirm('¿Eliminar los gastos fijos guardados de ' + mes + '?')) return;
  const st = getState(); if (!st || !st.config?.gastosFijosHistorial) return;
  delete st.config.gastosFijosHistorial[mes];
  await saveState(['config']);
  renderHistGF();
  renderKPIsGF();
  renderEvolucion();
  toastMsg('Mes eliminado', 'ok');
};

function renderHistGF(){
  const tb = $id('gfHistExt');
  if (!tb) return;
  const st = getState(); if (!st) return;
  const hist = st.config?.gastosFijosHistorial || {};
  const meses = Object.keys(hist).sort().reverse();
  if (!meses.length){
    tb.innerHTML = '<tr><td colspan="3" class="empty">Todavía no hay meses guardados.</td></tr>';
    return;
  }
  tb.innerHTML = meses.map(mes => `<tr>
    <td><b>${esc(mes)}</b></td>
    <td class="num">${money(hist[mes].total || 0)}</td>
    <td>
      <button class="btn btn-secondary btn-sm" type="button" onclick="$id('gfMesExt').value='${mes}';window.tubcorCargarMesGF()">Cargar</button>
      <button class="btn btn-danger btn-sm" type="button" onclick="window.tubcorEliminarMesGF('${mes}')">🗑</button>
    </td>
  </tr>`).join('');
}

function renderKPIsGF(){
  const st = getState(); if (!st) return;
  const anio = new Date().getFullYear();
  const hist = st.config?.gastosFijosHistorial || {};
  const meses = Object.keys(hist).filter(m => m.startsWith(anio + '-'));
  const totalAnio = meses.reduce((s,m) => s + (hist[m].total || 0), 0);
  const promedio = meses.length ? totalAnio / meses.length : 0;
  const mes = $id('gfMesExt')?.value || mesActualKey();
  const totalMes = (hist[mes] && hist[mes].total) || totalGFUI();
  if ($id('gfMesActualExt')) $id('gfMesActualExt').textContent = money(totalMes);
  if ($id('gfPromAnioExt')) $id('gfPromAnioExt').textContent = money(promedio);
  if ($id('gfTotalAnioExt')) $id('gfTotalAnioExt').textContent = money(totalAnio);
}

function cargarMesActualAuto(){
  const st = getState(); if (!st || !$id('gfMesExt')) return;
  const mes = mesActualKey();
  if (!$id('gfMesExt').value) $id('gfMesExt').value = mes;
  const hist = st.config?.gastosFijosHistorial || {};
  if (hist[mes]){
    const todosCero = CAMPOS_GF.every(id => { const el = $id(id); return !el || N(el.value) === 0; });
    if (todosCero){
      escribirGFUI(hist[mes]);
      $id('gfEstadoExt').textContent = '✓ Gastos cargados del historial para ' + mes;
      $id('gfEstadoExt').style.color = '#15803d';
      try { recalcular(); } catch(_){}
    } else {
      $id('gfEstadoExt').textContent = 'Hay datos en pantalla. Clic en "Cargar mes" para traer los guardados.';
      $id('gfEstadoExt').style.color = '#64748b';
    }
  }
  renderHistGF();
  renderKPIsGF();
}

/* ============ EVOLUCIÓN PE REAL ============ */
function inyectarEvolucion(){
  const prod = $id('tab-produccion');
  if (!prod || $id('evolucionPEExt')) return;
  const div = document.createElement('div');
  div.className = 'card mt-3';
  div.id = 'evolucionPEExt';
  div.innerHTML = `
    <div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.4px;text-align:center;margin-bottom:12px">
      📈 Evolución hacia el punto de equilibrio — datos reales
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
      <div class="kpi"><div class="k-label">kg producidos (año)</div><div class="k-value text-[14px]" id="evKgAnioExt">0</div></div>
      <div class="kpi"><div class="k-label">Gastos fijos (año)</div><div class="k-value text-[14px]" id="evGfAnioExt">$0</div></div>
      <div class="kpi"><div class="k-label">PE requerido (año)</div><div class="k-value text-[14px]" id="evPeAnioExt">0 kg</div></div>
      <div class="kpi"><div class="k-label">Avance del año</div><div class="k-value text-[14px]" id="evAvanceExt">0 %</div></div>
    </div>
    <div style="max-height:400px;overflow:auto">
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th class="num">kg producidos</th>
            <th class="num">Gastos fijos</th>
            <th class="num">PE kg del mes</th>
            <th class="num">Avance</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody id="evTablaExt"></tbody>
      </table>
    </div>
    <div style="font-size:10px;color:#64748b;text-align:center;margin-top:8px">
      Calculado con los costos variables y precio de venta actuales de Ingeniería, aplicados a los kg realmente producidos cada mes.
    </div>`;
  prod.appendChild(div);
  renderEvolucion();
}

function renderEvolucion(){
  const tb = $id('evTablaExt');
  if (!tb) return;
  const st = getState();
  if (!st) return;

  const anio = new Date().getFullYear();
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const r = st.resultados || {};
  const costoVarKg = (r.pesoLoteKg && r.costoVariableTotal) ? (r.costoVariableTotal / r.pesoLoteKg) : 0;
  const precioVentaKg = (r.pesoLoteKg && r.precioTotalSinIva) ? (r.precioTotalSinIva / r.pesoLoteKg) : 0;
  const contribKg = Math.max(0, precioVentaKg - costoVarKg);

  const gfHist = st.config?.gastosFijosHistorial || {};
  const gfActualUI = totalGFUI();

  let kgTotalAnio = 0, gfTotalAnio = 0;
  const filas = [];
  const mesActual = new Date().getMonth() + 1;

  for (let m = 1; m <= 12; m++){
    const mesKey = anio + '-' + String(m).padStart(2,'0');
    const prodMes = (st.produccion || []).filter(p => (p.fecha || '').slice(0,7) === mesKey);
    let kgMes = 0;
    prodMes.forEach(p => {
      (p.items || []).forEach(it => { kgMes += (it.papelKg || 0) + (it.adhSecoKg || 0); });
    });

    // GF del mes: si hay guardado, usar ese. Si no, el del UI actual (para el mes actual).
    let gfMes = 0;
    if (gfHist[mesKey]) gfMes = gfHist[mesKey].total || 0;
    else if (m === mesActual) gfMes = gfActualUI;

    const peKg = contribKg > 0 ? (gfMes / contribKg) : 0;
    const avance = peKg > 0 ? (kgMes / peKg) * 100 : 0;

    let estado = '—', color = '#94a3b8';
    if (kgMes > 0 && gfMes > 0){
      if (avance >= 100){ estado = '✓ Superado'; color = '#15803d'; }
      else if (avance >= 70){ estado = '▲ Cerca'; color = '#0369a1'; }
      else if (avance >= 40){ estado = '● Medio'; color = '#d97706'; }
      else { estado = '▼ Lejos'; color = '#b91c1c'; }
    }

    const visible = kgMes > 0 || gfHist[mesKey] || m === mesActual;
    if (visible){
      filas.push({ nombre: nombres[m-1], kgMes, gfMes, peKg, avance, estado, color });
    }

    if (kgMes > 0 || gfHist[mesKey]){
      kgTotalAnio += kgMes;
      gfTotalAnio += gfMes;
    }
  }

  tb.innerHTML = filas.length ? filas.map(f => `<tr>
    <td><b>${f.nombre}</b></td>
    <td class="num">${f.kgMes > 0 ? f.kgMes.toFixed(1) : '—'}</td>
    <td class="num">${f.gfMes > 0 ? money(f.gfMes) : '—'}</td>
    <td class="num">${f.peKg > 0 ? f.peKg.toFixed(1) : '—'}</td>
    <td class="num" style="font-weight:700">${f.avance > 0 ? f.avance.toFixed(1)+' %' : '—'}</td>
    <td style="color:${f.color};font-weight:700">${f.estado}</td>
  </tr>`).join('') : '<tr><td colspan="6" class="empty">Sin datos de producción o gastos fijos para este año.</td></tr>';

  const peAnio = contribKg > 0 ? (gfTotalAnio / contribKg) : 0;
  const avanceAnio = peAnio > 0 ? (kgTotalAnio / peAnio) * 100 : 0;

  if ($id('evKgAnioExt')) $id('evKgAnioExt').textContent = kgTotalAnio.toFixed(1) + ' kg';
  if ($id('evGfAnioExt')) $id('evGfAnioExt').textContent = money(gfTotalAnio);
  if ($id('evPeAnioExt')) $id('evPeAnioExt').textContent = peAnio > 0 ? peAnio.toFixed(1) + ' kg' : '—';
  if ($id('evAvanceExt')){
    const el = $id('evAvanceExt');
    el.textContent = avanceAnio.toFixed(1) + ' %';
    el.style.color = avanceAnio >= 100 ? '#15803d' : avanceAnio >= 70 ? '#0369a1' : avanceAnio >= 40 ? '#d97706' : '#b91c1c';
  }
}

/* ============ INYECCIÓN DINÁMICA ============ */
async function boot(){
  for (let i = 0; i < 100; i++){
    if ($id('tab-ingenieria') && getState()) break;
    await new Promise(r => setTimeout(r, 150));
  }
  inyectarKwh();
  inyectarAyuda();
  inyectarPanelGF();
  inyectarEvolucion();
  cargarKwhGuardado();
  cargarMesActualAuto();
  let reintentosGF = 0;
  const reintentarGF = () => {
    const st = getState();
    const hist = st?.config?.gastosFijosHistorial || {};
    const mes = mesActualKey();
    if (reintentosGF < 15 && (!hist[mes] || !$id('gfMesExt')?.value)){
      reintentosGF++;
      cargarMesActualAuto();
      setTimeout(reintentarGF, 2000);
    }
  };
  setTimeout(reintentarGF, 2000);

  // Hookear switchTab
  const orig = window.switchTab;
  if (typeof orig === 'function' && !orig.__extHooked){
    const wrapped = function(name){
      const r = orig.apply(this, arguments);
      setTimeout(() => {
        inyectarKwh();
        inyectarAyuda();
        inyectarPanelGF();
        inyectarEvolucion();
        cargarKwhGuardado();
        cargarMesActualAuto();
        if (name === 'produccion') renderEvolucion();
      }, 60);
      return r;
    };
    wrapped.__extHooked = true;
    window.switchTab = wrapped;
  }

  // Re-inyectar periódicamente
  setInterval(() => {
    inyectarKwh();
    inyectarAyuda();
    inyectarPanelGF();
    inyectarEvolucion();
    renderEvolucion();
  }, 3000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();