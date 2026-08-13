import * as THREE from 'three';
import './style.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const smoothstep = (start, end, value) => {
  const x = clamp((value - start) / Math.max(.0001, end - start), 0, 1);
  return x * x * (3 - 2 * x);
};
const rangeFade = (value, start, end, feather = .045) => smoothstep(start, start + feather, value) * (1 - smoothstep(end - feather, end, value));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const dossierDetails = {
  diablo: {
    title: 'DIABLO / NOIR',
    body: 'Primordial Black appears as an elegant, pale man with black hair marked by red and gold, amber eyes, and immaculate formalwear. His machine namesake is the original Lamborghini Diablo: a Marcello Gandini-born wedge sharpened for the 1990s, defined by pop-up lamps, scissor doors, a mid-mounted V12, and impossible width.',
    tags: ['BLACK / NOIR', 'TEMPTATION', '5.7L V12', 'SCISSOR DOORS'],
  },
  testarossa: {
    title: 'TESTAROSSA / BLANC',
    body: 'Primordial White is described with waist-long white hair, crimson eyes, and the bearing of a high diplomat. The 1984 Ferrari Testarossa mirrors that composure in a Pininfarina form: clean planes, an ultra-wide tail, and horizontal side strakes engineered to feed its side-mounted radiators.',
    tags: ['WHITE / BLANC', 'DEATH KING', 'FLAT-12', 'SIDE STRAKES'],
  },
  carrera: {
    title: 'CARRERA / JAUNE',
    body: 'Primordial Yellow carries shoulder-length blonde hair, blue eyes, a black coat, and a notorious taste for overwhelming force. The Carrera GT is its mechanical equal: a carbon structure, mid-mounted 5.7-litre V10, six-speed manual gearbox, and the restraint of a prototype racer let loose on the road.',
    tags: ['YELLOW / JAUNE', 'EXTINCTION', '5.7L V10', 'CARBON MONOCOQUE'],
  },
  ultima: {
    title: 'ULTIMA / VIOLET',
    body: 'Primordial Purple looks youthful, with violet hair tied to one side and a black skirted uniform. The British Ultima GTR shares the same deceptive compactness: a light tubular space frame, rear-mid V8 layout, bubble canopy, huge rear wing, and acceleration that turned a specialist machine into a record-setter.',
    tags: ['PURPLE / VIOLET', 'POISON', 'V8', 'SPACE FRAME'],
  },
};

class ParallaxScene {
  constructor(section) {
    this.section = section;
    this.container = section.querySelector('.webgl-stage');
    this.imageUrl = section.dataset.image;
    this.accent = section.dataset.accent;
    this.isReverse = section.classList.contains('is-reverse');
    this.targetX = 0;
    this.targetY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.scrollTarget = 0;
    this.scrollCurrent = 0;
    this.active = false;
    this.ready = false;
    this.disposed = false;
    this.layers = [];
    this.clock = new THREE.Clock();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.active = entry.isIntersecting;
      if (this.active && this.ready) this.renderFrame();
    }, { rootMargin: '35% 0px' });
    this.onPointerMove = this.onPointerMove.bind(this);
    this.renderFrame = this.renderFrame.bind(this);
  }

  async init() {
    if (!this.container || reducedMotion) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x050505, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    const texture = await new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(this.imageUrl, (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.minFilter = THREE.LinearMipmapLinearFilter;
        loaded.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        resolve(loaded);
      }, undefined, reject);
    });

    const imageAspect = texture.image.naturalWidth / texture.image.naturalHeight || 1376 / 768;
    const imageMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.imagePlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imageMaterial);
    this.imagePlane.position.set(0, 0, -0.15);
    this.imagePlane.renderOrder = 1;
    this.imagePlane.userData = { base: [0, 0, -0.15], pFactor: 0.055, scrollFX: this.isReverse ? -0.09 : 0.09, scrollFY: 0.11, imageAspect };
    this.scene.add(this.imagePlane);
    this.layers.push(this.imagePlane);

    const ringTexture = this.makeRingTexture(this.accent);
    const ringMaterial = new THREE.MeshBasicMaterial({
      map: ringTexture,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), ringMaterial);
    this.ring.position.set(this.isReverse ? -1.75 : 1.75, 0.2, 0.2);
    this.ring.renderOrder = 2;
    this.ring.userData = { base: [this.ring.position.x, this.ring.position.y, .2], pFactor: .2, scrollFX: this.isReverse ? -.38 : .38, scrollFY: .08 };
    this.scene.add(this.ring);
    this.layers.push(this.ring);

    this.grid = this.makeGridLayer(this.accent);
    this.grid.position.set(this.isReverse ? -1.25 : 1.25, -.1, .32);
    this.grid.renderOrder = 3;
    this.grid.userData = { base: [this.grid.position.x, this.grid.position.y, .32], pFactor: .27, scrollFX: this.isReverse ? -.2 : .2, scrollFY: -.16 };
    this.scene.add(this.grid);
    this.layers.push(this.grid);

    this.particles = this.makeParticles(this.accent);
    this.particles.renderOrder = 4;
    this.particles.userData = { base: [0, 0, .5], pFactor: .41, scrollFX: this.isReverse ? -.28 : .28, scrollFY: .3 };
    this.scene.add(this.particles);
    this.layers.push(this.particles);

    this.resizeObserver.observe(this.container);
    this.intersectionObserver.observe(this.section);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.ready = true;
    this.container.classList.add('is-ready');
    this.resize();
    this.renderFrame();
  }

  makeRingTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 768;
    const ctx = canvas.getContext('2d');
    const c = new THREE.Color(color);
    const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
    ctx.clearRect(0, 0, 768, 768);
    ctx.translate(384, 384);
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.lineWidth = i === 0 ? 2.5 : 1;
      ctx.strokeStyle = `rgba(${rgb}, ${0.55 - i * .065})`;
      const radius = 122 + i * 42;
      ctx.arc(0, 0, radius, -Math.PI * .18 + i * .12, Math.PI * (1.14 + i * .055));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.fillStyle = `rgba(${rgb}, .9)`;
    ctx.arc(0, -332, 3.4, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  makeGridLayer(color) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const c = new THREE.Color(color);
    const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
    ctx.strokeStyle = `rgba(${rgb}, .2)`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${rgb}, .62)`;
    ctx.strokeRect(192, 192, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: .2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), material);
  }

  makeParticles(color) {
    const count = window.innerWidth < 700 ? 48 : 105;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - .5) * 8.6;
      positions[i * 3 + 1] = (Math.random() - .5) * 5;
      positions[i * 3 + 2] = .35 + Math.random() * .6;
      sizes[i] = .5 + Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({
      color,
      size: .022,
      sizeAttenuation: true,
      transparent: true,
      opacity: .72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    return new THREE.Points(geometry, material);
  }

  onPointerMove(event) {
    this.targetX = (event.clientX / window.innerWidth - .5) * 2;
    this.targetY = -(event.clientY / window.innerHeight - .5) * 2;
  }

  resize() {
    if (!this.ready) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    const distance = this.camera.position.z - this.imagePlane.position.z;
    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * distance;
    const visibleWidth = visibleHeight * this.camera.aspect;
    const imageAspect = this.imagePlane.userData.imageAspect;
    let planeWidth;
    let planeHeight;
    if (visibleWidth / visibleHeight > imageAspect) {
      planeWidth = visibleWidth * 1.035;
      planeHeight = planeWidth / imageAspect;
    } else {
      planeHeight = visibleHeight * 1.035;
      planeWidth = planeHeight * imageAspect;
    }
    this.imagePlane.scale.set(planeWidth, planeHeight, 1);
  }

  updateScrollProgress() {
    const rect = this.section.getBoundingClientRect();
    const viewport = window.innerHeight;
    const middle = rect.top + rect.height * .5;
    this.scrollTarget = clamp((viewport * .5 - middle) / (viewport * .5 + rect.height * .5), -1.4, 1.4);
  }

  renderFrame() {
    if (!this.ready || this.disposed) return;
    if (!this.active) {
      requestAnimationFrame(this.renderFrame);
      return;
    }
    this.updateScrollProgress();
    this.currentX = lerp(this.currentX, this.targetX, .055);
    this.currentY = lerp(this.currentY, this.targetY, .055);
    this.scrollCurrent = lerp(this.scrollCurrent, this.scrollTarget, .06);

    this.camera.rotation.y = this.currentX * .023;
    this.camera.rotation.x = this.currentY * .016;

    this.layers.forEach((layer) => {
      const [baseX, baseY] = layer.userData.base;
      const factor = layer.userData.pFactor || 0;
      const scrollX = layer.userData.scrollFX || 0;
      const scrollY = layer.userData.scrollFY || 0;
      layer.position.x = baseX + this.currentX * factor + scrollX * this.scrollCurrent;
      layer.position.y = baseY + this.currentY * factor + scrollY * this.scrollCurrent;
    });

    const elapsed = this.clock.getElapsedTime();
    this.ring.rotation.z = elapsed * (this.isReverse ? -.025 : .025);
    this.grid.rotation.z = -elapsed * (this.isReverse ? -.008 : .008);
    this.particles.rotation.z = Math.sin(elapsed * .08) * .025;
    const positions = this.particles.geometry.attributes.position;
    for (let i = 1; i < positions.array.length; i += 3) {
      positions.array[i] += Math.sin(elapsed * .65 + i) * .00016;
      if (positions.array[i] > 2.7) positions.array[i] = -2.7;
    }
    positions.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.renderFrame);
  }
}

function preloadImages(urls, onProgress) {
  let loaded = 0;
  return Promise.all(urls.map((src) => new Promise((resolve) => {
    const image = new Image();
    const done = () => {
      loaded += 1;
      onProgress(loaded / urls.length);
      resolve();
    };
    image.onload = done;
    image.onerror = done;
    image.src = src;
  })));
}

async function runLoader() {
  document.body.classList.add('is-loading');
  const loader = document.getElementById('loader');
  const percent = document.getElementById('loaderPercent');
  const bar = document.getElementById('loaderBar');
  const urls = [...document.querySelectorAll('[data-image]')].map((element) => element.dataset.image);
  let visualProgress = 0;
  let actualProgress = 0;
  const paint = () => {
    visualProgress = lerp(visualProgress, actualProgress, .12);
    const value = Math.min(100, Math.round(visualProgress * 100));
    percent.textContent = String(value).padStart(2, '0');
    bar.style.width = `${value}%`;
    if (value < 100) requestAnimationFrame(paint);
  };
  paint();
  await preloadImages(urls, (value) => { actualProgress = .12 + value * .88; });
  actualProgress = 1;
  await new Promise((resolve) => setTimeout(resolve, 650));
  percent.textContent = '100';
  bar.style.width = '100%';
  loader.classList.add('is-hidden');
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
}

async function setupSplineCore() {
  const canvas = document.getElementById('splineCanvas');
  const stage = canvas?.closest('.spline-stage');
  if (!canvas || !stage || reducedMotion) return null;

  try {
    canvas.style.touchAction = 'pan-y';
    const { Application } = await import('@splinetool/runtime');
    const app = new Application(canvas, { renderMode: 'auto' });
    await app.load('/spline/primordial-core.splinecode');
    const objects = ['Cube', 'Cylinder 2', 'Cylinder 3', 'Cylinder 4']
      .map((name) => app.findObjectByName(name))
      .filter(Boolean);
    objects.forEach((object) => {
      object.userData ||= {};
      object.userData.filmBaseRotation = {
        x: object.rotation?.x || 0,
        y: object.rotation?.y || 0,
        z: object.rotation?.z || 0,
      };
    });
    stage.classList.add('is-ready');
    return { app, objects };
  } catch (error) {
    stage.classList.add('has-fallback');
    const status = stage.querySelector('.spline-status');
    if (status) status.innerHTML = '<span></span> LOCAL CORE / FALLBACK';
    console.warn('Spline prologue fell back to the local motion core.', error);
    return null;
  }
}

function setupCinematicPrologue(splinePromise) {
  const section = document.querySelector('.cinematic-prologue');
  if (!section) return;
  const images = [...section.querySelectorAll('.hero-image-stack img')];
  const imageStack = section.querySelector('.hero-image-stack');
  const stage = section.querySelector('.spline-stage');
  const titleCard = document.getElementById('heroTitleCard');
  const beats = [...section.querySelectorAll('.story-beat')];
  const subject = document.getElementById('heroSubject');
  const counter = document.getElementById('heroCounter');
  const subtitle = document.getElementById('filmSubtitle');
  const subjects = ['DIABLO / NOIR', 'TESTAROSSA / BLANC', 'CARRERA / JAUNE', 'ULTIMA / VIOLET'];
  const accents = ['#ff2f35', '#ff5365', '#ffc21c', '#b55cff'];
  const captions = [
    'Before names, there were colors.',
    'A name gave ancient power a place in the new world.',
    'Four legendary machines. Four silhouettes of impossible speed.',
    'Power found a body — and mythology found velocity.',
  ];
  let spline = null;
  let activeImage = -1;
  let ticking = false;
  let pointerX = 0;
  let pointerY = 0;

  splinePromise.then((result) => { spline = result; });

  const setActiveImage = (index) => {
    if (index === activeImage || index < 0) return;
    activeImage = index;
    images.forEach((image, i) => image.classList.toggle('is-active', i === index));
    subject.textContent = subjects[index];
    subject.style.color = accents[index];
    counter.textContent = `${String(index + 1).padStart(2, '0')} — 04`;
  };

  const update = () => {
    ticking = false;
    const rect = section.getBoundingClientRect();
    const progress = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight), 0, 1);
    const montage = smoothstep(.39, .72, progress);
    const titleAlpha = smoothstep(.835, .93, progress);
    const splineAlpha = 1 - smoothstep(.54, .78, progress);

    stage.style.opacity = String(splineAlpha * .9);
    imageStack.style.opacity = String(.035 + montage * .93);
    titleCard.style.opacity = String(titleAlpha);
    titleCard.style.transform = `scale(${lerp(1.075, 1, titleAlpha)})`;
    titleCard.style.filter = `blur(${lerp(13, 0, titleAlpha)}px)`;
    titleCard.classList.toggle('is-present', titleAlpha > .82);

    let visibleBeat = -1;
    beats.forEach((beat, index) => {
      const start = Number(beat.dataset.start);
      const end = Number(beat.dataset.end);
      const alpha = rangeFade(progress, start, end, Math.min(.045, (end - start) * .3));
      const local = clamp((progress - start) / Math.max(.001, end - start), 0, 1);
      beat.style.opacity = String(alpha);
      beat.style.transform = `translate3d(0, ${(0.48 - local) * 64}px, 0) scale(${lerp(.985, 1.01, local)})`;
      beat.style.filter = `blur(${(1 - alpha) * 9}px)`;
      if (alpha > .35) visibleBeat = index;
    });

    if (montage > .04) {
      const imageIndex = clamp(Math.floor((progress - .4) / .105), 0, 3);
      setActiveImage(imageIndex);
    } else {
      subject.textContent = 'PRIMORDIAL CORE / UNNAMED';
      subject.style.color = '';
      counter.textContent = '00 — 04';
    }

    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      subtitle.textContent = titleAlpha > .72 ? 'Four names. Four demons. The film begins.' : captions[Math.max(0, visibleBeat)];
    }

    if (spline?.objects?.length) {
      spline.objects.forEach((object, index) => {
        const base = object.userData.filmBaseRotation;
        if (!object.rotation || !base) return;
        object.rotation.x = base.x + Math.sin(progress * Math.PI * 3 + index) * .18 + pointerY * .08;
        object.rotation.y = base.y + progress * (1.4 + index * .19) + pointerX * .13;
        object.rotation.z = base.z + Math.cos(progress * Math.PI * 2 + index) * .1;
      });
      spline.app.requestRender?.();
    }
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  window.addEventListener('pointermove', (event) => {
    pointerX = (event.clientX / window.innerWidth - .5) * 2;
    pointerY = (event.clientY / window.innerHeight - .5) * 2;
    requestUpdate();
  }, { passive: true });
  update();
}

function setupScrollUI() {
  const topbar = document.getElementById('topbar');
  const rail = document.getElementById('chapterRail');
  const railProgress = document.getElementById('railProgress');
  const filmAct = document.getElementById('filmAct');
  const filmTimecode = document.getElementById('filmTimecode');
  const subtitle = document.getElementById('filmSubtitle');
  const prologue = document.getElementById('prologue');
  const chapters = [...document.querySelectorAll('.chapter')];
  const railLinks = [...rail.querySelectorAll('a')];
  const first = chapters[0];
  const last = chapters[chapters.length - 1];
  const chapterStories = {
    diablo: ['ACT I / NOIR', 'He arrived with a bow — and the certainty of a closing trap.', 'A V12 wedge gave his menace a silhouette.', 'Perfect loyalty. Predatory velocity.'],
    testarossa: ['ACT II / BLANC', 'Diplomacy was only the velvet sheath.', 'Twelve cylinders and side strakes: precision made theatrical.', 'White silk over scarlet intent.'],
    carrera: ['ACT III / JAUNE', 'She never mistook restraint for virtue.', 'A race-born V10 answered force with force.', 'Sunlight, weaponized at full throttle.'],
    ultima: ['ACT IV / VIOLET', 'The smallest smile concealed the widest blast radius.', 'A space frame, a V8, and no patience for compromise.', 'Curiosity became catastrophe.'],
  };
  let ticking = false;

  const formatTimecode = (documentProgress) => {
    const totalFrames = Math.floor(documentProgress * 11.7 * 60 * 24);
    const frames = totalFrames % 24;
    const totalSeconds = Math.floor(totalFrames / 24);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    return [hours, minutes, seconds, frames].map((value) => String(value).padStart(2, '0')).join(':');
  };

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    topbar.classList.toggle('is-scrolled', y > 40);
    filmTimecode.textContent = formatTimecode(y / scrollMax);

    const firstTop = first.offsetTop - window.innerHeight * .55;
    const lastBottom = last.offsetTop + last.offsetHeight - window.innerHeight * .4;
    rail.classList.toggle('is-visible', y > firstTop && y < lastBottom);
    const fullProgress = clamp((y - firstTop) / Math.max(1, lastBottom - firstTop), 0, 1);
    railProgress.style.height = `${fullProgress * 100}%`;

    let activeChapter = null;
    let activeProgress = 0;
    chapters.forEach((chapter) => {
      const rect = chapter.getBoundingClientRect();
      const progress = clamp((-rect.top) / Math.max(1, rect.height - window.innerHeight), 0, 1);
      const titleCard = chapter.querySelector('.act-title-card');
      const hud = chapter.querySelector('.chapter-hud');
      const actAlpha = rect.top <= window.innerHeight && rect.bottom >= 0 ? 1 - smoothstep(.12, .255, progress) : 0;
      const hudAlpha = smoothstep(.17, .31, progress) * (1 - smoothstep(.93, 1, progress));
      const flash = clamp(1 - Math.abs(progress - .205) / .014, 0, 1) * .34;

      chapter.style.setProperty('--scene-scale', String(1.04 + progress * .095));
      chapter.style.setProperty('--scene-x', `${(chapter.classList.contains('is-reverse') ? -1 : 1) * progress * 2.2}vw`);
      chapter.style.setProperty('--flash-opacity', String(flash));
      titleCard.style.opacity = String(actAlpha);
      titleCard.style.transform = `scale(${lerp(.97, 1.025, 1 - actAlpha)})`;
      hud.style.opacity = String(hudAlpha);
      hud.style.transform = `translate3d(0, ${lerp(24, 0, hudAlpha)}px, 0)`;
      chapter.querySelector('.section-progress i').style.width = `${progress * 100}%`;

      const telemetry = chapter.querySelector('.telemetry-value');
      if (telemetry) {
        const base = Number.parseFloat(telemetry.textContent) || 0;
        telemetry.dataset.base ||= String(base);
        telemetry.textContent = `${(Number(telemetry.dataset.base) + progress * 48.7).toFixed(1)}°`;
      }
      if (rect.top <= window.innerHeight * .55 && rect.bottom >= window.innerHeight * .45) {
        activeChapter = chapter;
        activeProgress = progress;
      }
    });

    railLinks.forEach((link) => {
      const active = activeChapter && link.dataset.target === activeChapter.id;
      link.classList.toggle('is-active', Boolean(active));
      if (active) rail.style.setProperty('--rail-accent', activeChapter.dataset.accent);
    });

    if (activeChapter) {
      const story = chapterStories[activeChapter.id];
      filmAct.textContent = story[0];
      const lineIndex = activeProgress < .26 ? 1 : activeProgress < .63 ? 2 : 3;
      subtitle.textContent = story[lineIndex];
    } else if (prologue.getBoundingClientRect().bottom <= window.innerHeight * .25) {
      filmAct.textContent = y > last.offsetTop + last.offsetHeight ? 'EPILOGUE / FOUR COLORS' : 'INTERMISSION / ORIGIN';
      if (y > last.offsetTop + last.offsetHeight) subtitle.textContent = 'Four colors. One black number.';
    } else {
      filmAct.textContent = 'PROLOGUE / BEFORE NAMES';
    }
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  update();
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal-on-scroll').forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 4, 3) * .08}s`;
    observer.observe(element);
  });
}

function setupDialog() {
  const dialog = document.getElementById('archiveDialog');
  const title = document.getElementById('dialogTitle');
  const body = document.getElementById('dialogBody');
  const originalTitle = title.textContent;
  const originalBody = body.innerHTML;
  const openDefault = () => {
    title.textContent = originalTitle;
    body.innerHTML = originalBody;
    dialog.showModal();
  };
  document.getElementById('openArchive').addEventListener('click', openDefault);
  document.getElementById('openManifesto').addEventListener('click', openDefault);
  document.getElementById('footerArchive').addEventListener('click', openDefault);
  document.querySelectorAll('[data-inspect]').forEach((button) => {
    button.addEventListener('click', () => {
      const detail = dossierDetails[button.dataset.inspect];
      title.textContent = detail.title;
      body.innerHTML = `
        <p>${detail.body}</p>
        <div class="source-list">
          ${detail.tags.map((tag, index) => `<a href="#" onclick="return false"><span>0${index + 1}</span>${tag}</a>`).join('')}
        </div>`;
      dialog.showModal();
    });
  });
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function setupSound() {
  const button = document.getElementById('soundToggle');
  const label = button.querySelector('.sound-label');
  let enabled = false;
  let audioContext;
  let master;
  let filter;
  let droneA;
  let droneB;

  const buildAmbience = () => {
    if (audioContext) return;
    audioContext = new AudioContext();
    master = audioContext.createGain();
    master.gain.value = 0;
    master.connect(audioContext.destination);

    filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 1.8;
    filter.connect(master);

    const droneGain = audioContext.createGain();
    droneGain.gain.value = .022;
    droneGain.connect(filter);
    droneA = audioContext.createOscillator();
    droneA.type = 'sine';
    droneA.frequency.value = 43.65;
    droneA.connect(droneGain);
    droneA.start();
    droneB = audioContext.createOscillator();
    droneB.type = 'triangle';
    droneB.frequency.value = 65.41;
    const secondGain = audioContext.createGain();
    secondGain.gain.value = .009;
    droneB.connect(secondGain).connect(filter);
    droneB.start();

    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 118;
    noiseFilter.Q.value = .7;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.value = .005;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();
  };

  const ping = (frequency = 330, duration = .06) => {
    if (!enabled || !audioContext || !master) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .72, audioContext.currentTime + duration);
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  };

  button.addEventListener('click', async () => {
    buildAmbience();
    await audioContext.resume();
    enabled = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    label.textContent = enabled ? 'Score on' : 'Sound off';
    master.gain.cancelScheduledValues(audioContext.currentTime);
    master.gain.linearRampToValueAtTime(enabled ? .72 : 0, audioContext.currentTime + .8);
    if (enabled) ping(440, .14);
  });

  window.addEventListener('scroll', () => {
    if (!enabled || !audioContext) return;
    const progress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    filter.frequency.setTargetAtTime(170 + progress * 260, audioContext.currentTime, .18);
    droneA.detune.setTargetAtTime(Math.sin(progress * Math.PI * 8) * 18, audioContext.currentTime, .2);
    droneB.detune.setTargetAtTime(Math.cos(progress * Math.PI * 6) * 11, audioContext.currentTime, .2);
  }, { passive: true });

  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button') && !event.target.closest('#soundToggle')) ping(270 + Math.random() * 120);
  });
}

function setupMagneticButton() {
  const button = document.querySelector('.magnetic-button');
  if (!button || reducedMotion) return;
  button.addEventListener('pointermove', (event) => {
    const rect = button.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * .12;
    const y = (event.clientY - rect.top - rect.height / 2) * .16;
    button.style.transform = `translate(${x}px, ${y}px)`;
  });
  button.addEventListener('pointerleave', () => { button.style.transform = ''; });
}

function setupCursorGlow() {
  const glow = document.querySelector('.cursor-glow');
  if (!glow || reducedMotion) return;
  let tx = innerWidth / 2;
  let ty = innerHeight / 2;
  let x = tx;
  let y = ty;
  window.addEventListener('pointermove', (event) => { tx = event.clientX; ty = event.clientY; }, { passive: true });
  const animate = () => {
    x = lerp(x, tx, .08);
    y = lerp(y, ty, .08);
    glow.style.transform = `translate3d(${x - glow.offsetWidth / 2}px, ${y - glow.offsetHeight / 2}px, 0)`;
    requestAnimationFrame(animate);
  };
  animate();
}

async function boot() {
  runLoader();
  const splinePromise = setupSplineCore();
  setupCinematicPrologue(splinePromise);
  setupScrollUI();
  setupReveal();
  setupDialog();
  setupSound();
  setupMagneticButton();
  setupCursorGlow();

  if (!reducedMotion) {
    const scenes = [...document.querySelectorAll('.chapter')].map((section) => new ParallaxScene(section));
    for (const scene of scenes) {
      scene.init().catch((error) => console.warn(`Scene failed: ${scene.imageUrl}`, error));
    }
  }
}

boot();
