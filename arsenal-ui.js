import { WEAPONS, CATEGORIES } from './shared/rules.js';
import { slotsOf, piecesOf, pieceInfo, pieceBlurb, resolveWeapon, statBars, compare, clampKit } from './shared/attachments.js';
import { CAMO_TIERS } from './weapon-camo.js';
import { createWeaponViewer } from './weapon-thumbs.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SLOT_NAMES = { primary: 'Primária', secondary: 'Secundária', melee: 'Corpo a corpo' };

export function createArsenal(host, api) {
  let step = 1, slot = 'primary', category = 'rajada', weapon = 0, tab = 'skins', part = 'optic', kit = {}, camo = 0, skinId = '', busy = false;
  let viewer;
  const photo = i => `<span class="ar-photo" data-w="${i}" role="img" aria-label="${esc(WEAPONS[i].name)}"${api.thumbs[i] ? ` style="background-image:url('${api.thumbs[i]}')"` : ''}></span>`;
  const button = (text, action, cls = '') => `<button type="button" class="ar-button ${cls}" data-action="${action}">${text}</button>`;
  const metrics = (i, tiny = false) => statBars(resolveWeapon(i, kit), WEAPONS[i]).filter(b => ['dano', 'cadencia', ...(tiny ? [] : ['controle'])].includes(b.id)).map(b => `<div class="ar-stat" title="${esc(b.label)}: ${esc(b.num)}">${tiny ? '' : `<span>${esc(b.label)} <small>${esc(b.num)}</small></span>`}<span class="ar-track"><i style="width:${b.fill}%"></i></span></div>`).join('');
  function skinCard(id, name, note) {
    const selected = skinId === id, equipped = api.skins(weapon).equipped === id;
    const url = api.skinThumb(weapon, id);
    return `<button type="button" class="ar-option${selected ? ' selected' : ''}" data-skin="${esc(id)}" aria-pressed="${selected}"><span class="ar-photo"${url ? ` style="background-image:url('${url}')"` : ''} aria-hidden="true"></span><b>${esc(name)}</b><span>${equipped ? 'Equipada' : selected ? 'Selecionada' : esc(note)}</span></button>`;
  }
  function pickSlot(next) {
    slot = next;
    const c = api.snapshot().classes[api.snapshot().index];
    weapon = c[slot];
    category = CATEGORIES.find(c => c.pick === slot && c.weapons.includes(weapon))?.id;
    step = 2; render();
  }
  function customize() {
    const c = api.snapshot().classes[api.snapshot().index];
    kit = { ...(c.kits[WEAPONS[weapon].key] || {}) };
    part = slotsOf(weapon)[0]?.id || '';
    skinId = api.skins(weapon).equipped;
    camo = 0; tab = 'skins'; step = 3; render();
  }
  host.tabIndex = -1;
  function render() {
    const restoreFocus = host.contains(document.activeElement);
    const { classes, index } = api.snapshot(), c = classes[index], w = WEAPONS[weapon];
    const skins = api.skins(weapon);
    if (step === 3 && skinId && !skins.items.some(item => item.id === skinId)) skinId = skins.equipped;
    host.dataset.step = String(step);
    host.setAttribute('aria-busy', String(busy));
    const crumb = step === 1 ? 'PASSO 1 · MONTAR CLASSE' : `PASSO ${step} · ${c.name} › ${SLOT_NAMES[slot]}${step === 3 ? ' › ' + w.name : ''}`;
    const actions = step === 1 ? `${button('Tiroteio', 'shoot', 'active')}${button('Truco', 'truco')}${button('Fechar caixa', 'close')}` : step === 2 ? button('Voltar à classe', 'classes') : `${button('Voltar às armas', 'weapons')}${button('Equipar', 'equip', 'gold')}`;
    let content = '';
    if (step === 1) {
      content = `<div class="ar-classes"><aside><h3>SUAS CLASSES</h3><div class="ar-class-list">${classes.map((row, i) => `<button type="button" class="ar-class ${i === index ? 'selected' : ''}" data-class="${i}" aria-pressed="${i === index}"><b>${i + 1} · ${esc(row.name)}</b><span>${['primary', 'secondary', 'melee'].map(s => esc(WEAPONS[row[s]].short || WEAPONS[row[s]].name)).join(' · ')}</span></button>`).join('')}</div></aside><section class="ar-panel ar-class-detail"><div class="ar-class-heading"><label><span>NOME DA CLASSE</span><input id="arsenalClassName" aria-label="Nome da classe" maxlength="16" value="${esc(c.name)}"></label>${button('Equipar classe', 'arm', 'gold')}</div><div class="ar-slots">${Object.entries(SLOT_NAMES).map(([s, label]) => `<button type="button" class="ar-weapon-slot" data-slot="${s}"><h3>${label}</h3>${photo(c[s])}<b>${esc(WEAPONS[c[s]].name)}</b><span>Skin: ${esc(api.skins(c[s]).items.find(item => item.id === api.skins(c[s]).equipped)?.name || 'De fábrica')}</span>${slotsOf(c[s]).length ? `<span>${slotsOf(c[s]).map(p => esc(p.label)).join(' · ')}</span>` : '<span>Pronta para o combate</span>'}</button>`).join('')}</div><p class="ar-hint">Clique em um espaço para trocar a arma. Dentro da arma você mexe nas peças e confere as skins.</p></section></div>`;
    } else if (step === 2) {
      const categories = CATEGORIES.filter(c => c.pick === slot);
      const guns = api.pool(categories.find(c => c.id === category)?.weapons || []);
      content = `<nav class="ar-tabs" aria-label="Categorias de arma">${categories.map(c => `<button type="button" class="ar-button ${c.id === category ? 'active' : ''}" data-category="${c.id}" aria-pressed="${c.id === category}">${esc(c.title)}</button>`).join('')}</nav><div class="ar-picker"><div class="ar-weapon-grid">${guns.map(i => `<button type="button" class="ar-weapon-card ${i === weapon ? 'selected' : ''}" data-weapon="${i}" aria-pressed="${i === weapon}">${photo(i)}<b>${esc(WEAPONS[i].name)}</b><span>${esc(WEAPONS[i].desc || (WEAPONS[i].auto ? 'Automático' : 'Disparo manual'))}</span><div class="ar-mini-stats">${metrics(i, true)}</div></button>`).join('') || '<p>Nenhuma arma liberada nesta categoria.</p>'}</div><aside class="ar-panel ar-preview"><h3>PRÉVIA</h3><div class="ar-viewer-mount"></div><h2>${esc(w.name)}</h2><p>${esc(w.auto ? 'Automático' : 'Disparo manual')}${w.mag ? ` · ${w.mag}/${w.reserve ?? 0}` : ''}${w.dmg ? ` · ${w.dmg} de dano` : ''}</p>${metrics(weapon)}${button('Escolher e customizar', 'customize', 'gold')}</aside></div>`;
    } else {
      const slots = slotsOf(weapon), pieces = piecesOf(weapon, part);
      const equipped = c.kits[w.key] || {};
      const diff = compare(resolveWeapon(weapon, equipped), resolveWeapon(weapon, kit));
      content = `<div class="ar-custom"><section class="ar-panel ar-workbench"><div class="ar-viewer-mount"></div><nav class="ar-part-tabs" aria-label="Peças da arma">${slots.map(s => `<button type="button" class="ar-button ${s.id === part ? 'selected' : ''}" data-part="${s.id}" aria-pressed="${s.id === part}">${esc(s.label)}</button>`).join('')}</nav><p class="ar-hint">${part ? `Peça atual (${esc(slots.find(s => s.id === part)?.label)}): ${esc(pieceInfo(weapon, part, kit[part] || '')?.name || 'De fábrica')}` : 'Essa arma já vem pronta para o combate.'}</p><span class="ar-rotate-hint">Arraste para girar · use as setas com a prévia em foco</span></section><section class="ar-panel ar-options"><nav class="ar-tabs" aria-label="Customização">${button('Skins', 'skins', tab === 'skins' ? 'active' : '')}${button('Peças', 'parts', tab === 'parts' ? 'active' : '')}</nav>${tab === 'skins' ? `<div class="ar-options-grid ar-owned-skins" aria-label="Skins da arma na mochila">
        ${skinCard('', 'De fábrica', 'Visual original')}
        ${skins.items.map(item => skinCard(item.id, item.name, 'Na mochila')).join('')}
      </div>
      ${!skins.items.length ? `<p class="ar-hint ar-skins-empty">${skins.signedIn ? 'Nenhuma skin desta arma na mochila. As skins do Brechó e do Caixote aparecem aqui.' : 'Entre na sua conta para usar as skins da sua mochila.'}</p>` : ''}
      <details class="ar-match-camos"><summary>Camuflagens por abates na partida</summary><div class="ar-tabs">${button('Visual escolhido', 'skin-preview', camo === 0 ? 'selected' : '')}${CAMO_TIERS.map((s, i) => `<button type="button" class="ar-button ${camo === i + 1 ? 'selected' : ''}" data-camo="${i + 1}">${esc(s.name)} · ${s.at} abates</button>`).join('')}</div><p class="ar-hint">Prévia temporária. Essas camuflagens são liberadas por abates e duram até o fim da partida.</p></details>
      <p class="ar-hint ar-bottom-note">Escolha uma skin e clique em Equipar. O visual fica salvo na sua conta para esta arma, em todas as classes. Skins não alteram os atributos.</p>` : `<div class="ar-options-grid">${pieces.map(p => `<button type="button" class="ar-option ${p.id === (kit[part] || '') ? 'selected' : ''}" data-piece="${esc(p.id)}"><span class="ar-piece-icon" aria-hidden="true">${esc(slots.find(s => s.id === part)?.label || '')}</span><b>${esc(p.name)}</b><span>${p.id === (kit[part] || '') ? 'Selecionada' : 'Disponível'}</span></button>`).join('')}</div><p class="ar-hint">${esc(part ? pieceBlurb(weapon, part, kit[part] || '') : 'Esta arma não possui peças intercambiáveis.')}</p>${diff.length ? `<div class="ar-comparison">${diff.map(d => `<span>${esc(d.label)} <b>${esc(d.now)} → ${esc(d.next)}</b></span>`).join('')}</div>` : ''}<p class="ar-hint ar-bottom-note">Escolha as peças e clique em Equipar para salvar na classe.</p>`}</section></div>`;
    }
    host.innerHTML = `<header class="ar-header"><div><p>${esc(crumb)}</p><h1>${step === 1 ? 'Arsenal do chiqueiro' : step === 2 ? 'Escolher arma' : 'Customizar'}</h1></div><nav class="ar-actions">${actions}</nav></header>${content}<p class="ar-feedback" aria-live="polite"></p>`;
    if (restoreFocus) host.focus({ preventScroll: true });
    if (step === 3 && api.saber(weapon)) {
      const colors = api.saber(weapon);
      const palette = document.createElement('div');
      palette.className = 'ar-saber-colors';
      palette.setAttribute('aria-label', 'Cor do sabre');
      palette.innerHTML = colors.colors.map(c => `<button type="button" class="ar-saber-color" data-saber="${esc(c.hex)}" style="background:${esc(c.hex)}" aria-label="${esc(c.id)}" title="${esc(c.id)}" aria-pressed="${c.hex === colors.selected}"></button>`).join('');
      host.querySelector('.ar-workbench').appendChild(palette);
    }
    if (busy) host.querySelectorAll('button, input').forEach(el => { el.disabled = true; });
    const mount = host.querySelector('.ar-viewer-mount');
    if (mount) {
      if (!viewer) viewer = createWeaponViewer();
      viewer.show(mount, api.model(weapon, step === 3 ? skinId : skins.equipped), camo, clone => api.prepareSkin(weapon, step === 3 ? skinId : skins.equipped, clone));
    }
  }
  host.addEventListener('click', async event => {
    const b = event.target.closest('button');
    if (!b || !host.contains(b) || busy) return;
    if (b.dataset.saber) { api.colorSaber(b.dataset.saber); render(); }
    else if (b.dataset.class != null) { api.arm(+b.dataset.class); render(); }
    else if (b.dataset.slot) pickSlot(b.dataset.slot);
    else if (b.dataset.category) { category = b.dataset.category; weapon = api.pool(CATEGORIES.find(c => c.id === category).weapons)[0] ?? weapon; kit = {}; render(); }
    else if (b.dataset.weapon != null) { weapon = +b.dataset.weapon; kit = {}; render(); }
    else if (b.dataset.part) { part = b.dataset.part; tab = 'parts'; render(); }
    else if (b.dataset.piece != null) { kit = clampKit(weapon, { ...kit, [part]: b.dataset.piece }); render(); }
    else if (b.dataset.skin != null) { skinId = b.dataset.skin; camo = 0; render(); }
    else if (b.dataset.camo != null) { camo = +b.dataset.camo; render(); }
    else switch (b.dataset.action) {
      case 'classes': step = 1; render(); break;
      case 'weapons': step = 2; camo = 0; render(); break;
      case 'customize': customize(); break;
      case 'skin-preview': camo = 0; render(); break;
      case 'skins': tab = 'skins'; render(); break;
      case 'parts': tab = 'parts'; render(); break;
      case 'equip': {
        busy = true; render();
        try {
          const result = await api.equipSkin(weapon, skinId);
          if (result.error) { busy = false; render(); host.querySelector('.ar-feedback').textContent = result.error; break; }
          api.equip(slot, weapon, kit); step = 1;
          busy = false; render(); host.querySelector('.ar-feedback').textContent = 'Arma equipada, skin e classe salvas.';
        } catch {
          busy = false; render(); host.querySelector('.ar-feedback').textContent = 'Não deu para salvar a skin. Tente de novo.';
        }
        break;
      }
      case 'arm': api.arm(api.snapshot().index); host.querySelector('.ar-feedback').textContent = 'Classe equipada. Tudo pronto para o tiroteio!'; break;
      case 'close': api.close(); break;
      case 'shoot': api.shoot(); break;
      case 'truco': api.truco(); break;
    }
  });
  host.addEventListener('change', e => {
    if (e.target.id === 'arsenalClassName') { api.rename(e.target.value); render(); }
  });
  return { render, back() { if (busy) return true; if (step === 1) return false; step--; camo = 0; render(); return true; } };
}
