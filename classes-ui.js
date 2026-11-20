// Painel das cinco classes e da bancada. Sem Three.js. O main.js entrega os números.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function photo(i, url, alt, big) {
  const s = document.createElement('span');
  s.className = 'wthumb' + (big ? ' is-big' : '');
  s.dataset.w = String(i);
  if (url) s.style.backgroundImage = `url("${url}")`;
  if (alt) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', alt); }
  else s.setAttribute('aria-hidden', 'true');
  return s;
}

function bars(host, list) {
  const box = document.createElement('div');
  box.className = 'gbars';
  for (const b of list || []) {
    const row = document.createElement('div');
    row.className = 'gbar';
    const tick = b.tick == null ? '' : `<em style="left:${b.tick.toFixed(1)}%"></em>`;
    row.innerHTML = `<span>${esc(b.label)}</span><span class="gtrack" aria-hidden="true"><i style="width:${b.fill.toFixed(1)}%"></i>${tick}</span><b>${esc(b.num)}</b>`;
    if (b.note) row.title = b.note;
    box.appendChild(row);
  }
  host.appendChild(box);
}

export function fillSheet(list, gun, spec) {
  if (!list || !gun || !spec) return;
  list.innerHTML = '';
  gun.innerHTML = '';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Classes salvas');
  for (const row of spec.rows) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'clsrow' + (row.on ? ' on' : '') + (row.last ? ' last' : '');
    b.dataset.i = String(row.i);
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', row.on ? 'true' : 'false');
    const kbd = document.createElement('kbd');
    kbd.textContent = String(row.i + 1);
    b.appendChild(kbd);
    b.appendChild(photo(row.weapon, spec.thumbs[row.weapon], ''));
    const meta = document.createElement('span');
    meta.className = 'clsmeta';
    meta.innerHTML = `<b>${esc(row.name)}</b><small>${esc(row.weaponName)}</small>`;
    b.appendChild(meta);
    if (row.last) {
      const tag = document.createElement('em');
      tag.className = 'clslast';
      tag.textContent = 'ÚLTIMO';
      b.appendChild(tag);
    }
    b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); spec.onPick(row.i); };
    list.appendChild(b);
  }
  const g = spec.gun;
  if (!g) return;
  const head = document.createElement('div');
  head.className = 'gs-head';
  head.innerHTML = `<b>${esc(g.name)}</b><small>${esc(g.className)}</small>`;
  gun.appendChild(head);
  const stage = document.createElement('div');
  stage.className = 'gs-stage';
  stage.appendChild(photo(g.weapon, spec.thumbs[g.weapon], g.name, true));
  for (const slot of g.slots) {
    const chip = document.createElement('div');
    chip.className = `gs-slot gs-${slot.id}`;
    chip.innerHTML = `<small>${esc(slot.label)}</small><b>${esc(slot.piece)}</b>`;
    stage.appendChild(chip);
  }
  if (!g.slots.length) {
    const empty = document.createElement('p');
    empty.className = 'gs-empty';
    empty.textContent = 'Essa peça da casa já vem temperada.';
    stage.appendChild(empty);
  }
  gun.appendChild(stage);
  const side = document.createElement('div');
  side.className = 'gs-side';
  for (const s of g.side || []) {
    const card = document.createElement('div');
    card.className = 'gs-side-card';
    card.appendChild(photo(s.weapon, spec.thumbs[s.weapon], ''));
    const t = document.createElement('span');
    t.innerHTML = `<small>${esc(s.label)}</small><b>${esc(s.name)}</b>${s.note ? `<em>${esc(s.note)}</em>` : ''}`;
    card.appendChild(t);
    side.appendChild(card);
  }
  gun.appendChild(side);
  bars(gun, g.bars);
  if (spec.hint) {
    const hint = document.createElement('p');
    hint.className = 'gs-hint';
    hint.textContent = spec.hint;
    gun.appendChild(hint);
  }
}

export function fillChips(host, spec) {
  if (!host || !spec) return;
  host.innerHTML = '';
  host.setAttribute('role', 'tablist');
  host.setAttribute('aria-label', 'Classes');
  for (const row of spec.rows) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'classchip' + (row.on ? ' on' : '') + (spec.thumbs ? ' has-guns' : '');
    b.dataset.i = String(row.i);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', row.on ? 'true' : 'false');
    const top = document.createElement('span');
    top.className = 'classchip-top';
    top.innerHTML = `<kbd>${row.i + 1}</kbd><span class="classchip-name">${esc(row.name)}</span>`;
    b.appendChild(top);
    if (spec.thumbs) {
      const guns = document.createElement('span');
      guns.className = 'classchip-guns';
      const ids = [row.primary ?? row.weapon, row.secondary, row.melee].filter((n) => n != null && n >= 0);
      for (const wi of ids) guns.appendChild(photo(wi, spec.thumbs[wi], ''));
      b.appendChild(guns);
      if (row.weaponName) {
        const sub = document.createElement('small');
        sub.className = 'classchip-sub';
        sub.textContent = row.weaponName;
        b.appendChild(sub);
      }
    }
    b.onclick = (ev) => { ev.preventDefault(); spec.onPick(row.i); };
    host.appendChild(b);
  }
}

export function fillBench(body, spec) {
  if (!body || !spec) return;
  body.innerHTML = '';
  if (!spec.slots.length) {
    const p = document.createElement('p');
    p.className = 'bench-empty';
    p.textContent = 'Essa peça da casa já vem temperada.';
    body.appendChild(p);
    return;
  }
  const tray = document.createElement('div');
  tray.className = 'bench-tray';
  const title = document.createElement('div');
  title.className = 'label2';
  title.textContent = spec.family;
  tray.appendChild(title);
  for (const w of spec.weapons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bench-gun' + (w.on ? ' on' : '');
    b.appendChild(photo(w.i, spec.thumbs[w.i], ''));
    const t = document.createElement('span');
    t.textContent = w.name;
    b.appendChild(t);
    b.onclick = () => spec.onWeapon(w.i);
    tray.appendChild(b);
  }
  if (spec.omit) {
    const note = document.createElement('p');
    note.className = 'bench-omit';
    note.textContent = spec.omit;
    tray.appendChild(note);
  }
  const work = document.createElement('div');
  work.className = 'bench-work';
  const tabs = document.createElement('div');
  tabs.className = 'bench-slots';
  tabs.setAttribute('role', 'tablist');
  for (const s of spec.slots) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bench-slot' + (s.on ? ' on' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', s.on ? 'true' : 'false');
    b.textContent = s.label;
    b.onclick = () => spec.onSlot(s.id);
    tabs.appendChild(b);
  }
  work.appendChild(tabs);
  const radios = document.createElement('div');
  radios.className = 'bench-pieces';
  radios.setAttribute('role', 'radiogroup');
  radios.setAttribute('aria-label', spec.slotLabel || 'Peças');
  for (const p of spec.pieces) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bench-piece' + (p.look ? ' look' : '') + (p.stamped ? ' stamped' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', p.look ? 'true' : 'false');
    b.innerHTML = `<b>${esc(p.name)}</b><small>${p.stamped ? 'Na arma' : p.look ? 'Olhando' : ''}</small>`;
    b.onclick = () => spec.onLook(p.id);
    radios.appendChild(b);
  }
  work.appendChild(radios);
  if (spec.rows.length) {
    const cmp = document.createElement('div');
    cmp.className = 'bench-cmp';
    cmp.innerHTML = '<div><small>Agora</small></div><div><small>Se carimbar</small></div>';
    const left = cmp.children[0], right = cmp.children[1];
    for (const row of spec.rows) {
      left.insertAdjacentHTML('beforeend', `<span>${esc(row.label)} <b>${esc(row.now)}</b></span>`);
      right.insertAdjacentHTML('beforeend', `<span>${esc(row.label)} <b>${esc(row.next)}</b></span>`);
    }
    if (!spec.rows.length) { /* a comparação só aparece quando o número muda */ }
    if (spec.rows.length) work.appendChild(cmp);
  }
  if (spec.blurb) {
    const q = document.createElement('p');
    q.className = 'bench-blurb';
    q.textContent = spec.blurb;
    work.appendChild(q);
  }
  const stamp = document.createElement('button');
  stamp.type = 'button';
  stamp.className = 'bench-stamp';
  stamp.textContent = spec.same ? 'Já está na arma' : 'Por na arma';
  stamp.disabled = !!spec.same;
  stamp.onclick = () => spec.onStamp();
  work.appendChild(stamp);
  const honest = document.createElement('p');
  honest.className = 'bench-honest';
  honest.textContent = 'Cone, recuo e zoom são o feeling da mira. O servidor garante pente, recarga, queda e parede.';
  work.appendChild(honest);
  body.appendChild(tray);
  body.appendChild(work);
}
