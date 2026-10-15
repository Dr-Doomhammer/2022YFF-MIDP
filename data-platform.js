(() => {
  'use strict';
  const species = {
    cathaya: { name: '银杉', color: '#6ca14a' },
    pinus: { name: '巧家五针松', color: '#e5ac43' },
    parrotia: { name: '银缕梅', color: '#ca7caf' },
    dipteronia: { name: '云南金钱槭', color: '#58bdb0' },
    cypripedium: { name: '暖地杓兰', color: '#eb8856' },
    oreochoris: { name: '辐花苣苔', color: '#87a9ea' },
  };
  const ranks = [
    ['phylum', '门（Phylum）'], ['class', '纲（Class）'], ['order', '目（Order）'],
    ['family', '科（Family）'], ['genus', '属（Genus）'],
  ];
  const config = window.MICROBE_PLATFORM_CONFIG || { samples: [] };
  const byId = id => document.getElementById(id);
  const mapStatus = byId('map-status');
  const markerById = new Map();
  const visibleSpecies = new Set(Object.keys(species));
  let selectedSample = null;
  let map;
  const samples = [];
  const ids = new Set();
  let invalidCount = 0;
  for (const point of config.samples || []) {
    const valid = typeof point.id === 'string' && point.id.trim() && !ids.has(point.id)
      && species[point.species] && typeof point.place === 'string' && point.place.trim()
      && point.coordinateSystem === 'GCJ-02'
      && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180
      && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 85;
    if (!valid) { invalidCount++; continue; }
    ids.add(point.id);
    samples.push(point);
  }

  for (const [key, entry] of Object.entries(species)) {
    const item = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) visibleSpecies.add(key);
      else visibleSpecies.delete(key);
      for (const point of samples.filter(point => point.species === key)) {
        const marker = markerById.get(point.id);
        if (!marker || !map) continue;
        if (checkbox.checked) marker.addTo(map);
        else map.removeLayer(marker);
      }
      if (!checkbox.checked && selectedSample?.species === key) selectSample(null);
    });
    const swatch = document.createElement('span');
    swatch.className = 'sample-swatch';
    swatch.style.backgroundColor = entry.color;
    swatch.setAttribute('aria-hidden', 'true');
    label.append(checkbox, swatch, entry.name);
    item.append(label);
    byId('sample-legend').append(item);
  }
  if (invalidCount) {
    console.warn(`${invalidCount} 个点坐标或信息待确认，未显示在地图上。`);
  }

  // 每个面板独立保存层级、暂停状态与计时器。
  const communities = ['fungi', 'bacteria'].map(group => {
    const panel = byId(`${group}-panel`);
    const select = byId(`${group}-rank`);
    const toggle = byId(`${group}-auto`);
    const chart = byId(`${group}-chart`);
    const state = { rank: 'phylum', running: true, timer: null, hovered: false, focused: false };
    function render() {
      select.value = state.rank;
      chart.dataset.rank = state.rank;
      chart.dataset.sampleId = selectedSample?.id || '';
      chart.querySelector('.community-rank').textContent = ranks.find(rank => rank[0] === state.rank)[1];
      panel.querySelector('.community-point').textContent = selectedSample
        ? `当前样点：${selectedSample.name || selectedSample.id}\n当前物种：${selectedSample.speciesName || species[selectedSample.species].name}\n当前地点：${selectedSample.place}` : '尚未选择采样点';
      chart.querySelector('p').textContent = selectedSample
        ? '该采样点的群落组成数据待接入' : '采样点与群落组成数据待接入';
      // 饼图只使用预先计算的样点汇总数据。
      chart.dispatchEvent(new CustomEvent('communitychange', {
        bubbles: true, detail: { group, rank: state.rank, sample: selectedSample },
      }));
    }
    function schedule() {
      clearTimeout(state.timer);
      if (!state.running || document.hidden || state.hovered || state.focused) return;
      state.timer = setTimeout(() => {
        const index = ranks.findIndex(rank => rank[0] === state.rank);
        state.rank = ranks[(index + 1) % ranks.length][0];
        render();
        schedule();
      }, 15000);
    }
    select.addEventListener('change', () => {
      state.rank = select.value;
      render();
      schedule();
    });
    toggle.addEventListener('click', () => {
      state.running = !state.running;
      toggle.textContent = state.running ? '暂停自动切换' : '继续自动切换';
      byId(`${group}-auto-status`).textContent = state.running
        ? '每15秒自动切换分类层级' : '自动切换已暂停';
      schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    chart.addEventListener('pointerenter', () => { state.hovered = true; schedule(); });
    chart.addEventListener('pointerleave', () => { state.hovered = false; schedule(); });
    chart.addEventListener('focusin', () => { state.focused = true; schedule(); });
    chart.addEventListener('focusout', event => {
      state.focused = chart.contains(event.relatedTarget); schedule();
    });
    render();
    schedule();
    return { render, schedule };
  });

  function selectSample(point, openPopup = false) {
    selectedSample = point;
    for (const [id, marker] of markerById) {
      marker.getElement()?.classList.toggle('is-selected', id === point?.id);
      marker.setZIndexOffset(id === point?.id ? 1000 : 0);
    }
    if (point && openPopup && map) {
      map.panTo([point.latitude, point.longitude]);
      markerById.get(point.id)?.openPopup();
    } else if (!point) map?.closePopup();
    for (const community of communities) { community.render(); community.schedule(); }
  }



  if (!window.L) {
    mapStatus.textContent = '地图组件未加载，请刷新页面重试。';
    byId('map-reset').disabled = true;
    return;
  }
  const initialView = config.initialView || { center: [29, 109], zoom: 5 };
  map = L.map('sampling-map', { scrollWheelZoom: false, minZoom: 3, maxZoom: 19,
    zoomControl: false, attributionControl: true });
  L.control.zoom({ position: 'topright', zoomInTitle: '放大地图', zoomOutTitle: '缩小地图' }).addTo(map);
  const legendControl = L.control({ position: 'topleft' });
  legendControl.onAdd = () => {
    const legend = byId('sample-legend');
    L.DomEvent.disableClickPropagation(legend);
    L.DomEvent.disableScrollPropagation(legend);
    return legend;
  };
  legendControl.addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  const baseLayers = [
    { name: '高德影像', style: 6 },
    { name: '高德地图', style: 7 },
  ].map(entry => ({
    ...entry,
    layer: L.tileLayer(
      'https://webst0{s}.is.autonavi.com/appmaptile?style=' + entry.style + '&x={x}&y={y}&z={z}',
      { subdomains: '1234', maxNativeZoom: 18, maxZoom: 19,
        attribution: '&copy; <a href="https://www.amap.com/" target="_blank" rel="noopener noreferrer">高德地图 AutoNavi</a>' },
    ),
  }));
  let activeBase = baseLayers[0];
  let loadingTimeout;
  const choices = document.createElement('li');
  choices.className = 'map-base-choices';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', '地图底图');
  for (const entry of baseLayers) {
    let loaded = 0, failed = 0;
    entry.layer.on('loading', () => {
      if (activeBase !== entry) return;
      loaded = 0; failed = 0;
      mapStatus.textContent = entry.name + '加载中…';
      clearTimeout(loadingTimeout);
      loadingTimeout = setTimeout(() => {
        if (activeBase === entry && !loaded) {
          mapStatus.textContent = entry.name + '暂未加载，请检查网络或重试。';
          byId('map-retry').hidden = false;
        }
      }, 15000);
    });
    entry.layer.on('tileload', () => { if (activeBase === entry) loaded++; });
    entry.layer.on('tileerror', () => { if (activeBase === entry) failed++; });
    entry.layer.on('load', () => {
      if (activeBase !== entry) return;
      clearTimeout(loadingTimeout);
      mapStatus.textContent = failed
        ? (loaded ? '部分底图未加载，可重试。' : entry.name + '暂未加载，请检查网络或重试。')
        : entry.name;
      byId('map-retry').hidden = !failed;
    });
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'map-base-layer'; radio.value = String(entry.style);
    radio.checked = entry === activeBase;
    radio.addEventListener('change', () => {
      if (!radio.checked || activeBase === entry) return;
      clearTimeout(loadingTimeout);
      const previous = activeBase;
      activeBase = entry;
      map.removeLayer(previous.layer);
      byId('map-retry').hidden = true;
      mapStatus.textContent = entry.name + '加载中…';
      entry.layer.addTo(map);
    });
    label.append(radio, entry.name);
    choices.append(label);
  }
  byId('sample-legend').prepend(choices);
  activeBase.layer.addTo(map);
  byId('map-retry').textContent = '重新加载底图';
  byId('map-retry').addEventListener('click', () => activeBase.layer.redraw());

  for (const point of samples) {
    const entry = species[point.species];
    const marker = L.marker([point.latitude, point.longitude], {
      title: `${entry.name} · ${point.place}`, alt: `${entry.name}，${point.place}，采样点 ${point.id}`,
      icon: L.divIcon({ className: 'sampling-marker', iconSize: [26, 26], iconAnchor: [13, 13],
        html: `<span style="background:${entry.color}"></span>` }),
    }).addTo(map);
    const popup = document.createElement('div');
    popup.className = 'sample-popup';
    const name = document.createElement('strong'); name.textContent = point.name || point.id;
    const latin = document.createElement('i'); latin.textContent = point.scientificName || '';
    latin.lang = 'la';
    const details = document.createElement('dl');
    for (const [label, value] of [['物种名', point.speciesName || entry.name], ['地点名', point.place], ['采集人', point.collector || '待补充']]) {
      const row = document.createElement('div');
      const term = document.createElement('dt'); term.textContent = label;
      const description = document.createElement('dd'); description.textContent = value;
      row.append(term, description); details.append(row);
    }
    const view = document.createElement('button');
    view.type = 'button'; view.className = 'sample-popup-view'; view.textContent = '查看微生物群落 ↓';
    view.addEventListener('click', () => {
      selectSample(point);
      byId('fungi-panel').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    popup.append(name, latin, details, view);
    marker.bindPopup(popup, { maxWidth: 290, minWidth: 210, autoPanPadding: [20, 20] })
      .on('click', () => selectSample(point));
    markerById.set(point.id, marker);
  }
  function resetView() {
    const visibleSamples = samples.filter(point => visibleSpecies.has(point.species));
    if (visibleSamples.length) map.fitBounds(visibleSamples.map(point => [point.latitude, point.longitude]), { padding: [40, 40], maxZoom: 13 });
    else map.setView(initialView.center, initialView.zoom);
  }
  byId('map-reset').addEventListener('click', resetView);
  resetView();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(byId('sampling-map'));
  }
})();
