import * as THREE from 'three';
import { FABRICAS_DATA } from './temas/fabricasConfig.js';

// ================= CONFIGURAÇÃO / ESTADO =================
const DIF = 1.6;
const CHAVE_SAVE = 'megaTycoon3D_v3';
const PRECO_RENASC_BASE = 85000;
const NOMES_TIER = ['Oficina Básica', 'Iluminada', 'Tubulada', 'Automatizada', 'Robotizada', 'Holográfica', 'Lendária'];

let dinheiro = 100, renascimentos = 0;
let niveis = {};
let petsComprados = [];
let stats = { ganho: 0, itens: 0, compras: 0 };
let missaoIdx = 0, missaoBase = { ganho: 0, itens: 0, compras: 0 };
let multEvento = 1, eventoFim = 0, proxEvento = 45, elapsed = 0;
let estamina = 100, exausto = false;

const nv = id => niveis[id] || 0;
// Dificuldade pós-rebirth reforçada (exponencial em vez de linear)
const precoRenasc = () => Math.round(PRECO_RENASC_BASE * Math.pow(3.4, renascimentos));
const precoReal = b => Math.ceil(b * DIF * Math.pow(1.65, renascimentos));
const fmt = n => { const s = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']; let i = 0; while (n >= 1000 && i < s.length - 1) { n /= 1000; i++; } return (i ? n.toFixed(2) : Math.floor(n)) + s[i]; };

const PERKS = [
    { id: 'velocidade', nome: '⚡ Bota Turbo', base: 400, max: 3, cor: 0xf59e0b, desc: '+25% de velocidade' },
    { id: 'superPulo', nome: '🦘 Super Pulo', base: 600, max: 3, cor: 0xf59e0b, desc: 'Pulo mais alto' },
    { id: 'estamina', nome: '🔋 Tanque de Energia', base: 900, max: 3, cor: 0x84cc16, desc: '+50 de estamina' },
    { id: 'ima', nome: '🧲 Ímã de Coleta', base: 1800, max: 3, cor: 0x3b82f6, desc: 'Coleta de mais longe' },
    { id: 'autoColetor', nome: '🤖 Auto-Coletor', base: 2500, max: 1, cor: 0x3b82f6, desc: 'Recolhe dinheiro sozinho' },
    { id: 'sorte', nome: '🍀 Moeda da Sorte', base: 3000, max: 3, cor: 0x22c55e, desc: '+6% chance de item 3x' },
    { id: 'tecnico', nome: '🛠️ Técnico Robô', base: 4000, max: 1, cor: 0xef4444, desc: 'Conserta máquinas sozinho' },
    { id: 'overclock', nome: '🔥 Overclock', base: 5000, max: 3, cor: 0xef4444, desc: '+25% produção' }
];
const PETS = [
    { id: 'dog', nome: '🐶 Cachorro', mult: 0.25, base: 800, cor: 0xd97706 },
    { id: 'cat', nome: '🐱 Gato Neon', mult: 0.6, base: 3500, cor: 0x06b6d4 },
    { id: 'dragon', nome: '🐉 Dragão', mult: 1.5, base: 20000, cor: 0xfacc15, asas: true },
    { id: 'phoenix', nome: '🔥 Fênix', mult: 3, base: 60000, cor: 0xef4444, asas: true },
    { id: 'unicorn', nome: '🦄 Unicórnio', mult: 6, base: 150000, cor: 0xf0abfc, chifre: true }
];

// ================= ÁUDIO SINTETIZADO (WEB AUDIO API) =================
let somAtivo = true;
let audioCtx = null;
function tocarSom(tipo) {
    if (!somAtivo) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (tipo === 'cash') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (tipo === 'buy') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        } else if (tipo === 'break') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.linearRampToValueAtTime(110, now + 0.35);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
            osc.start(now); osc.stop(now + 0.38);
        } else if (tipo === 'rebirth') {
            osc.type = 'sine';
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => osc.frequency.setValueAtTime(f, now + i * 0.09));
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.start(now); osc.stop(now + 0.45);
        } else if (tipo === 'drop') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        }
    } catch (e) {}
}

// ================= DOM & FEEDBACK VISUAL =================
const $ = id => document.getElementById(id);
const canvas = $('gameCanvas'), labelsContainer = $('labels-container'), toastMsg = $('toast-msg'), floatingTexts = $('floating-texts');
let toastTimer;
function mostrarAviso(t) {
    toastMsg.textContent = t; toastMsg.style.opacity = '1';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastMsg.style.opacity = '0', 2800);
}

$('btn-sound').addEventListener('click', () => {
    somAtivo = !somAtivo;
    $('btn-sound').textContent = somAtivo ? '🔊 Som: ON' : '🔇 Som: OFF';
});

function spawnTextoFlutuante(worldPos, texto, cor = '#4ade80') {
    const proj = worldPos.clone().project(camera);
    if (proj.z >= 1) return;
    const el = document.createElement('div');
    el.className = 'float-cash';
    el.textContent = texto;
    el.style.color = cor;
    el.style.left = `${(proj.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-proj.y * 0.5 + 0.5) * innerHeight}px`;
    floatingTexts.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}

// ================= CENA =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 55, 165);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 240);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.95));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(25, 45, 30);
dirLight.castShadow = true;
Object.assign(dirLight.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 150 });
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

const baseplate = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.9 }));
baseplate.rotation.x = -Math.PI / 2; baseplate.receiveShadow = true; scene.add(baseplate);
const caminho = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 92), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
caminho.position.set(-20, 0.06, -3); caminho.receiveShadow = true; scene.add(caminho);

// Textura procedural listrada para animar as esteiras
function criarTexturaEsteira(corHex) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#' + new THREE.Color(corHex).getHexString();
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, 24, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 1);
    return tex;
}

// ================= JOGADOR & COLISÕES =================
function criarBonecoRoblox() {
    const p = new THREE.Group();
    const mP = new THREE.MeshStandardMaterial({ color: 0xfacc15 }), mT = new THREE.MeshStandardMaterial({ color: 0x2563eb }), mC = new THREE.MeshStandardMaterial({ color: 0x16a34a });
    const bx = (w, h, d, m, x, y) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, 0); return o; };
    const pernaE = bx(.45, 1, .45, mC, -.25, .5), pernaD = bx(.45, 1, .45, mC, .25, .5), torso = bx(1, 1, .5, mT, 0, 1.5);
    const bracoE = bx(.4, 1, .45, mP, -.75, 1.5), bracoD = bx(.4, 1, .45, mP, .75, 1.5);
    const cabeca = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .6, 16), mP); cabeca.position.y = 2.35;
    const aura = new THREE.Mesh(new THREE.TorusGeometry(.9, .08, 12, 24), new THREE.MeshBasicMaterial({ color: 0xe879f9 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = .2; aura.visible = false;
    p.add(pernaE, pernaD, torso, bracoE, bracoD, cabeca, aura);
    p.userData = { pernaE, pernaD, bracoE, bracoD, aura, vy: 0, noChao: true };
    p.position.set(-20, 0, -18);
    return p;
}
const player = criarBonecoRoblox(); scene.add(player);
function atualizarAura() {
    const a = player.userData.aura;
    a.visible = renascimentos > 0;
    a.scale.setScalar(1 + Math.min(renascimentos, 8) * 0.12);
    a.material.color.setHSL((0.8 + renascimentos * 0.07) % 1, 0.9, 0.6);
}

let colisoresMundo = [];
function registrarColisor(minX, maxX, minZ, maxZ, condicao = () => true) {
    colisoresMundo.push({ minX, maxX, minZ, maxZ, condicao });
}
function resolverColisoes(pos) {
    const r = 0.55;
    // Limites do mapa
    pos.x = Math.max(-45, Math.min(25, pos.x));
    pos.z = Math.max(-50, Math.min(48, pos.z));

    for (const c of colisoresMundo) {
        if (!c.condicao()) continue;
        if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
            const penEsq = (pos.x + r) - c.minX;
            const penDir = c.maxX - (pos.x - r);
            const penCima = (pos.z + r) - c.minZ;
            const penBaixo = c.maxZ - (pos.z - r);
            const minPen = Math.min(penEsq, penDir, penCima, penBaixo);
            if (minPen === penEsq) pos.x = c.minX - r;
            else if (minPen === penDir) pos.x = c.maxX + r;
            else if (minPen === penCima) pos.z = c.minZ - r;
            else pos.z = c.maxZ + r;
        }
    }
}

// ================= PETS =================
const petGroup = new THREE.Group(); scene.add(petGroup);
function adicionarPet3D(p) {
    const pet = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: p.cor, roughness: 0.3 });
    const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); pet.add(o); return o; };
    const preto = new THREE.MeshBasicMaterial({ color: 0 });
    add(new THREE.BoxGeometry(.75, .75, .75), mat, 0, 0, 0);
    add(new THREE.BoxGeometry(.12, .12, .1), preto, -.18, .1, .38); add(new THREE.BoxGeometry(.12, .12, .1), preto, .18, .1, .38);
    add(new THREE.BoxGeometry(.2, .25, .2), mat, -.22, .45, 0); add(new THREE.BoxGeometry(.2, .25, .2), mat, .22, .45, 0);
    const asas = [];
    if (p.asas) [-1, 1].forEach(s => { const a = add(new THREE.BoxGeometry(.7, .08, .45), new THREE.MeshStandardMaterial({ color: 0xfff7ed, emissive: p.cor, emissiveIntensity: .4 }), s * .6, .15, -.1); a.userData.s = s; asas.push(a); });
    if (p.chifre) add(new THREE.ConeGeometry(.1, .5, 8), new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: .6 }), 0, .62, .2);
    petGroup.add(pet);
    petsComprados.push({ id: p.id, nome: p.nome, mult: p.mult, mesh: pet, asas });
    $('pets-value').textContent = petsComprados.map(x => x.nome.split(' ')[0]).join(' ');
}
function getMultiplicadorTotal() {
    const bonusPets = petsComprados.reduce((a, p) => a + p.mult, 0);
    // Rebirth agora dá +75% por nível em vez de +100%
    return (1 + renascimentos * 0.75) * (1 + bonusPets) * multEvento;
}

// ================= MUNDO =================
const mundoGroup = new THREE.Group(); scene.add(mundoGroup);
let fabricasAtivas = [], padsInterativos = [], animMundo = [];

function criarPlacaBillboard(nome, classe = '') {
    const el = document.createElement('div');
    el.className = `billboard-label ${classe}`;
    el.innerHTML = `<span class="nm"></span><span class="price"></span>`;
    el._nm = el.firstChild; el._pr = el.lastChild;
    labelsContainer.appendChild(el);
    el._nm.textContent = nome;
    return el;
}
const setTxt = (el, prop, v) => { if (el['_c' + prop] !== v) { el['_c' + prop] = v; el[prop].textContent = v; } };

function criarUpgraderArco(index) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: [0x38bdf8, 0xf472b6, 0xfbbf24, 0xa855f7][index % 4] });
    const b = (w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); };
    b(.45, 2.8, .45, 0, 1.4, -1.2); b(.45, 2.8, .45, 0, 1.4, 1.2); b(.9, .55, 2.8, 0, 2.8, 0);
    return g;
}

function criarPad(o) {
    const lvl = nv(o.id);
    if (lvl >= o.max) { o.aplicar && o.aplicar(true, lvl); return null; }
    if (lvl > 0 && o.aplicar) o.aplicar(true, lvl);
    const r = o.raio || 1.2;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r + .1, .25, 24), new THREE.MeshStandardMaterial({ color: o.cor, emissive: o.cor, emissiveIntensity: .5 }));
    mesh.position.set(o.wx, .25, o.wz - o.parent.position.z);
    o.parent.add(mesh);
    const item = { ...o, mesh, label: criarPlacaBillboard(o.nome, o.classe), worldPos: new THREE.Vector3(o.wx, .5, o.wz), cd: 0 };
    padsInterativos.push(item);
    return item;
}

function decorarFabrica(est, tier) {
    const g = est.grupo, cd = est.data.corDetalhe;
    const M = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, emissive: e ? c : 0, emissiveIntensity: e, roughness: .5, metalness: .4 });
    const put = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    const cyl = (a, b, h, c, e) => new THREE.Mesh(new THREE.CylinderGeometry(a, b, h, 12), M(c, e));
    const box = (w, h, d, c, e) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, e));
    const anim = f => est.animaveis.push(f);

    if (tier >= 1) {
        for (const x of [-12, -4, 4, 12]) { put(cyl(.1, .12, 3.2, 0x334155), x, 1.7, 5.5); put(new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 10), M(0xfef08a, 1.2)), x, 3.4, 5.5); }
        put(cyl(.7, .9, 5.5, 0x475569), -16, 2.9, -5.5);
        const puffs = [...Array(5)].map(() => { const p = new THREE.Mesh(new THREE.SphereGeometry(.6, 8, 8), new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true })); g.add(p); return p; });
        anim(t => puffs.forEach((p, i) => { const k = (t * .4 + i / 5) % 1; p.position.set(-16 + Math.sin(i + t) * .4, 6 + k * 4, -5.5); p.scale.setScalar(.5 + k * 1.2); p.material.opacity = .55 * (1 - k); }));
    }
    if (tier >= 2) {
        const cano = cyl(.35, .35, 30, 0x64748b); cano.rotation.z = Math.PI / 2; put(cano, 0, 4.6, -5.9);
        for (const x of [-10, 0, 10]) put(cyl(.25, .25, 1.2, 0x64748b), x, 4, -5.9);
    }
    if (tier >= 3) { // Dropper auxiliar movido para o Tier 3 para manter o desafio
        const d2 = est.data.criarDropper3D(); d2.scale.setScalar(.7); put(d2, -14, .2, -5);
        if (d2.userData.animar) anim(t => d2.userData.animar(t));
        put(box(3, 2.2, .6, 0x1e293b), 8, 1.1, -6.3);
        const tela = put(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), M(cd, 1)), 8, 1.3, -5.98);
        anim(t => tela.material.emissiveIntensity = .7 + .5 * Math.sin(t * 5));
        const sg = new THREE.Group(); const s = new THREE.Mesh(new THREE.ConeGeometry(.3, .6, 8), M(0xef4444, 1.5)); s.rotation.z = Math.PI / 2; s.position.x = .25; sg.add(s); put(sg, 8, 2.5, -6.3);
        anim(t => sg.rotation.y = t * 6);
    }
    if (tier >= 4) {
        [-8, 0, 8].forEach((x, i) => {
            put(cyl(.6, .7, .5, 0x475569), x, .45, .8);
            const piv = new THREE.Group(); piv.position.set(x, .7, .8);
            const br = box(.35, 1.8, .35, cd, .3); br.position.y = .9;
            const av = box(.3, .3, 1.6, 0xfbbf24); av.position.set(0, 1.8, -.7);
            piv.add(br, av); g.add(piv);
            anim(t => piv.rotation.y = Math.sin(t * 2 + i) * .6);
        });
        put(box(28, .04, .12, cd, 1.2), -1, .23, -.8); put(box(28, .04, .12, cd, 1.2), -1, .23, -4.2);
    }
    if (tier >= 5) {
        put(cyl(.7, .9, 2, 0x1e293b), 16, 1, 5);
        const holo = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: cd, wireframe: true })); holo.position.set(16, 3.6, 5); g.add(holo);
        const aneis = [0, 1].map(i => { const a = new THREE.Mesh(new THREE.TorusGeometry(1.5 + i * .4, .04, 8, 32), new THREE.MeshBasicMaterial({ color: cd })); a.position.set(16, 3.6, 5); g.add(a); return a; });
        anim(t => { holo.rotation.y = t * 1.5; holo.rotation.x = t * .8; aneis[0].rotation.set(t, 0, 0); aneis[1].rotation.set(0, t * 1.3, 1); });
    }
    if (tier >= 6) {
        put(cyl(.9, 1.1, .5, 0xfacc15, .6), 14, 2.3, -2.5);
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; put(new THREE.Mesh(new THREE.ConeGeometry(.2, .6, 6), M(0xfacc15, .8)), 14 + Math.cos(a) * .8, 2.85, -2.5 + Math.sin(a) * .8); }
        const orbs = [...Array(Math.min(tier - 5, 6))].map(() => { const o = new THREE.Mesh(new THREE.SphereGeometry(.25, 10, 10), M(0xfde047, 1.4)); g.add(o); return o; });
        anim(t => orbs.forEach((o, i) => { const a = t * 1.6 + i / orbs.length * Math.PI * 2; o.position.set(14 + Math.cos(a) * 2.2, 4.5 + Math.sin(t * 2 + i) * .3, -2.5 + Math.sin(a) * 2.2); }));
    }
}

function spawnearItemNaFabrica(f, fatorSorte = 0, manual = false) {
    const qtd = (!manual && renascimentos >= 3) ? 2 : 1;
    for (let k = 0; k < qtd; k++) {
        const m = f.data.criarItem3D();
        m.position.set(-12.5 - k * 1.1, 2.4, -2.5 + (Math.random() - .5) * .4);
        f.grupo.add(m);
        f.itens.push({ mesh: m, vy: 0, valor: f.data.valorBase * (Math.random() < fatorSorte ? 3 : 1), passouPor: {} });
    }
}

function construirMundo() {
    while (mundoGroup.children.length) mundoGroup.remove(mundoGroup.children[0]);
    labelsContainer.innerHTML = '';
    fabricasAtivas = []; padsInterativos = []; animMundo = []; colisoresMundo = [];

    FABRICAS_DATA.forEach((fData, fi) => {
        const texEsteira = criarTexturaEsteira(fData.corEsteira);
        const est = { data: fData, desbloqueada: fData.desbloqueadaInicialmente, dinheiroAcumulado: 0, dropTimer: 0, itens: [], grupo: new THREE.Group(), dropperMesh: null, upgraders: [], animaveis: [], quebrada: false, tReparo: 0, alerta: null, texEsteira };
        const g = est.grupo; g.position.set(0, 0, fData.zOffset); mundoGroup.add(g);
        const mk = (w, h, d, c, x, y, z, rough, map = null) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: map ? 0xffffff : c, roughness: rough ?? .8, map }));
            m.position.set(x, y, z); m.receiveShadow = true; g.add(m); return m;
        };

        mk(34, .2, 14, fData.corPiso, 0, .1, 0);
        mk(28, .4, 2.2, fData.corEsteira, -1, .4, -2.5, .4, texEsteira);
        mk(28, .7, .2, 0x1e293b, -1, .55, -3.65); mk(28, .7, .2, 0x1e293b, -1, .55, -1.35);

        est.dropperMesh = fData.criarDropper3D(); est.dropperMesh.position.set(-14, .2, -2.5); g.add(est.dropperMesh);
        mk(2.4, 2, 2.8, 0x0f172a, 14, 1, -2.5);

        // Colisões da esteira e do cofre (quando a fábrica está desbloqueada)
        registrarColisor(-15.5, 15.2, fData.zOffset - 3.8, fData.zOffset - 1.2, () => est.desbloqueada);

        est.alerta = new THREE.Mesh(new THREE.ConeGeometry(.6, 1.2, 4), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        est.alerta.rotation.x = Math.PI; est.alerta.position.set(0, 7.5, -2.5); est.alerta.visible = false; g.add(est.alerta);

        const padCol = new THREE.Mesh(new THREE.BoxGeometry(3.2, .3, 3.2), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: .7 }));
        padCol.position.set(14, .25, 2.5); g.add(padCol);
        padsInterativos.push({ tipo: 'coletor', worldPos: new THREE.Vector3(14, .5, fData.zOffset + 2.5), label: criarPlacaBillboard(`💰 Coletor (${fData.nome.split('.')[1]})`, 'collector'), fabrica: est, padMesh: padCol });

        fData.upgraders.forEach((u, idx) => {
            const arco = criarUpgraderArco(idx); arco.position.set(u.x, .2, -2.5); arco.visible = false; g.add(arco);
            est.upgraders.push({ mesh: arco, x: u.x, mult: u.mult, estagio: idx + 1 });
            const prev = `${fData.id}_upg${idx - 1}`;
            criarPad({ id: `${fData.id}_upg${idx}`, parent: g, wx: u.x, wz: fData.zOffset + 3.2, cor: 0x22c55e, nome: u.nome, max: 1, fabrica: est,
                preco: () => precoReal(u.preco), bloqueio: () => idx > 0 && !nv(prev) ? 'Compre o anterior' : null,
                aplicar: () => { arco.visible = true; } });
        });
        criarPad({ id: `${fData.id}_paredes`, parent: g, wx: -13, wz: fData.zOffset + 3.2, cor: 0x3b82f6, nome: '🧱 Paredes da Ala', max: 1, fabrica: est,
            preco: () => precoReal(fData.precoParedes),
            aplicar: () => {
                if (est.paredes) return;
                const pM = new THREE.MeshStandardMaterial({ color: fData.corParede });
                est.paredes = new THREE.Group();
                const a = new THREE.Mesh(new THREE.BoxGeometry(34, 5.5, .5), pM); a.position.set(0, 2.75, -6.8);
                const b = new THREE.Mesh(new THREE.BoxGeometry(.5, 5.5, 14), pM); b.position.set(16.8, 2.75, 0);
                est.paredes.add(a, b); g.add(est.paredes);
                registrarColisor(-17, 17, fData.zOffset - 7.1, fData.zOffset - 6.5, () => est.desbloqueada);
                registrarColisor(16.5, 17.1, fData.zOffset - 7, fData.zOffset + 7, () => est.desbloqueada);
            } });

        decorarFabrica(est, renascimentos);

        if (!fData.desbloqueadaInicialmente) {
            g.visible = false;
            criarPad({ id: `${fData.id}_unlock`, parent: mundoGroup, wx: -18, wz: fData.zOffset, cor: 0xf59e0b, raio: 1.7, nome: `🔓 Construir ${fData.nome}`, classe: 'perk', max: 1,
                preco: () => precoReal(fData.precoDesbloqueio),
                bloqueio: () => !fabricasAtivas[fi - 1]?.desbloqueada ? 'Desbloqueie a anterior' : null,
                aplicar: silent => { est.desbloqueada = true; g.visible = true; if (!silent) mostrarAviso(`🎉 ${fData.nome} desbloqueada!`); } });
        }
        fabricasAtivas.push(est);
    });

    PERKS.forEach((p, i) => criarPad({ id: 'perk_' + p.id, parent: mundoGroup, wx: -28, wz: -26 + i * 6, cor: p.cor, nome: p.nome, classe: 'perk', max: p.max, raio: 1.3,
        preco: l => Math.ceil(precoReal(p.base) * Math.pow(2.2, l)), aplicar: (s) => { if (!s) mostrarAviso(`✨ ${p.nome}: ${p.desc}`); } }));
    PETS.forEach((p, i) => criarPad({ id: 'pet_' + p.id, parent: mundoGroup, wx: -36, wz: -26 + i * 6, cor: p.cor, nome: `${p.nome} (+${p.mult * 100}%)`, classe: 'perk', max: 1, raio: 1.3,
        preco: () => Math.ceil(p.base * DIF),
        aplicar: s => { if (!petsComprados.find(x => x.id === p.id)) adicionarPet3D(p); if (!s) mostrarAviso(`🐾 Você equipou ${p.nome}!`); } }));

    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, .15, 10, 40), new THREE.MeshBasicMaterial({ color: 0xe879f9 }));
    ring.position.set(-20, 2.8, -42); mundoGroup.add(ring); animMundo.push(t => { ring.rotation.z = t * 2; });
    criarPad({ id: 'rebirth', parent: mundoGroup, wx: -20, wz: -42, cor: 0xa855f7, raio: 2.2, nome: '🔄 RENASCER (+75% e fábrica mais detalhada)', classe: 'rebirth', max: Infinity,
        preco: () => precoRenasc(), bloqueio: () => fabricasAtivas.filter(f => f.desbloqueada).length < 2 ? 'Desbloqueie 2 fábricas' : null });
}

// ================= MISSÕES / EVENTOS / SAVE =================
const TIPOS_MISSAO = [
    { k: 'ganho', txt: n => `Ganhe $${fmt(n)} coletando`, base: 2000 },
    { k: 'itens', txt: n => `Produza ${fmt(n)} itens`, base: 60 },
    { k: 'compras', txt: n => `Faça ${n} compras/melhorias`, base: 4 }
];
function missaoAtual() {
    const t = TIPOS_MISSAO[missaoIdx % 3], r = Math.floor(missaoIdx / 3);
    return { t, meta: Math.round(t.base * Math.pow(2.6, r)), rec: Math.round(300 * Math.pow(1.9, missaoIdx) * (1 + renascimentos * .5)) };
}
function coletar(fab, silencioso = false) {
    if (fab.dinheiroAcumulado > 0) {
        const valor = fab.dinheiroAcumulado;
        dinheiro += valor;
        stats.ganho += valor;
        fab.dinheiroAcumulado = 0;
        if (!silencioso) {
            tocarSom('cash');
            spawnTextoFlutuante(new THREE.Vector3(14, 1.8, fab.data.zOffset + 2.5), `+$${fmt(valor)}`);
        }
    }
}
function consertar(fab, auto) {
    fab.quebrada = false; fab.tReparo = 0; fab.alerta.visible = false;
    tocarSom('buy');
    mostrarAviso(auto ? '🛠️ Técnico Robô consertou a máquina!' : '🔧 Máquina consertada!');
}
function dispararEvento() {
    const ativas = fabricasAtivas.filter(f => f.desbloqueada && !f.quebrada);
    if (Math.random() < 0.65 && ativas.length) {
        const f = ativas[Math.floor(Math.random() * ativas.length)];
        f.quebrada = true; f.alerta.visible = true;
        tocarSom('break');
        mostrarAviso(`⚠️ ${f.data.nome.split('.')[1].trim()} QUEBROU! Pise no coletor para consertar.`);
    } else if (multEvento === 1) {
        multEvento = 2; eventoFim = elapsed + 20;
        tocarSom('rebirth');
        mostrarAviso('🌟 HORA DOURADA! Ganhos 2x por 20 segundos!');
    }
}
let resetando = false;
function salvar() {
    if (resetando) return;
    try {
        localStorage.setItem(CHAVE_SAVE, JSON.stringify({
            dinheiro, renascimentos, niveis, stats, missaoIdx, missaoBase,
            lastSave: Date.now()
        }));
    } catch (e) {}
}
function carregar() {
    try {
        const s = JSON.parse(localStorage.getItem(CHAVE_SAVE));
        if (s) {
            ({ dinheiro, renascimentos, niveis, stats, missaoIdx, missaoBase } = { ...{ dinheiro, renascimentos, niveis, stats, missaoIdx, missaoBase }, ...s });
            if (s.lastSave) {
                const segsOffline = Math.min(7200, Math.floor((Date.now() - s.lastSave) / 1000));
                if (segsOffline > 30) {
                    const rendaEstimada = 12 * (1 + renascimentos * 0.75) * Math.max(1, Object.keys(niveis).length);
                    const ganhoOffline = Math.round(rendaEstimada * (segsOffline / 10));
                    dinheiro += ganhoOffline;
                    setTimeout(() => mostrarAviso(`💤 Bem-vindo de volta! Você ganhou +$${fmt(ganhoOffline)} offline!`), 800);
                }
            }
        }
    } catch (e) {}
}
function renascer() {
    renascimentos++;
    Object.keys(niveis).forEach(k => { if (!k.startsWith('pet_')) delete niveis[k]; });
    dinheiro = 150 + 350 * renascimentos;
    player.position.set(-20, 0, -18);
    tocarSom('rebirth');
    atualizarAura(); construirMundo(); salvar();
    mostrarAviso(`🌟 RENASCIMENTO ${renascimentos}! Fábricas: ${NOMES_TIER[Math.min(renascimentos, 6)]} • ${getMultiplicadorTotal().toFixed(2)}x`);
}
$('btn-reset').addEventListener('click', () => {
    if (confirm('Apagar todo o progresso e recomeçar?')) { resetando = true; localStorage.removeItem(CHAVE_SAVE); location.reload(); }
});
addEventListener('beforeunload', salvar);

// ================= CONTROLES =================
const keys = {};
let manualDropCd = 0;
addEventListener('keydown', e => {
    keys[e.code] = true;
    // Tecla E: Drop Manual na fábrica mais próxima
    if (e.code === 'KeyE' && manualDropCd <= 0) {
        const fabProxima = fabricasAtivas.find(f => f.desbloqueada && !f.quebrada && Math.abs(player.position.z - f.data.zOffset) < 8);
        if (fabProxima) {
            manualDropCd = 0.28;
            spawnearItemNaFabrica(fabProxima, 0.06 * nv('perk_sorte'), true);
            tocarSom('drop');
        }
    }
});
addEventListener('keyup', e => keys[e.code] = false);

let camYaw = -Math.PI / 2, camPitch = .48, camDist = 13, isDragging = false;
addEventListener('mousedown', () => isDragging = true);
addEventListener('mouseup', () => isDragging = false);
addEventListener('mousemove', e => { if (isDragging) { camYaw -= e.movementX * .007; camPitch = Math.max(.18, Math.min(1.25, camPitch + e.movementY * .007)); } });
addEventListener('wheel', e => { camDist = Math.max(6, Math.min(26, camDist + e.deltaY * 0.01)); });

// ================= LOOP =================
let autoTimer = 0, saveTimer = 0;
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(.05, clock.getDelta());
    elapsed += dt;
    if (manualDropCd > 0) manualDropCd -= dt;
    const ud = player.userData;

    const moveX = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const moveZ = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    const moving = moveX !== 0 || moveZ !== 0;
    const estMax = 100 + 50 * nv('perk_estamina');
    const correndo = moving && (keys.ShiftLeft || keys.ShiftRight) && !exausto && estamina > 0;
    estamina = Math.min(estMax, Math.max(0, estamina + (correndo ? -28 : 15) * dt));
    if (estamina <= 0) exausto = true; else if (estamina > 25) exausto = false;

    const vel = 9 * (1 + .25 * nv('perk_velocidade')) * (correndo ? 1.5 : 1);
    if (moving) {
        const ang = Math.atan2(moveX, moveZ) + camYaw;
        player.position.x += Math.sin(ang) * vel * dt; player.position.z += Math.cos(ang) * vel * dt;
        resolverColisoes(player.position);
        player.rotation.y = ang;
        const sw = Math.sin(elapsed * (correndo ? 20 : 12)) * .65;
        ud.pernaE.rotation.x = sw; ud.pernaD.rotation.x = -sw; ud.bracoE.rotation.x = -sw; ud.bracoD.rotation.x = sw;
    } else ud.pernaE.rotation.x = ud.pernaD.rotation.x = ud.bracoE.rotation.x = ud.bracoD.rotation.x = 0;

    if (keys.Space && ud.noChao) { ud.vy = 9 + 2.5 * nv('perk_superPulo'); ud.noChao = false; }
    ud.vy -= 22 * dt; player.position.y += ud.vy * dt;
    if (player.position.y <= 0) { player.position.y = 0; ud.vy = 0; ud.noChao = true; }
    ud.aura.rotation.z = elapsed * 2;

    petsComprados.forEach((p, i) => {
        const a = elapsed * 2 + i * (Math.PI * 2 / petsComprados.length);
        p.mesh.position.lerp(tmpV.set(player.position.x + Math.cos(a) * 2.2, player.position.y + 1.4 + Math.sin(elapsed * 5 + i) * .25, player.position.z + Math.sin(a) * 2.2), .1);
        p.mesh.rotation.y = player.rotation.y;
        p.asas.forEach(w => w.rotation.z = w.userData.s * Math.sin(elapsed * 10) * .5);
    });

    camera.position.set(
        player.position.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist,
        Math.max(1.2, player.position.y + 2.5 + Math.sin(camPitch) * camDist),
        player.position.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist
    );
    camera.lookAt(player.position.x, player.position.y + 1.8, player.position.z);

    proxEvento -= dt;
    if (multEvento > 1 && elapsed > eventoFim) multEvento = 1;
    if (proxEvento <= 0) { proxEvento = (35 + Math.random() * 35) / (1 + .1 * renascimentos); dispararEvento(); }

    if (nv('perk_autoColetor')) { autoTimer += dt; if (autoTimer >= 2) { autoTimer = 0; fabricasAtivas.forEach(f => coletar(f, true)); } }

    const raioColetor = 2.2 + 2.5 * nv('perk_ima');
    for (let i = padsInterativos.length - 1; i >= 0; i--) {
        const it = padsInterativos[i];
        if (it.fabrica && !it.fabrica.desbloqueada) { it.label.style.display = 'none'; continue; }
        const proj = tmpV.copy(it.worldPos).add({ x: 0, y: 1.3, z: 0 }).project(camera);
        if (proj.z < 1) { it.label.style.display = 'block'; it.label.style.left = `${(proj.x * .5 + .5) * innerWidth}px`; it.label.style.top = `${(-proj.y * .5 + .5) * innerHeight}px`; }
        else it.label.style.display = 'none';
        const dist = Math.hypot(player.position.x - it.worldPos.x, player.position.z - it.worldPos.z);

        if (it.tipo === 'coletor') {
            const f = it.fabrica;
            setTxt(it.label, '_pr', f.quebrada ? '🔧 QUEBRADA! Pise p/ consertar' : `$${fmt(f.dinheiroAcumulado)}`);
            if (dist < 2.2 && f.quebrada) consertar(f, false);
            if (dist < raioColetor) coletar(f, false);
            continue;
        }
        const lvl = nv(it.id), preco = it.preco(lvl), trava = it.bloqueio && it.bloqueio();
        setTxt(it.label, '_nm', it.max > 1 && it.max < 99 ? `${it.nome} (${lvl}/${it.max})` : it.nome);
        setTxt(it.label, '_pr', trava ? `🔒 ${trava}` : it.id === 'rebirth' ? `$${fmt(preco)} • Rebirth ${renascimentos + 1}` : `$${fmt(preco)}`);
        it.cd -= dt;
        if (!trava && dist < 1.6 && it.cd <= 0 && dinheiro >= preco) {
            dinheiro -= preco; stats.compras++;
            if (it.id === 'rebirth') { renascer(); break; }
            tocarSom('buy');
            niveis[it.id] = lvl + 1; it.cd = .8;
            it.aplicar && it.aplicar(false, lvl + 1);
            if (lvl + 1 >= it.max) { it.mesh.parent.remove(it.mesh); it.label.remove(); padsInterativos.splice(i, 1); }
        }
    }

    const fator = 1 + .25 * nv('perk_overclock'), mult = getMultiplicadorTotal(), sorte = .06 * nv('perk_sorte');
    let algumaQuebrada = false;

    fabricasAtivas.forEach(f => {
        if (!f.desbloqueada) return;
        f.animaveis.forEach(a => a(elapsed));
        if (f.quebrada) {
            algumaQuebrada = true;
            f.alerta.position.y = 7.5 + Math.sin(elapsed * 8) * .4; f.alerta.rotation.y = elapsed * 4;
            if (nv('perk_tecnico')) { f.tReparo += dt; if (f.tReparo >= 5) consertar(f, true); }
            return;
        }
        // Anima textura da esteira
        f.texEsteira.offset.x -= 0.13 * fator * dt * 14;

        if (f.dropperMesh.userData.animar) f.dropperMesh.userData.animar(elapsed * fator);
        f.dropTimer += dt * fator;
        if (f.dropTimer >= f.data.intervaloDrop) {
            f.dropTimer = 0;
            spawnearItemNaFabrica(f, sorte, false);
        }
        for (let i = f.itens.length - 1; i >= 0; i--) {
            const it = f.itens[i];
            it.mesh.position.x += 3.6 * fator * dt;
            it.vy -= 18 * dt; it.mesh.position.y += it.vy * dt;
            if (it.mesh.position.y <= .95) { it.mesh.position.y = .95; it.vy = Math.abs(it.vy) > 1.5 ? -it.vy * f.data.quique : 0; }
            f.upgraders.forEach(u => {
                if (u.mesh.visible && !it.passouPor[u.estagio] && Math.abs(it.mesh.position.x - u.x) < .4) {
                    it.passouPor[u.estagio] = true; it.valor = Math.round(it.valor * u.mult); f.data.evoluirItem3D(it.mesh, u.estagio);
                }
            });
            if (it.mesh.position.x >= 13) {
                f.dinheiroAcumulado += Math.round(it.valor * mult); stats.itens++;
                if (it.mesh.userData.ownMaterial) it.mesh.material.dispose();
                f.grupo.remove(it.mesh);
                f.itens.splice(i, 1);
            }
        }
    });
    animMundo.forEach(a => a(elapsed));

    const m = missaoAtual(), prog = stats[m.t.k] - missaoBase[m.t.k];
    if (prog >= m.meta) {
        dinheiro += m.rec; missaoIdx++; missaoBase = { ...stats };
        tocarSom('rebirth');
        mostrarAviso(`🏆 Missão cumprida! +$${fmt(m.rec)}`);
    }

    saveTimer += dt; if (saveTimer > 5) { saveTimer = 0; salvar(); }

    $('cash-value').textContent = `$${fmt(dinheiro)}`;
    $('rebirth-value').textContent = renascimentos;
    $('mult-value').textContent = `${mult.toFixed(2)}x`;
    $('tier-value').textContent = `${renascimentos} • ${NOMES_TIER[Math.min(renascimentos, 6)]}`;
    $('event-card').hidden = multEvento === 1;
    if (multEvento > 1) $('event-card').textContent = `🌟 HORA DOURADA 2x — ${Math.ceil(eventoFim - elapsed)}s`;
    $('repair-alert').hidden = !algumaQuebrada;
    $('stamina-fill').style.width = `${estamina / estMax * 100}%`;
    $('stamina-fill').classList.toggle('tired', exausto);
    $('mission-text').textContent = `${m.t.txt(m.meta)} (${fmt(Math.min(prog, m.meta))}/${fmt(m.meta)}) → +$${fmt(m.rec)}`;
    $('mission-fill').style.width = `${Math.min(100, prog / m.meta * 100)}%`;

    renderer.render(scene, camera);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

carregar(); atualizarAura(); construirMundo(); animate();