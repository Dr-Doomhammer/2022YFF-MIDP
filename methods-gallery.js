(() => {
  'use strict';
  const photos = [
    ['金佛山国家级自然保护区（银杉）考察', 'JPG'],
    ['药山国家级自然保护区（巧家五针松）考察', 'JPG'],
    ['舜皇山国家级自然保护区（银杉）考察', 'JPG'],
    ['八面山国家级自然保护区（银杉）考察', 'JPG'],
    ['大沙河国家级自然保护区（银杉）考察', 'JPG'],
    ['花坪国家级自然保护区（银杉）考察', 'JPG'],
    ['大瑶山国家级自然保护区（银杉）考察', 'JPG'],
    ['地面激光雷达数据采集', 'jpg'],
    ['样品采集', 'JPG'],
  ].map(([title, extension]) => ({ title, src: `assets/${title}.${extension}` }));
  const get = id => document.getElementById(id);
  const gallery = get('methods-gallery');
  const image = get('methods-photo');
  const caption = get('methods-photo-title');
  const toggle = get('methods-auto-toggle');
  const dots = [];
  let index = 0;
  let autoEnabled = true;
  let visible = !('IntersectionObserver' in window);
  let timer;
  let requestId = 0;
  let loading = false;
  let preload;
  let displayedSrc;
  let fadeLayer;
  let fadeAnimation;

  function prepareFade(nextSrc) {
    fadeAnimation?.cancel();
    fadeLayer?.remove();
    fadeLayer = null;
    if (!displayedSrc || displayedSrc === nextSrc || !image.animate ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'methods-fade-layer';
    layer.setAttribute('aria-hidden', 'true');
    const background = get('methods-backdrop').cloneNode();
    background.removeAttribute('id');
    const previousImage = image.cloneNode();
    previousImage.removeAttribute('id');
    previousImage.alt = '';
    layer.append(background, previousImage);
    image.parentElement.append(layer);
    fadeLayer = layer;
    fadeAnimation = layer.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 650, easing: 'ease-in-out', fill: 'forwards',
    });
    fadeAnimation.onfinish = () => {
      layer.remove();
      if (fadeLayer === layer) fadeLayer = null;
    };
  }

  function schedule() {
    clearTimeout(timer);
    if (!autoEnabled || document.hidden || !visible || loading) return;
    timer = setTimeout(() => show(index + 1), 5000);
  }
  function show(nextIndex) {
    index = (nextIndex + photos.length) % photos.length;
    const target = index;
    const request = ++requestId;
    loading = true;
    clearTimeout(timer);
    const photo = photos[target];
    const pending = new Image();
    pending.onload = () => {
      if (request !== requestId) return;
      loading = false;
      prepareFade(photo.src);
      image.src = photo.src;
      image.alt = photo.title;
      displayedSrc = photo.src;
      // 主图完整显示；竖图两侧用同图的柔化背景填充。
      get('methods-backdrop').style.backgroundImage = `url("${encodeURI(photo.src)}")`;
      caption.textContent = photo.title;
      get('methods-photo-count').textContent = `${target + 1} / ${photos.length}`;
      for (const [i, dot] of dots.entries()) dot.setAttribute('aria-pressed', String(i === target));
      get('methods-gallery-error').hidden = true;
      // 只提前加载下一张，避免首屏一次请求全部大图。
      preload = new Image();
      preload.src = photos[(target + 1) % photos.length].src;
      schedule();
    };
    pending.onerror = () => {
      if (request !== requestId) return;
      loading = false;
      get('methods-gallery-error').textContent = `“${photo.title}”暂未加载，可切换其他照片。`;
      get('methods-gallery-error').hidden = false;
      schedule();
    };
    pending.src = photo.src;
  }
  photos.forEach((photo, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'methods-dot';
    dot.setAttribute('aria-label', `第${i + 1}张：${photo.title}`);
    dot.setAttribute('aria-pressed', String(i === 0));
    dot.title = photo.title;
    dot.addEventListener('click', () => show(i));
    dots.push(dot);
    get('methods-dots').append(dot);
  });
  get('methods-previous').addEventListener('click', () => show(index - 1));
  get('methods-next').addEventListener('click', () => show(index + 1));
  toggle.addEventListener('click', () => {
    autoEnabled = !autoEnabled;
    toggle.textContent = autoEnabled ? '暂停轮播' : '继续轮播';
    toggle.title = autoEnabled ? '每5秒自动切换' : '自动轮播已暂停';
    schedule();
  });
  gallery.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  document.addEventListener('visibilitychange', schedule);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      schedule();
    }, { threshold: 0.15 });
    observer.observe(gallery);
  }
  show(0);
})();
