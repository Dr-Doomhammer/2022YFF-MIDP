(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const percent = value => value > 0 && value < 0.000001 ? '<0.0001%' : `${(value * 100).toFixed(value < 0.0001 ? 4 : 2)}%`;
  function color(item) {
    if (item.name === 'Unassigned') return '#959b9a';
    let hash = 0;
    for (const char of item.lineage) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
    return `hsl(${hash % 360} 58% ${43 + (hash % 3) * 8}%)`;
  }
  function sector(start, fraction) {
    const angle = start * 2 * Math.PI - Math.PI / 2;
    const end = angle + fraction * 2 * Math.PI;
    const point = theta => `${160 + 145 * Math.cos(theta)},${160 + 145 * Math.sin(theta)}`;
    if (fraction >= 1 - 1e-12) return 'M160,15 A145,145 0 1,1 160,305 A145,145 0 1,1 160,15 Z';
    return `M160,160 L${point(angle)} A145,145 0 ${fraction > .5 ? 1 : 0},1 ${point(end)} Z`;
  }
  function render(chart, { group, rank, sample }) {
    let visual = chart.querySelector('.community-visual');
    if (!visual) {
      visual = document.createElement('div'); visual.className = 'community-visual'; chart.append(visual);
    }
    visual.replaceChildren();
    const result = window.MICROBE_COMMUNITIES?.sites[sample?.id]?.[group];
    const values = result?.ranks[rank];
    chart.classList.toggle('has-chart', Boolean(values?.length));
    const status = chart.querySelector('p');
    status.hidden = Boolean(values?.length);
    if (!sample) { status.textContent = '请点击地图上的样点查看群落组成'; return; }
    if (!values?.length) { status.textContent = '该样点的群落计算结果暂不可用'; return; }
    status.textContent = '';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 320 320');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${group === 'fungi' ? '真菌' : '细菌'}群落饼图，可通过下方图例查看各分类相对丰度`);
    svg.classList.add('community-pie');
    const detail = document.createElement('div'); detail.className = 'community-tooltip';
    detail.setAttribute('role', 'status');
    const tipTitle = document.createElement('strong');
    const lineage = document.createElement('div');
    detail.append(tipTitle, lineage);
    tipTitle.textContent = '悬停扇区或选择图例查看详情';
    lineage.textContent = '显示相对丰度及对应分类路径';
    const search = document.createElement('input');
    search.type = 'search'; search.className = 'community-search'; search.placeholder = '查找分类名称';
    search.setAttribute('aria-label', '查找饼图分类');
    const legend = document.createElement('ul'); legend.className = 'community-chart-legend';
    let position = 0, active;
    const rows = [];
    for (const item of values) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', sector(position, item.value)); position += item.value;
      path.setAttribute('fill', color(item));
      const title = document.createElementNS(NS, 'title');
      title.textContent = `${item.lineage} · ${percent(item.value)}`; path.append(title);
      const li = document.createElement('li');
      const button = document.createElement('button'); button.type = 'button';
      const swatch = document.createElement('span'); swatch.className = 'chart-swatch'; swatch.style.background = color(item);
      swatch.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.className = 'chart-taxon'; name.textContent = item.name;
      const abundance = document.createElement('span'); abundance.textContent = percent(item.value);
      button.append(swatch, name, abundance);
      button.setAttribute('aria-label', `${item.lineage}，${percent(item.value)}`);
      const show = () => {
        active?.classList.remove('is-active'); active = path; path.classList.add('is-active');
        tipTitle.textContent = `${item.name} · ${percent(item.value)}`;
        lineage.textContent = item.lineage + (item.name === 'Unassigned' ? '（本层级未定分类的合计）' : '');
      };
      path.addEventListener('pointerenter', show); path.addEventListener('click', show);
      button.addEventListener('pointerenter', show); button.addEventListener('focus', show); button.addEventListener('click', show);
      li.append(button); legend.append(li); rows.push([li, item.lineage.toLowerCase()]); svg.append(path);
    }
    const empty = document.createElement('div'); empty.className = 'community-no-match'; empty.hidden = true; empty.textContent = '未找到匹配分类';
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      for (const [row, text] of rows) row.hidden = !text.includes(query);
      empty.hidden = rows.some(([row]) => !row.hidden);
    });
    visual.append(svg, detail, search, legend, empty);
    // 只淡入新饼图，提示和图例保持稳定；旧动画随旧 SVG 一并移除。
    if (typeof svg.animate === 'function' &&
        !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      svg.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 650, easing: 'ease-in-out',
      });
    }
  }
  for (const group of ['fungi', 'bacteria']) {
    const chart = document.getElementById(`${group}-chart`);
    chart.addEventListener('communitychange', event => render(chart, event.detail));
  }
})();
