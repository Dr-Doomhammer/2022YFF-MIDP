const themeButton = document.querySelector('#theme-toggle');
const menuButton = document.querySelector('#menu-toggle');
const navigation = document.querySelector('#primary-nav');

const footerClock = document.querySelector('#footer-clock');
function updateFooterClock() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  footerClock.textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  footerClock.dateTime = now.toISOString();
}
updateFooterClock();
setInterval(updateFooterClock, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateFooterClock();
});

function updateThemeLabel() {
  const label = document.documentElement.dataset.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
}
updateThemeLabel();
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('microbe-theme', theme); } catch (_) {}
  updateThemeLabel();
});

function closeMenu() {
  navigation.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '打开导航菜单');
}
menuButton.addEventListener('click', () => {
  const open = navigation.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 961px)').addEventListener('change', closeMenu);

// 根据实际滚动位置标记当前板块；接近页尾时标记最后一个板块。
const sections = [...document.querySelectorAll('.content-section')];
const links = [...navigation.querySelectorAll('a')];
let scheduled = false;
function updateCurrentSection() {
  const boundary = document.querySelector('.site-header').getBoundingClientRect().height + 60;
  let current = null;
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= boundary) current = section.id;
  }
  if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections.at(-1).id;
  for (const link of links) {
    if (link.hash === `#${current}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  scheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(updateCurrentSection); }
}, { passive: true });
window.addEventListener('resize', updateCurrentSection);
updateCurrentSection();

// 已完成的物种正文来自对应 TXT；保留 HTML 中的段落、学名斜体及文献链接。
const speciesNames = {
  cathaya: '银杉',
  pinus: '巧家五针松',
  parrotia: '银缕梅',
  dipteronia: '云南金钱槭',
  cypripedium: '暖地杓兰',
  oreochoris: '辐花苣苔',
};
const speciesButtons = [...document.querySelectorAll('.species-hotspot')];
const speciesTitle = document.querySelector('#species-detail-link');
const speciesLinks = {
  cathaya: 'https://www.plantplus.cn/cn/sp/Cathaya%20argyrophylla?t=n',
  pinus: 'https://www.plantplus.cn/cn/sp/Pinus%20squamata?t=n',
  parrotia: 'https://www.plantplus.cn/cn/sp/Shaniodendron%20subaequale?t=n',
  dipteronia: 'https://www.plantplus.cn/cn/sp/Dipteronia%20dyeriana?t=n',
  cypripedium: 'https://www.plantplus.cn/cn/sp/Cypripedium%20subtropicum?t=n',
  oreochoris: 'https://www.plantplus.cn/cn/sp/Oreocharis%20esquirolii?t=n',
};
const speciesDescription = document.querySelector('#species-detail-description');
const speciesDescriptions = { cathaya: speciesDescription.innerHTML };
for (const key of Object.keys(speciesNames)) {
  const template = document.querySelector(`#species-description-${key}`);
  if (template) speciesDescriptions[key] = template.innerHTML;
}
const speciesPhoto = document.querySelector('#species-detail-photo');
const speciesPhotoCaption = document.querySelector('#species-photo-caption');
// 根据正文实际排版高度限制照片尺寸，短介绍保留可辨识的最小展示高度。
function updateSpeciesPhotoSize() {
  const textHeight = speciesDescription.getBoundingClientRect().height;
  const heightLimit = window.matchMedia('(max-width: 800px)').matches ? 360 : 560;
  const photoHeight = Math.min(heightLimit, Math.max(180, Math.round(textHeight)));
  speciesPhoto.style.setProperty('--species-photo-height', `${photoHeight}px`);
}
if (typeof ResizeObserver !== 'undefined') {
  const speciesTextObserver = new ResizeObserver(updateSpeciesPhotoSize);
  speciesTextObserver.observe(speciesDescription);
}
window.addEventListener('resize', updateSpeciesPhotoSize);
updateSpeciesPhotoSize();
const speciesPhotos = {
  cathaya: 'assets/银杉.JPG?v=1f1e792f59',
  pinus: 'assets/巧家五针松.jpg?v=c176b9b94f',
  parrotia: 'assets/银缕梅.jpg?v=b8a83945be',
  dipteronia: 'assets/云南金钱槭.jpg?v=f12bca3dbe',
  cypripedium: 'assets/暖地杓兰.jpg?v=8f914617f2',
  oreochoris: 'assets/辐花苣苔.jpg?v=abca84d8cb',
};
const speciesDetail = document.querySelector('#species-detail');
let speciesTransition;
let speciesTransitionId = 0;
async function selectSpecies(button) {
    const name = speciesNames[button.dataset.species];
    if (!name || button.getAttribute('aria-pressed') === 'true') return;
    const transitionId = ++speciesTransitionId;
    speciesTransition?.cancel();
    for (const item of speciesButtons) item.setAttribute('aria-pressed', String(item === button));
    const animate = typeof speciesDetail.animate === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate) {
      speciesTransition = speciesDetail.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 200, easing: 'ease-in', fill: 'forwards',
      });
      try { await speciesTransition.finished; } catch { return; }
      if (transitionId !== speciesTransitionId) return;
      speciesTransition.cancel();
    }
    speciesTitle.textContent = name;
    speciesTitle.href = speciesLinks[button.dataset.species];
    speciesDescription.innerHTML = speciesDescriptions[button.dataset.species]
      ?? `<p>${name}的物种介绍将在后续补充。</p>`;
    speciesPhoto.src = speciesPhotos[button.dataset.species];
    speciesPhoto.alt = `${name}照片`;
    speciesPhotoCaption.textContent = name;
    updateSpeciesPhotoSize();
    if (animate) {
      speciesTransition = speciesDetail.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 450, easing: 'ease-out',
      });
    }
}

const speciesAutoToggle = document.querySelector('#species-auto-toggle');
const speciesAutoStatus = document.querySelector('#species-auto-status');
let speciesAutoEnabled = true;
let speciesAutoTimer;
function scheduleSpeciesSwitch() {
  clearTimeout(speciesAutoTimer);
  if (!speciesAutoEnabled || document.hidden) return;
  speciesAutoTimer = setTimeout(() => {
    const current = speciesButtons.findIndex(button => button.getAttribute('aria-pressed') === 'true');
    selectSpecies(speciesButtons[(current + 1) % speciesButtons.length]);
    scheduleSpeciesSwitch();
  }, 30000);
}
for (const button of speciesButtons) {
  button.addEventListener('click', () => {
    selectSpecies(button);
    scheduleSpeciesSwitch();
  });
}
speciesAutoToggle.addEventListener('click', () => {
  speciesAutoEnabled = !speciesAutoEnabled;
  speciesAutoToggle.textContent = speciesAutoEnabled ? '暂停自动切换' : '继续自动切换';
  speciesAutoStatus.textContent = speciesAutoEnabled ? '每30秒自动切换物种' : '自动切换已暂停';
  scheduleSpeciesSwitch();
});
document.addEventListener('visibilitychange', scheduleSpeciesSwitch);
scheduleSpeciesSwitch();
