import * as THREE from 'three';
import { FABRICAS_DATA } from './temas/fabricasConfig.js';
import { sfx } from './sound.js';

// ================= CONFIGURAÇÃO / ESTADO =================
const DIF = 1.6;
const CHAVE_SAVE = 'megaTycoon3D_v4';
const PRECO_RENASC_BASE = 80000;
const NOMES_TIER = ['Oficina Básica', 'Iluminada', 'Tubulada', 'Automatizada', 'Robotizada', 'Holográfica', 'Lendária'];

let modoAtual = 'tycoon';
let dinheiro = 100, renascimentos = 0, vitoriasParkour = 0, melhorTempoPk = null;
let niveis = {};
let petsComprados = [];
let stats = { ganho: 0, itens: 0, compras: 0 };
let missaoIdx = 0, missaoBase = { ganho: 0, itens: 0, compras: 0 };
let multEvento = 1, eventoFim = 0, proxEvento = 45, elapsed = 0;
let estamina = 100, exausto = false;

const nv = id => niveis[id] || 0;
const precoRenasc = () => Math.round(PRECO_RENASC_BASE * Math.pow(2.8, renascimentos));
const precoReal = b => Math.ceil(b * DIF * (1 + 0.35 * renascimentos));
const fmt = n => { const s = ['', 'K', 'M', 'B', 'T', 'Qa']; let i = 0; while (n >= 1000 && i < 5) { n /= 1000; i++; } return (i ? n.toFixed(2) : Math.floor(n)) + s[i]; };

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

// ================= DOM =================
const $ = id => document.getElementById(id);
const canvas = $('gameCanvas'), labelsContainer = $('labels-container'), toastMsg = $('toast-msg');
let toastTimer;
function mostrarAviso(t) {
    toastMsg.textContent = t; toastMsg.style.opacity = '1';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastMsg.style.opacity = '0', 2800);
}

// ================= CENA =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 190);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 280);
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

const tycoonSceneGroup = new THREE.Group();
const parkourSceneGroup = new THREE.Group();
scene.add(tycoonSceneGroup);
scene.add(parkourSceneGroup);

const baseplate = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.9 }));
baseplate.rotation.x = -Math.PI / 2; baseplate.receiveShadow = true; tycoonSceneGroup.add(baseplate);
const caminho = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 92), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
caminho.position.set(-20, 0.06, -3); caminho.receiveShadow = true; tycoonSceneGroup.add(caminho);

// ================= PERFIL E SKINS =================
const SKINS = [
    { id:'classic', nome:'Clássico', desc:'O visual original', pele:0xfacc15, camisa:0x2563eb, calca:0x16a34a },
    { id:'fire', nome:'Vulcânico', desc:'Energia intensa', pele:0xf4b183, camisa:0xdc2626, calca:0x451a03 },
    { id:'ice', nome:'Glacial', desc:'Frio e elegante', pele:0xf1d5c5, camisa:0x38bdf8, calca:0x1e3a8a },
    { id:'shadow', nome:'Sombrio', desc:'Nas sombras', pele:0xb6a6a0, camisa:0x334155, calca:0x111827 },
    { id:'neon', nome:'Neon', desc:'Brilhe na fábrica', pele:0xffd7a8, camisa:0xa855f7, calca:0x0f766e },
    { id:'gold', nome:'Dourado', desc:'Visual lendário', pele:0xf5c28b, camisa:0xf59e0b, calca:0x78350f }
];
let perfil = { nome:'Jogador', skin:'classic' };
let jogoIniciado = false;
function skinAtual(){ return SKINS.find(x => x.id === perfil.skin) || SKINS[0]; }

function criarNomeAcima() {
    const canvasNome = document.createElement('canvas');
    canvasNome.width = 512; canvasNome.height = 128;
    const ctx = canvasNome.getContext('2d');
    const textura = new THREE.CanvasTexture(canvasNome);
    textura.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: textura, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(5.2, 1.3, 1);
    sprite.position.set(0, 3.55, 0);
    sprite.renderOrder = 20;
    sprite.userData.atualizar = (nome, nivel, titulo) => {
        ctx.clearRect(0, 0, 512, 128);
        ctx.fillStyle = 'rgba(9, 16, 30, 0.82)';
        ctx.beginPath();
        ctx.roundRect(8, 8, 496, 112, 26);
        ctx.fill();
        ctx.strokeStyle = 'rgba(147,197,253,.9)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.font = 'bold 38px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText((nome || 'Jogador').slice(0, 16), 256, 57, 450);
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#93c5fd';
        ctx.fillText(`NÍVEL ${String(nivel).padStart(2,'0')}  •  ${titulo}`, 256, 91, 460);
        textura.needsUpdate = true;
    };
    sprite.userData.atualizar(perfil.nome, 1, 'CONSTRUTOR');
    return sprite;
}
function tituloJogador() {
    if (renascimentos >= 10) return 'LENDÁRIO';
    if (renascimentos >= 5) return 'INDUSTRIAL ELITE';
    if (renascimentos >= 2) return 'MESTRE DA FÁBRICA';
    return 'CONSTRUTOR';
}
function atualizarNomeAcima() {
    if (player && player.userData.nomeSprite) {
        player.userData.nomeSprite.userData.atualizar(perfil.nome, 1 + renascimentos, tituloJogador());
    }
}

// ================= JOGADOR =================
function criarBonecoRoblox() {
    const p = new THREE.Group();
    const sk = skinAtual();
    const mP = new THREE.MeshStandardMaterial({ color: sk.pele }), mT = new THREE.MeshStandardMaterial({ color: sk.camisa }), mC = new THREE.MeshStandardMaterial({ color: sk.calca });
    const bx = (w, h, d, m, x, y) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, 0); return o; };
    const pernaE = bx(.45, 1, .45, mC, -.25, .5), pernaD = bx(.45, 1, .45, mC, .25, .5), torso = bx(1, 1, .5, mT, 0, 1.5);
    const bracoE = bx(.4, 1, .45, mP, -.75, 1.5), bracoD = bx(.4, 1, .45, mP, .75, 1.5);
    const cabeca = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .6, 16), mP); cabeca.position.y = 2.35;
    const aura = new THREE.Mesh(new THREE.TorusGeometry(.9, .08, 12, 24), new THREE.MeshBasicMaterial({ color: 0xe879f9 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = .2; aura.visible = false;
    p.add(pernaE, pernaD, torso, bracoE, bracoD, cabeca, aura);
    const nomeSprite = criarNomeAcima();
    p.add(nomeSprite);
    p.userData = { pernaE, pernaD, torso, bracoE, bracoD, cabeca, aura, nomeSprite, mats: { pele:mP, camisa:mT, calca:mC }, vy: 0, noChao: true };
    p.position.set(-20, 0, -18);
    return p;
}
const player = criarBonecoRoblox(); scene.add(player);
function aplicarSkin(){
    const sk = skinAtual(), mats = player.userData.mats;
    mats.pele.color.setHex(sk.pele); mats.camisa.color.setHex(sk.camisa); mats.calca.color.setHex(sk.calca);
    const aura = player.userData.aura; aura.material.color.setHex(sk.camisa);
}
function atualizarAura() {
    const a = player.userData.aura;
    a.visible = renascimentos > 0;
    a.scale.setScalar(1 + Math.min(renascimentos, 8) * 0.12);
    a.material.color.setHSL((0.8 + renascimentos * 0.07) % 1, 0.9, 0.6);
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
    return (1 + renascimentos) * (1 + bonusPets) * multEvento;
}

// ================= MUNDO TYCOON =================
const mundoGroup = new THREE.Group(); tycoonSceneGroup.add(mundoGroup);
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
        const d2 = est.data.criarDropper3D(); d2.scale.setScalar(.7); put(d2, -14, .2, -5);
        if (d2.userData.animar) anim(t => d2.userData.animar(t));
    }
    if (tier >= 3) {
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

function construirMundo() {
    while (mundoGroup.children.length) mundoGroup.remove(mundoGroup.children[0]);
    labelsContainer.innerHTML = '';
    fabricasAtivas = []; padsInterativos = []; animMundo = [];

    FABRICAS_DATA.forEach((fData, fi) => {
        const est = { data: fData, desbloqueada: fData.desbloqueadaInicialmente, dinheiroAcumulado: 0, dropTimer: 0, itens: [], grupo: new THREE.Group(), dropperMesh: null, upgraders: [], animaveis: [], quebrada: false, tReparo: 0, alerta: null };
        const g = est.grupo; g.position.set(0, 0, fData.zOffset); mundoGroup.add(g);
        const mk = (w, h, d, c, x, y, z, rough) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: rough ?? .8 })); m.position.set(x, y, z); m.receiveShadow = true; g.add(m); return m; };

        mk(34, .2, 14, fData.corPiso, 0, .1, 0);
        mk(28, .4, 2.2, fData.corEsteira, -1, .4, -2.5, .4);
        mk(28, .7, .2, 0x1e293b, -1, .55, -3.65); mk(28, .7, .2, 0x1e293b, -1, .55, -1.35);

        est.dropperMesh = fData.criarDropper3D(); est.dropperMesh.position.set(-14, .2, -2.5); g.add(est.dropperMesh);
        mk(2.4, 2, 2.8, 0x0f172a, 14, 1, -2.5);

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
            } });

        decorarFabrica(est, renascimentos);

        if (!fData.desbloqueadaInicialmente) {
            g.visible = false;
            criarPad({ id: `${fData.id}_unlock`, parent: mundoGroup, wx: -18, wz: fData.zOffset, cor: 0xf59e0b, raio: 1.7, nome: `🔓 Construir ${fData.nome}`, classe: 'perk', max: 1,
                preco: () => precoReal(fData.precoDesbloqueio),
                bloqueio: () => !fabricasAtivas[fi - 1]?.desbloqueada ? 'Desbloqueie a anterior' : null,
                aplicar: silent => { est.desbloqueada = true; g.visible = true; if (!silent) { sfx.playBuy(); mostrarAviso(`🎉 ${fData.nome} desbloqueada!`); } } });
        }
        fabricasAtivas.push(est);
    });

    PERKS.forEach((p, i) => criarPad({ id: 'perk_' + p.id, parent: mundoGroup, wx: -28, wz: -26 + i * 6, cor: p.cor, nome: p.nome, classe: 'perk', max: p.max, raio: 1.3,
        preco: l => Math.ceil(precoReal(p.base) * Math.pow(2.2, l)), aplicar: (s) => { if (!s) { sfx.playBuy(); mostrarAviso(`✨ ${p.nome}: ${p.desc}`); } } }));
    PETS.forEach((p, i) => criarPad({ id: 'pet_' + p.id, parent: mundoGroup, wx: -36, wz: -26 + i * 6, cor: p.cor, nome: `${p.nome} (+${p.mult * 100}%)`, classe: 'perk', max: 1, raio: 1.3,
        preco: () => Math.ceil(p.base * DIF),
        aplicar: s => { if (!petsComprados.find(x => x.id === p.id)) adicionarPet3D(p); if (!s) { sfx.playBuy(); mostrarAviso(`🐾 Você equipou ${p.nome}!`); } } }));

    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, .15, 10, 40), new THREE.MeshBasicMaterial({ color: 0xe879f9 }));
    ring.position.set(-20, 2.8, -42); mundoGroup.add(ring); animMundo.push(t => { ring.rotation.z = t * 2; });
    criarPad({ id: 'rebirth', parent: mundoGroup, wx: -20, wz: -42, cor: 0xa855f7, raio: 2.2, nome: '🔄 RENASCER (+100% e fábrica mais detalhada)', classe: 'rebirth', max: Infinity,
        preco: () => precoRenasc(), bloqueio: () => fabricasAtivas.filter(f => f.desbloqueada).length < 2 ? 'Desbloqueie 2 fábricas' : null });
}

// ================= MEGA PARKOUR OBBY (24 FASES + 5 BIOMAS) =================
const parkour = {
    checkpoint: 0,
    recompensaBase: 1200,
    tempoCorrida: 0,
    plataformas: [],
    lasers: [],
    moedas: [],
    spinners: [],
    animaveis: []
};

// 24 Etapas temáticas com mecânicas variadas
const parkourPercurso = [
    // ZONA 1: INÍCIO CELESTIAL (0..4)
    { x: 0,    z: 0,    y: 0.0,  w: 7.5, d: 7.5, tipo: 'start', zona: 'ZONA 1: INÍCIO CELESTIAL' },
    { x: 0,    z: 9,    y: 1.0,  w: 4.2, d: 3.8, moeda: 150 },
    { x: 4.5,  z: 17,   y: 2.0,  w: 3.8, d: 3.5 },
    { x: -3.5, z: 25,   y: 3.0,  w: 3.8, d: 3.5, moeda: 200 },
    { x: 0,    z: 34,   y: 4.0,  w: 5.5, d: 5.0, checkpoint: 1, zona: 'ZONA 2: PONTE DE LAVA & LASERS' },

    // ZONA 2: PONTE DE LAVA & LASERS (5..9)
    { x: 0,    z: 44,   y: 4.0,  w: 4.5, d: 8.5, laser: { eixo: 'z', amp: 3.6, spd: 2.4 } },
    { x: 5.5,  z: 54,   y: 4.8,  w: 3.5, d: 3.5, moeda: 300 },
    { x: -4.5, z: 62,   y: 5.5,  w: 3.5, d: 3.5, movX: 4.2, spd: 2.0 },
    { x: 0,    z: 71,   y: 6.0,  w: 4.5, d: 9.0, laser: { eixo: 'x', amp: 2.0, spd: 3.2 }, moeda: 350 },
    { x: 0,    z: 81,   y: 6.5,  w: 5.5, d: 5.0, checkpoint: 2, zona: 'ZONA 3: PISOS QUE DESAPARECEM' },

    // ZONA 3: PISOS QUE DESAPARECEM (10..14)
    { x: -3.5, z: 90,   y: 7.2,  w: 3.4, d: 3.4, vanish: true },
    { x: 3.5,  z: 97,   y: 7.9,  w: 3.4, d: 3.4, vanish: true, moeda: 400 },
    { x: -3.5, z: 104,  y: 8.6,  w: 3.4, d: 3.4, vanish: true },
    { x: 2.5,  z: 111,  y: 9.3,  w: 3.4, d: 3.4, vanish: true, moeda: 450 },
    { x: 0,    z: 120,  y: 10.0, w: 5.5, d: 5.0, checkpoint: 3, zona: 'ZONA 4: TRAMPOLINS & HÉLICES' },

    // ZONA 4: TRAMPOLINS & HÉLICES GIRATÓRIAS (15..19)
    { x: 0,    z: 129,  y: 10.2, w: 4.2, d: 4.2, bounce: 18.5 },
    { x: 0,    z: 141,  y: 15.5, w: 6.5, d: 6.5, spinner: { len: 6.0, spd: 2.1 }, moeda: 600 },
    { x: -6.0, z: 151,  y: 16.5, w: 3.4, d: 3.4, movX: 4.5, spd: 2.3 },
    { x: 5.0,  z: 160,  y: 16.8, w: 4.0, d: 4.0, bounce: 19.5, moeda: 750 },
    { x: 0,    z: 173,  y: 22.5, w: 6.0, d: 5.5, checkpoint: 4, zona: 'ZONA 5: ESCALADA CELESTIAL FINAL' },

    // ZONA 5: ESCALADA CELESTIAL FINAL (20..23)
    { x: -4.5, z: 183,  y: 23.6, w: 3.2, d: 3.2, vanish: true },
    { x: 4.5,  z: 191,  y: 24.8, w: 3.2, d: 3.2, movX: 4.8, spd: 2.5, moeda: 900 },
    { x: 0,    z: 200,  y: 26.0, w: 4.5, d: 8.5, laser: { eixo: 'z', amp: 3.8, spd: 3.0 } },
    { x: 0,    z: 213,  y: 27.2, w: 9.0, d: 8.5, tipo: 'finish', zona: 'SANTUÁRIO DOURADO' }
];

function criarArenaParkour() {
    const mat = (cor, emissive = 0, opacity = 1) => new THREE.MeshStandardMaterial({
        color: cor,
        emissive: cor,
        emissiveIntensity: emissive,
        metalness: 0.25,
        roughness: 0.35,
        transparent: opacity < 1,
        opacity
    });

    const lavaMar = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshBasicMaterial({ color: 0x090d16 })
    );
    lavaMar.rotation.x = -Math.PI / 2;
    lavaMar.position.set(0, -14, 100);
    parkourSceneGroup.add(lavaMar);

    const grid = new THREE.GridHelper(320, 40, 0x1d4ed8, 0x0f172a);
    grid.position.set(0, -13.8, 100);
    parkourSceneGroup.add(grid);

    for (let i = 0; i < 26; i++) {
        const lado = i % 2 === 0 ? -1 : 1;
        const zPos = i * 9;
        const alt = 16 + (i % 5) * 6;
        const pilar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.8, 1.8, alt, 8),
            mat(i > 18 ? 0x312e81 : 0x1e293b, 0.08)
        );
        pilar.position.set(lado * (17 + (i % 3) * 4), alt / 2 - 12, zPos);
        parkourSceneGroup.add(pilar);

        const topoCristal = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.1),
            mat(i % 3 === 0 ? 0x38bdf8 : i % 3 === 1 ? 0xa855f7 : 0xfacc15, 0.7)
        );
        topoCristal.position.set(pilar.position.x, pilar.position.y + alt / 2 + 1.8, zPos);
        parkourSceneGroup.add(topoCristal);
        parkour.animaveis.push(t => {
            topoCristal.rotation.y = t * 1.5 + i;
            topoCristal.position.y += Math.sin(t * 2 + i) * 0.005;
        });
    }

    parkour.plataformas = parkourPercurso.map((d, i) => {
        let cor = 0x64748b;
        let em = 0.15;
        if (d.tipo === 'finish') { cor = 0xfacc15; em = 0.45; }
        else if (d.checkpoint) { cor = 0x22c55e; em = 0.4; }
        else if (d.tipo === 'start') { cor = 0x38bdf8; em = 0.35; }
        else if (d.bounce) { cor = 0x06b6d4; em = 0.55; }
        else if (d.vanish) { cor = 0xa855f7; em = 0.35; }
        else if (d.laser) { cor = 0x991b1b; em = 0.25; }
        else if (d.movX) { cor = 0xf472b6; em = 0.25; }

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(d.w, 0.65, d.d),
            mat(cor, em, d.vanish ? 0.92 : 1)
        );
        mesh.position.set(d.x, d.y - 0.325, d.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parkourSceneGroup.add(mesh);

        const borda = new THREE.Mesh(
            new THREE.BoxGeometry(d.w + 0.26, 0.16, d.d + 0.26),
            mat(d.tipo === 'finish' ? 0xfde047 : d.checkpoint ? 0x4ade80 : d.bounce ? 0x67e8f9 : 0x0f172a, 0.45)
        );
        borda.position.set(0, -0.34, 0);
        mesh.add(borda);

        if (d.checkpoint) {
            const arco = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.12, 10, 32), mat(0x4ade80, 0.95));
            arco.position.set(0, 2.3, 0);
            mesh.add(arco);
        }

        if (d.bounce) {
            const mola = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.25, 20), mat(0x22d3ee, 1.1));
            mola.position.set(0, 0.4, 0);
            mesh.add(mola);
            parkour.animaveis.push(t => {
                mola.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
            });
        }

        if (d.laser) {
            const feixe = new THREE.Mesh(
                d.laser.eixo === 'z'
                    ? new THREE.CylinderGeometry(0.16, 0.16, d.w + 0.4, 12)
                    : new THREE.CylinderGeometry(0.16, 0.16, d.d + 0.4, 12),
                mat(0xef4444, 1.5)
            );
            if (d.laser.eixo === 'z') feixe.rotation.z = Math.PI / 2;
            else feixe.rotation.x = Math.PI / 2;
            feixe.position.set(0, 0.65, 0);
            mesh.add(feixe);
            parkour.lasers.push({ mesh: feixe, plat: d, eixo: d.laser.eixo, amp: d.laser.amp, spd: d.laser.spd, offset: i });
        }

        if (d.spinner) {
            const haste = new THREE.Mesh(new THREE.BoxGeometry(d.spinner.len, 0.45, 0.45), mat(0xf97316, 0.9));
            haste.position.set(0, 0.75, 0);
            mesh.add(haste);
            parkour.spinners.push({ mesh: haste, plat: d, len: d.spinner.len, spd: d.spinner.spd, ang: 0 });
        }

        if (d.moeda) {
            const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.18, 20), mat(0xfacc15, 1.0));
            coin.rotation.x = Math.PI / 2;
            coin.position.set(d.x, d.y + 1.5, d.z);
            parkourSceneGroup.add(coin);
            parkour.moedas.push({ mesh: coin, valor: d.moeda, coletada: false, baseX: d.x, baseY: d.y + 1.5, baseZ: d.z, platIdx: i });
        }

        if (d.tipo === 'finish') {
            const coroa = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), mat(0xfde047, 1.2));
            coroa.position.set(0, 3.2, 0);
            mesh.add(coroa);
            const anel1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 10, 32), mat(0xfacc15, 1.0));
            anel1.position.set(0, 3.2, 0);
            mesh.add(anel1);
            const anel2 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.08, 10, 32), mat(0x38bdf8, 1.0));
            anel2.position.set(0, 3.2, 0);
            mesh.add(anel2);
            parkour.animaveis.push(t => {
                coroa.rotation.y = t * 2.2;
                coroa.position.y = 3.2 + Math.sin(t * 3) * 0.3;
                anel1.rotation.set(t * 1.3, t * 0.9, 0);
                anel2.rotation.set(-t * 0.8, t * 1.5, 0.5);
            });
        }

        return {
            ...d,
            baseX: d.x,
            curX: d.x,
            mesh,
            top: d.y,
            vanishState: 'solid',
            vanishTimer: 0
        };
    });
}
criarArenaParkour();

function calcularPremioParkour() {
    return Math.round((parkour.recompensaBase + vitoriasParkour * 400) * (1 + renascimentos * 0.4));
}

function zonaAtualParkour() {
    let z = 'ZONA 1: INÍCIO CELESTIAL';
    for (let i = 0; i <= parkour.checkpoint; i++) {
        if (parkour.plataformas[i]?.zona) z = parkour.plataformas[i].zona;
    }
    return z;
}

function atualizarPainelParkour() {
    const premio = calcularPremioParkour();
    const recTxt = melhorTempoPk ? `${melhorTempoPk.toFixed(1)}s` : '--';
    $('parkour-zone-badge').textContent = `🏁 ${zonaAtualParkour()}`;
    $('parkour-reward-badge').textContent = `Prêmio Final: $${fmt(premio)}`;
    $('parkour-text').textContent = `Etapa ${parkour.checkpoint + 1}/${parkour.plataformas.length} • Recorde Pessoal: ${recTxt}`;
    $('pk-progress-fill').style.width = `${((parkour.checkpoint + 1) / parkour.plataformas.length) * 100}%`;
    $('pk-wins-value').textContent = vitoriasParkour;
}

function restaurarPlataformasTemporarias() {
    parkour.plataformas.forEach(p => {
        if (p.vanish) {
            p.vanishState = 'solid';
            p.vanishTimer = 0;
            p.mesh.visible = true;
            p.mesh.material.opacity = 0.92;
            p.mesh.position.y = p.top - 0.325;
        }
    });
}

function posicionarNoCheckpoint(idx, tocarSom = false) {
    parkour.checkpoint = idx;
    if (idx === 0) {
        parkour.tempoCorrida = 0;
        parkour.moedas.forEach(m => { m.coletada = false; m.mesh.visible = true; });
    }
    restaurarPlataformasTemporarias();
    const p = parkour.plataformas[idx];
    player.position.set(p.curX, p.top, p.z);
    player.userData.vy = 0;
    player.userData.noChao = true;
    camYaw = Math.PI;
    atualizarPainelParkour();
    if (tocarSom) sfx.playFall();
}

function concluirParkour() {
    const premio = calcularPremioParkour();
    dinheiro += premio;
    stats.ganho += premio;
    vitoriasParkour++;
    const tempoFinal = parkour.tempoCorrida;
    const novoRecorde = !melhorTempoPk || tempoFinal < melhorTempoPk;
    if (novoRecorde) melhorTempoPk = tempoFinal;

    sfx.playVictory();
    mostrarAviso(`🏆 PARKOUR COMPLETO em ${tempoFinal.toFixed(1)}s! +$${fmt(premio)}${novoRecorde ? ' (NOVO RECORDE!)' : ''}`);
    posicionarNoCheckpoint(0, false);
    salvar();
}

// ================= TROCA ENTRE PÁGINAS (FÁBRICA VS PARKOUR) =================
function definirModo(novoModo, silencioso = false) {
    modoAtual = novoModo;
    const emParkour = modoAtual === 'parkour';

    tycoonSceneGroup.visible = !emParkour;
    parkourSceneGroup.visible = emParkour;
    labelsContainer.style.display = emParkour ? 'none' : 'block';

    if (emParkour) {
        scene.background.setHex(0x091326);
        scene.fog.color.setHex(0x091326);
        posicionarNoCheckpoint(0, false);
    } else {
        scene.background.setHex(0x87ceeb);
        scene.fog.color.setHex(0x87ceeb);
        player.position.set(-20, 0, -18);
        player.userData.vy = 0;
        player.userData.noChao = true;
        camYaw = -Math.PI / 2;
    }

    $('card-tier').hidden = emParkour;
    $('card-pets').hidden = emParkour;
    $('card-pk-wins').hidden = !emParkour;
    $('parkour-card').hidden = !emParkour;
    $('mission-card').hidden = emParkour;
    if (emParkour) $('event-card').hidden = true;

    const btnSwitch = $('btn-switch-mode');
    btnSwitch.textContent = emParkour ? '🏭 Ir para Fábrica' : '🏁 Ir para Parkour';
    btnSwitch.classList.toggle('in-parkour', emParkour);

    $('controls-text').innerHTML = emParkour
        ? '<b>WASD / Setas:</b> Andar | <b>Shift:</b> Correr | <b>Espaço:</b> Pular | <b>R:</b> Checkpoint'
        : '<b>WASD / Setas:</b> Andar | <b>Shift:</b> Correr | <b>Espaço:</b> Pular | <b>Pise no Coletor Verde para pegar o dinheiro!</b>';

    if (!silencioso) {
        sfx.playSwitchMode();
        mostrarAviso(emParkour ? '🏁 Mega Parkour Obby (24 Fases) carregado!' : '🏭 Fábrica Tycoon carregada!');
    }
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
        dinheiro += fab.dinheiroAcumulado;
        stats.ganho += fab.dinheiroAcumulado;
        fab.dinheiroAcumulado = 0;
        if (!silencioso) sfx.playCoin();
    }
}
function consertar(fab, auto) {
    fab.quebrada = false; fab.tReparo = 0; fab.alerta.visible = false;
    sfx.playRepair();
    mostrarAviso(auto ? '🛠️ Técnico Robô consertou a máquina!' : '🔧 Máquina consertada!');
}
function dispararEvento() {
    if (modoAtual !== 'tycoon') return;
    const ativas = fabricasAtivas.filter(f => f.desbloqueada && !f.quebrada);
    if (Math.random() < 0.65 && ativas.length) {
        const f = ativas[Math.floor(Math.random() * ativas.length)];
        f.quebrada = true; f.alerta.visible = true;
        sfx.playBreak();
        mostrarAviso(`⚠️ ${f.data.nome.split('.')[1].trim()} QUEBROU! Pise no coletor para consertar.`);
    } else if (multEvento === 1) {
        multEvento = 2; eventoFim = elapsed + 20;
        sfx.playGoldenHour();
        mostrarAviso('🌟 HORA DOURADA! Ganhos 2x por 20 segundos!');
    }
}
let resetando = false;
function salvar() {
    if (resetando) return;
    try { localStorage.setItem(CHAVE_SAVE, JSON.stringify({ dinheiro, renascimentos, vitoriasParkour, melhorTempoPk, niveis, stats, missaoIdx, missaoBase })); } catch (e) {}
}
function carregar() {
    try {
        const s = JSON.parse(localStorage.getItem(CHAVE_SAVE));
        if (s) ({ dinheiro, renascimentos, vitoriasParkour, melhorTempoPk, niveis, stats, missaoIdx, missaoBase } = { ...{ dinheiro, renascimentos, vitoriasParkour, melhorTempoPk, niveis, stats, missaoIdx, missaoBase }, ...s });
    } catch (e) {}
}
function renascer() {
    renascimentos++;
    Object.keys(niveis).forEach(k => { if (!k.startsWith('pet_')) delete niveis[k]; });
    dinheiro = 150 + 500 * renascimentos;
    player.position.set(-20, 0, -18);
    sfx.playRebirth();
    atualizarAura(); atualizarNomeAcima(); construirMundo(); salvar();
    mostrarAviso(`🌟 RENASCIMENTO ${renascimentos}! Fábricas agora: ${NOMES_TIER[Math.min(renascimentos, 6)]} • ${getMultiplicadorTotal().toFixed(1)}x`);
}

$('btn-reset').addEventListener('click', () => {
    if (confirm('Apagar todo o progresso e recomeçar?')) { resetando = true; localStorage.removeItem(CHAVE_SAVE); location.reload(); }
});
$('btn-switch-mode').addEventListener('click', () => {
    definirModo(modoAtual === 'tycoon' ? 'parkour' : 'tycoon');
});
$('btn-sound').addEventListener('click', () => {
    const ativo = sfx.toggle();
    $('btn-sound').textContent = ativo ? '🔊 Som ON' : '🔇 Som OFF';
});
$('btn-pk-checkpoint').addEventListener('click', () => {
    if (modoAtual === 'parkour') {
        posicionarNoCheckpoint(parkour.checkpoint, true);
        mostrarAviso('↩️ Retornou ao último checkpoint!');
    }
});
$('btn-pk-restart').addEventListener('click', () => {
    if (modoAtual === 'parkour') {
        posicionarNoCheckpoint(0, false);
        sfx.playSwitchMode();
        mostrarAviso('🔄 Mega Parkour reiniciado do zero!');
    }
});
addEventListener('beforeunload', salvar);

// ================= CONTROLES =================
const keys = {};
addEventListener('keydown', e => {
    keys[e.code] = true;
    if (jogoIniciado && modoAtual === 'parkour' && e.code === 'KeyR') {
        posicionarNoCheckpoint(parkour.checkpoint, true);
        mostrarAviso('↩️ Retornou ao checkpoint!');
    }
});
addEventListener('keyup', e => keys[e.code] = false);
let camYaw = -Math.PI / 2, camPitch = .48, isDragging = false;
addEventListener('mousedown', () => isDragging = true);
addEventListener('mouseup', () => isDragging = false);
addEventListener('mousemove', e => { if (isDragging) { camYaw -= e.movementX * .007; camPitch = Math.max(.15, Math.min(1.25, camPitch + e.movementY * .007)); } });

// ================= LOOP =================
let autoTimer = 0, saveTimer = 0;
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();

function atualizarFisicaParkour(dt, yAnterior) {
    if (jogoIniciado && parkour.checkpoint < parkour.plataformas.length - 1) {
        parkour.tempoCorrida += dt;
    }
    $('pk-timer-value').textContent = `${parkour.tempoCorrida.toFixed(1)}s`;

    parkour.plataformas.forEach(p => {
        if (p.movX) {
            const oldX = p.curX;
            p.curX = p.baseX + Math.sin(elapsed * p.spd) * p.movX;
            p.mesh.position.x = p.curX;
            p.dx = p.curX - oldX;
        } else {
            p.dx = 0;
        }

        if (p.vanish) {
            if (p.vanishState === 'shaking') {
                p.vanishTimer -= dt;
                p.mesh.position.x = p.curX + Math.sin(elapsed * 45) * 0.12;
                p.mesh.material.opacity = Math.max(0.2, p.vanishTimer / 0.85);
                if (p.vanishTimer <= 0) {
                    p.vanishState = 'gone';
                    p.vanishTimer = 2.6;
                    p.mesh.visible = false;
                    p.mesh.position.x = p.curX;
                }
            } else if (p.vanishState === 'gone') {
                p.vanishTimer -= dt;
                if (p.vanishTimer <= 0) {
                    p.vanishState = 'solid';
                    p.mesh.visible = true;
                    p.mesh.material.opacity = 0.92;
                }
            }
        }
    });

    for (const l of parkour.lasers) {
        const pos = Math.sin(elapsed * l.spd + l.offset) * l.amp;
        if (l.eixo === 'z') l.mesh.position.z = pos;
        else l.mesh.position.x = pos;

        const worldLaserX = l.plat.curX + (l.eixo === 'x' ? pos : 0);
        const worldLaserZ = l.plat.z + (l.eixo === 'z' ? pos : 0);
        const pertoY = Math.abs(player.position.y - l.plat.top) < 1.3;
        const hit = l.eixo === 'z'
            ? pertoY && Math.abs(player.position.x - l.plat.curX) < l.plat.w / 2 && Math.abs(player.position.z - worldLaserZ) < 0.45
            : pertoY && Math.abs(player.position.z - l.plat.z) < l.plat.d / 2 && Math.abs(player.position.x - worldLaserX) < 0.45;

        if (hit) {
            sfx.playLaserHit();
            mostrarAviso('⚡ Você tocou no laser! Voltou ao checkpoint.');
            posicionarNoCheckpoint(parkour.checkpoint, false);
            return;
        }
    }

    for (const sp of parkour.spinners) {
        sp.ang += sp.spd * dt;
        sp.mesh.rotation.y = sp.ang;
        const dx = player.position.x - sp.plat.curX;
        const dz = player.position.z - sp.plat.z;
        const distCentro = Math.hypot(dx, dz);
        if (Math.abs(player.position.y - sp.plat.top) < 1.3 && distCentro < sp.len / 2) {
            const angPlayer = Math.atan2(-dz, dx);
            let diff = Math.abs(((angPlayer - sp.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (diff < 0.22 || Math.abs(diff - Math.PI) < 0.22) {
                player.position.x += Math.cos(sp.ang + Math.PI / 2) * 14 * dt;
                player.position.z -= Math.sin(sp.ang + Math.PI / 2) * 14 * dt;
            }
        }
    }

    for (const m of parkour.moedas) {
        if (m.coletada) continue;
        const platRef = parkour.plataformas[m.platIdx];
        m.mesh.position.x = platRef ? platRef.curX : m.baseX;
        m.mesh.position.y = m.baseY + Math.sin(elapsed * 4 + m.platIdx) * 0.25;
        m.mesh.rotation.z = elapsed * 3;
        if (Math.hypot(player.position.x - m.mesh.position.x, player.position.z - m.baseZ) < 1.35 && Math.abs((player.position.y + 1.2) - m.mesh.position.y) < 1.6) {
            m.coletada = true;
            m.mesh.visible = false;
            const ganho = Math.round(m.valor * (1 + renascimentos * 0.35));
            dinheiro += ganho;
            stats.ganho += ganho;
            sfx.playCoin();
            mostrarAviso(`🪙 Moeda Bônus coletada! +$${fmt(ganho)}`);
        }
    }

    parkour.animaveis.forEach(fn => fn(elapsed));

    let pousou = false;
    for (let i = 0; i < parkour.plataformas.length; i++) {
        const d = parkour.plataformas[i];
        if (d.vanishState === 'gone') continue;

        const dentro = Math.abs(player.position.x - d.curX) < d.w / 2 + 0.28 && Math.abs(player.position.z - d.z) < d.d / 2 + 0.28;
        if (dentro && yAnterior >= d.top - 0.2 && player.position.y <= d.top && player.userData.vy <= 0) {
            player.position.y = d.top;
            player.position.x += d.dx || 0;
            player.userData.vy = 0;
            player.userData.noChao = true;
            pousou = true;

            if (d.vanish && d.vanishState === 'solid') {
                d.vanishState = 'shaking';
                d.vanishTimer = 0.85;
                sfx.playVanishStep();
            }

            if (d.bounce) {
                player.userData.vy = d.bounce;
                player.userData.noChao = false;
                sfx.playBouncePad();
                mostrarAviso('🚀 Trampolim ativado!');
            }

            if (d.checkpoint && parkour.checkpoint < i) {
                parkour.checkpoint = i;
                sfx.playCheckpoint();
                atualizarPainelParkour();
                mostrarAviso(`💚 Checkpoint ${d.checkpoint} ativado! (${zonaAtualParkour()})`);
            }

            if (d.tipo === 'finish') {
                concluirParkour();
                return;
            }
            break;
        }
    }

    if (!pousou && player.position.y < -8) {
        posicionarNoCheckpoint(parkour.checkpoint, true);
        mostrarAviso('↩️ Você caiu no abismo! Voltou ao checkpoint.');
    }
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(.05, clock.getDelta());
    elapsed += dt;
    const ud = player.userData;

    const moveX = (jogoIniciado && (keys.KeyD || keys.ArrowRight) ? 1 : 0) - (jogoIniciado && (keys.KeyA || keys.ArrowLeft) ? 1 : 0);
    const moveZ = (jogoIniciado && (keys.KeyS || keys.ArrowDown) ? 1 : 0) - (jogoIniciado && (keys.KeyW || keys.ArrowUp) ? 1 : 0);
    const moving = moveX !== 0 || moveZ !== 0;
    const estMax = 100 + 50 * nv('perk_estamina');
    const correndo = moving && (keys.ShiftLeft || keys.ShiftRight) && !exausto && estamina > 0;
    estamina = Math.min(estMax, Math.max(0, estamina + (correndo ? -28 : 15) * dt));
    if (estamina <= 0) exausto = true; else if (estamina > 25) exausto = false;

    const vel = 9.2 * (1 + .25 * nv('perk_velocidade')) * (correndo ? 1.5 : 1);
    if (moving) {
        const ang = Math.atan2(moveX, moveZ) + camYaw;
        player.position.x += Math.sin(ang) * vel * dt; player.position.z += Math.cos(ang) * vel * dt;
        player.rotation.y = ang;
        const sw = Math.sin(elapsed * (correndo ? 20 : 12)) * .65;
        ud.pernaE.rotation.x = sw; ud.pernaD.rotation.x = -sw; ud.bracoE.rotation.x = -sw; ud.bracoD.rotation.x = sw;
    } else ud.pernaE.rotation.x = ud.pernaD.rotation.x = ud.bracoE.rotation.x = ud.bracoD.rotation.x = 0;

    if (jogoIniciado && keys.Space && ud.noChao) {
        ud.vy = 9.4 + 2.5 * nv('perk_superPulo');
        ud.noChao = false;
        sfx.playJump();
    }
    const yAnterior = player.position.y;
    ud.vy -= 22 * dt; player.position.y += ud.vy * dt;

    if (modoAtual === 'parkour') {
        atualizarFisicaParkour(dt, yAnterior);
    } else if (player.position.y <= 0) {
        player.position.y = 0; ud.vy = 0; ud.noChao = true;
    }
    ud.aura.rotation.z = elapsed * 2;

    petsComprados.forEach((p, i) => {
        const a = elapsed * 2 + i * (Math.PI * 2 / petsComprados.length);
        p.mesh.position.lerp(tmpV.set(player.position.x + Math.cos(a) * 2.2, player.position.y + 1.4 + Math.sin(elapsed * 5 + i) * .25, player.position.z + Math.sin(a) * 2.2), .1);
        p.mesh.rotation.y = player.rotation.y;
        p.asas.forEach(w => w.rotation.z = w.userData.s * Math.sin(elapsed * 10) * .5);
    });

    const cd = 13;
    camera.position.set(player.position.x + Math.sin(camYaw) * Math.cos(camPitch) * cd, player.position.y + 2.5 + Math.sin(camPitch) * cd, player.position.z + Math.cos(camYaw) * Math.cos(camPitch) * cd);
    camera.lookAt(player.position.x, player.position.y + 1.8, player.position.z);

    const mult = getMultiplicadorTotal();
    if (modoAtual === 'tycoon') {
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
                niveis[it.id] = lvl + 1; it.cd = .8;
                sfx.playBuy();
                it.aplicar && it.aplicar(false, lvl + 1);
                if (lvl + 1 >= it.max) { it.mesh.parent.remove(it.mesh); it.label.remove(); padsInterativos.splice(i, 1); }
            }
        }
    }

    const fator = 1 + .25 * nv('perk_overclock'), sorte = .06 * nv('perk_sorte');
    fabricasAtivas.forEach(f => {
        if (!f.desbloqueada) return;
        f.animaveis.forEach(a => a(elapsed));
        if (f.quebrada) {
            f.alerta.position.y = 7.5 + Math.sin(elapsed * 8) * .4; f.alerta.rotation.y = elapsed * 4;
            if (nv('perk_tecnico')) { f.tReparo += dt; if (f.tReparo >= 5) consertar(f, true); }
            return;
        }
        if (f.dropperMesh.userData.animar) f.dropperMesh.userData.animar(elapsed * fator);
        f.dropTimer += dt * fator;
        if (f.dropTimer >= f.data.intervaloDrop) {
            f.dropTimer = 0;
            for (let k = 0; k < (renascimentos >= 2 ? 2 : 1); k++) {
                const m = f.data.criarItem3D();
                m.position.set(-12.5 - k * 1.1, 2.4, -2.5 + (Math.random() - .5) * .4);
                f.grupo.add(m);
                f.itens.push({ mesh: m, vy: 0, valor: f.data.valorBase * (Math.random() < sorte ? 3 : 1), passouPor: {} });
            }
        }
        for (let i = f.itens.length - 1; i >= 0; i--) {
            const it = f.itens[i];
            it.mesh.position.x += 3.6 * fator * dt;
            it.vy -= 18 * dt; it.mesh.position.y += it.vy * dt;
            if (it.mesh.position.y <= .95) { it.mesh.position.y = .95; it.vy = Math.abs(it.vy) > 1.5 ? -it.vy * f.data.quique : 0; }
            f.upgraders.forEach(u => {
                if (u.mesh.visible && !it.passouPor[u.estagio] && Math.abs(it.mesh.position.x - u.x) < .4) {
                    it.passouPor[u.estagio] = true; it.valor = Math.round(it.valor * u.mult); f.data.evoluirItem3D(it.mesh, u.estagio);
                    if (modoAtual === 'tycoon' && Math.hypot(player.position.x - u.x, player.position.z - f.data.zOffset) < 16) {
                        sfx.playUpgradeTick();
                    }
                }
            });
            if (it.mesh.position.x >= 13) {
                f.dinheiroAcumulado += Math.round(it.valor * mult); stats.itens++;
                f.grupo.remove(it.mesh); f.itens.splice(i, 1);
            }
        }
    });
    animMundo.forEach(a => a(elapsed));

    const m = missaoAtual(), prog = stats[m.t.k] - missaoBase[m.t.k];
    if (prog >= m.meta) { dinheiro += m.rec; missaoIdx++; missaoBase = { ...stats }; sfx.playVictory(); mostrarAviso(`🏆 Missão cumprida! +$${fmt(m.rec)}`); }

    saveTimer += dt; if (saveTimer > 5) { saveTimer = 0; salvar(); }

    $('cash-value').textContent = `$${fmt(dinheiro)}`;
    $('rebirth-value').textContent = renascimentos;
    $('mult-value').textContent = `${mult.toFixed(2)}x`;
    $('tier-value').textContent = `${renascimentos} • ${NOMES_TIER[Math.min(renascimentos, 6)]}`;
    $('pk-wins-value').textContent = vitoriasParkour;
    $('event-card').hidden = multEvento === 1 || modoAtual !== 'tycoon';
    if (multEvento > 1 && modoAtual === 'tycoon') $('event-card').textContent = `🌟 HORA DOURADA 2x — ${Math.ceil(eventoFim - elapsed)}s`;
    $('stamina-fill').style.width = `${estamina / estMax * 100}%`;
    $('stamina-fill').classList.toggle('tired', exausto);
    $('mission-text').textContent = `${m.t.txt(m.meta)} (${fmt(Math.min(prog, m.meta))}/${fmt(m.meta)}) → +$${fmt(m.rec)}`;
    $('mission-fill').style.width = `${Math.min(100, prog / m.meta * 100)}%`;

    renderer.render(scene, camera);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ================= MENU INICIAL & PERFIL =================
const menu = $('start-screen');
const skinOptions = $('skin-options');
function atualizarPreview(){
    const sk = skinAtual(), avatar = $('avatar-preview');
    avatar.style.setProperty('--skin', `#${sk.pele.toString(16).padStart(6,'0')}`);
    avatar.style.setProperty('--shirt', `#${sk.camisa.toString(16).padStart(6,'0')}`);
    avatar.style.setProperty('--pants', `#${sk.calca.toString(16).padStart(6,'0')}`);
    $('preview-name').textContent = perfil.nome || 'Jogador';
    $('preview-level').textContent = `NÍVEL ${String(1 + renascimentos).padStart(2, '0')}`;
    $('skin-count').textContent = `${String(SKINS.findIndex(x=>x.id===sk.id)+1).padStart(2,'0')} / ${String(SKINS.length).padStart(2,'0')}`;
    skinOptions.innerHTML = '';
    SKINS.forEach(skItem=>{
        const b=document.createElement('button'); b.className='skin-option'+(skItem.id===perfil.skin?' selected':'');
        b.innerHTML=`<span class="skin-swatch" style="background:linear-gradient(135deg,#${skItem.camisa.toString(16).padStart(6,'0')} 50%,#${skItem.calca.toString(16).padStart(6,'0')} 50%)"></span><strong>${skItem.nome}</strong><small>${skItem.desc}</small>`;
        b.addEventListener('click',()=>{perfil.skin=skItem.id; sfx.playUpgradeTick(); aplicarSkin(); atualizarPreview(); salvarPerfil();});
        skinOptions.appendChild(b);
    });
}
function salvarPerfil(){
    perfil.nome = ($('player-name').value.trim().slice(0,16) || 'Jogador');
    $('preview-name').textContent = perfil.nome;
    atualizarNomeAcima();
    try{localStorage.setItem('megaTycoon3D_profile',JSON.stringify(perfil));}catch(e){}
}
function abrirPerfil(){
    $('player-name').value=perfil.nome || 'Jogador';
    atualizarPreview();
    menu.style.display='flex';
}
$('player-name').addEventListener('input',()=>{
    perfil.nome=$('player-name').value.slice(0,16);
    $('preview-name').textContent=perfil.nome||'Jogador';
    atualizarNomeAcima();
});

function iniciarNoModo(modo) {
    sfx.init();
    salvarPerfil();
    aplicarSkin();
    jogoIniciado = true;
    menu.style.display = 'none';
    $('btn-profile').textContent = `👤 ${perfil.nome}`;
    definirModo(modo);
}

$('btn-start-tycoon').addEventListener('click', () => iniciarNoModo('tycoon'));
$('btn-start-parkour').addEventListener('click', () => iniciarNoModo('parkour'));
$('btn-profile').addEventListener('click', () => abrirPerfil());

try{const savedProfile=JSON.parse(localStorage.getItem('megaTycoon3D_profile'));if(savedProfile)perfil={...perfil,...savedProfile};}catch(e){}
$('player-name').value=perfil.nome;
aplicarSkin(); atualizarPreview();

carregar(); atualizarAura(); atualizarNomeAcima(); construirMundo(); definirModo('tycoon', true); animate();
