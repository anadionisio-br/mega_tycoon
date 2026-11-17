import * as THREE from 'three';

// Cache global de geometrias e materiais partilhados (evita memory leak)
const GEO = {
    chiclete: new THREE.SphereGeometry(0.38, 16, 16),
    blister: new THREE.BoxGeometry(1.0, 1.0, 1.0),
    cone: new THREE.ConeGeometry(0.36, 0.85, 14),
    bola1: new THREE.SphereGeometry(0.38, 16, 16),
    bola2: new THREE.SphereGeometry(0.34, 16, 16),
    calda: new THREE.SphereGeometry(0.36, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
    cereja: new THREE.SphereGeometry(0.15, 12, 12),
    lingote: new THREE.BoxGeometry(0.9, 0.35, 0.5),
    cabo: new THREE.BoxGeometry(0.3, 0.35, 1.2),
    cristal: new THREE.OctahedronGeometry(0.42),
    anel: new THREE.TorusGeometry(0.6, 0.05, 8, 20),
    orb: new THREE.SphereGeometry(0.16, 10, 10)
};

const MAT = {
    blister: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
    bola1: new THREE.MeshStandardMaterial({ color: 0xf472b6 }),
    bola2: new THREE.MeshStandardMaterial({ color: 0xfef08a }),
    calda: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.2 }),
    cereja: new THREE.MeshStandardMaterial({ color: 0xef4444 }),
    cabo: new THREE.MeshStandardMaterial({ color: 0xfbbf24 }),
    ouroBasic: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    cone: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 })
};

export const FABRICAS_DATA = [
    {
        id: 'chiclete',
        corDetalhe: 0xff4d9d,
        nome: '1. Fábrica de Chicletes',
        zOffset: -18,
        desbloqueadaInicialmente: true,
        precoDesbloqueio: 0,
        corPiso: 0xffe4e6,
        corParede: 0xfbcfe8,
        corEsteira: 0xff69b4,
        quique: 0.68,
        intervaloDrop: 1.35,
        valorBase: 15,
        upgraders: [
            { nome: 'Injetor de Sabor (2x)', preco: 60, mult: 2.0, x: -7 },
            { nome: 'Banho de Carnaúba (2x)', preco: 180, mult: 2.0, x: -1 },
            { nome: 'Laser Ácido Neon (2.5x)', preco: 450, mult: 2.5, x: 5 },
            { nome: 'Empacotadora Blister (3x)', preco: 1000, mult: 3.0, x: 11 }
        ],
        precoParedes: 350,

        criarDropper3D() {
            const grupo = new THREE.Group();
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(1.1, 1.6, 2.5, 20),
                new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3, metalness: 0.4 })
            );
            base.position.y = 1.25;
            base.castShadow = true;
            grupo.add(base);

            const globo = new THREE.Mesh(
                new THREE.SphereGeometry(1.8, 24, 24),
                new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1 })
            );
            globo.position.y = 3.8;
            grupo.add(globo);

            const cores = [0xff4d6d, 0x38bdf8, 0x4ade80, 0xfacc15, 0xc084fc];
            const bolaGeo = new THREE.SphereGeometry(0.32, 10, 10);
            for (let i = 0; i < 28; i++) {
                const bola = new THREE.Mesh(bolaGeo, new THREE.MeshStandardMaterial({ color: cores[i % cores.length] }));
                bola.position.set((Math.random() - 0.5) * 2.0, 3.1 + Math.random() * 1.4, (Math.random() - 0.5) * 2.0);
                grupo.add(bola);
            }

            const manivela = new THREE.Mesh(
                new THREE.BoxGeometry(1.1, 0.25, 0.25),
                new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7 })
            );
            manivela.position.set(0, 1.5, 1.45);
            grupo.add(manivela);
            grupo.userData.animar = (t) => { manivela.rotation.z = t * 5; };
            return grupo;
        },

        criarItem3D() {
            const cores = [0xff4d6d, 0x38bdf8, 0x4ade80, 0xfacc15, 0xc084fc];
            const mesh = new THREE.Mesh(
                GEO.chiclete,
                new THREE.MeshStandardMaterial({ color: cores[Math.floor(Math.random() * cores.length)], roughness: 0.85 })
            );
            mesh.userData.ownMaterial = true;
            mesh.castShadow = true;
            return mesh;
        },

        evoluirItem3D(mesh, estagio) {
            if (estagio === 1) {
                mesh.scale.setScalar(1.2);
            } else if (estagio === 2) {
                mesh.material.roughness = 0.08;
                mesh.material.metalness = 0.35;
            } else if (estagio === 3) {
                mesh.material.emissive = mesh.material.color;
                mesh.material.emissiveIntensity = 0.45;
            } else if (estagio === 4) {
                mesh.add(new THREE.Mesh(GEO.blister, MAT.blister));
            }
        }
    },

    {
        id: 'sorvete',
        corDetalhe: 0x22d3ee,
        nome: '2. Fábrica de Sorvetes',
        zOffset: 0,
        desbloqueadaInicialmente: false,
        precoDesbloqueio: 1500,
        corPiso: 0xe0f2fe,
        corParede: 0xbae6fd,
        corEsteira: 0x38bdf8,
        quique: 0.05,
        intervaloDrop: 1.5,
        valorBase: 120,
        upgraders: [
            { nome: 'Dispensador de Bola (2x)', preco: 2200, mult: 2.0, x: -7 },
            { nome: 'Segunda Bola Sabor (2x)', preco: 3800, mult: 2.0, x: -1 },
            { nome: 'Chuveiro de Calda (2.5x)', preco: 6000, mult: 2.5, x: 5 },
            { nome: 'Cereja & Granulado (3x)', preco: 9500, mult: 3.0, x: 11 }
        ],
        precoParedes: 4500,

        criarDropper3D() {
            const grupo = new THREE.Group();
            const corpo = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.4, 2.6), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
            corpo.position.y = 2.2;
            corpo.castShadow = true;
            grupo.add(corpo);

            const bico = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.1, 14), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 }));
            bico.rotation.x = Math.PI;
            bico.position.set(1.4, 2.3, 0);
            grupo.add(bico);
            grupo.userData.animar = (t) => { bico.scale.y = 1 + Math.sin(t * 6) * 0.25; };
            return grupo;
        },

        criarItem3D() {
            const cone = new THREE.Mesh(GEO.cone, MAT.cone);
            cone.rotation.x = Math.PI;
            cone.castShadow = true;
            return cone;
        },

        evoluirItem3D(mesh, estagio) {
            if (estagio === 1) {
                const bola1 = new THREE.Mesh(GEO.bola1, MAT.bola1);
                bola1.position.y = -0.45;
                mesh.add(bola1);
            } else if (estagio === 2) {
                const bola2 = new THREE.Mesh(GEO.bola2, MAT.bola2);
                bola2.position.y = -0.82;
                mesh.add(bola2);
            } else if (estagio === 3) {
                const calda = new THREE.Mesh(GEO.calda, MAT.calda);
                calda.rotation.x = Math.PI;
                calda.position.y = -0.84;
                mesh.add(calda);
            } else if (estagio === 4) {
                const cereja = new THREE.Mesh(GEO.cereja, MAT.cereja);
                cereja.position.y = -1.22;
                mesh.add(cereja);
            }
        }
    },

    {
        id: 'forja',
        corDetalhe: 0xfb923c,
        nome: '3. Forja Medieval',
        zOffset: 18,
        desbloqueadaInicialmente: false,
        precoDesbloqueio: 15000,
        corPiso: 0xd6d3d1,
        corParede: 0xa8a29e,
        corEsteira: 0x57534e,
        quique: 0.0,
        intervaloDrop: 1.6,
        valorBase: 1200,
        upgraders: [
            { nome: 'Tanque de Resfriamento (2x)', preco: 18000, mult: 2.0, x: -7 },
            { nome: 'Roda de Amolar (2x)', preco: 26000, mult: 2.0, x: -1 },
            { nome: 'Forja de Empunhadura (2.5x)', preco: 38000, mult: 2.5, x: 5 },
            { nome: 'Altar Encantado (3x)', preco: 52000, mult: 3.0, x: 11 }
        ],
        precoParedes: 30000,

        criarDropper3D() {
            const grupo = new THREE.Group();
            const fornalha = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.2, 2.8), new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 }));
            fornalha.position.y = 2.1;
            grupo.add(fornalha);

            const martelo = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 }));
            martelo.position.set(1.6, 2.4, 0);
            grupo.add(martelo);
            grupo.userData.animar = (t) => { martelo.rotation.z = Math.sin(t * 8) * 0.65; };
            return grupo;
        },

        criarItem3D() {
            const lingote = new THREE.Mesh(
                GEO.lingote,
                new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.75 })
            );
            lingote.userData.ownMaterial = true;
            lingote.castShadow = true;
            return lingote;
        },

        evoluirItem3D(mesh, estagio) {
            if (estagio === 1) {
                mesh.material.color.setHex(0x94a3b8);
                mesh.material.emissiveIntensity = 0;
                mesh.material.metalness = 0.85;
            } else if (estagio === 2) {
                mesh.scale.set(1.9, 0.55, 0.8);
            } else if (estagio === 3) {
                const cabo = new THREE.Mesh(GEO.cabo, MAT.cabo);
                cabo.position.x = -0.45;
                mesh.add(cabo);
            } else if (estagio === 4) {
                mesh.material.color.setHex(0xc084fc);
                mesh.material.emissive.setHex(0x9333ea);
                mesh.material.emissiveIntensity = 0.85;
            }
        }
    },

    {
        id: 'cristal',
        corDetalhe: 0xa78bfa,
        nome: '4. Mina de Cristais',
        zOffset: 36,
        desbloqueadaInicialmente: false,
        precoDesbloqueio: 150000,
        corPiso: 0x312e81,
        corParede: 0x4c1d95,
        corEsteira: 0x6d28d9,
        quique: 0.3,
        intervaloDrop: 1.7,
        valorBase: 9000,
        upgraders: [
            { nome: 'Britador Arcano (2x)', preco: 170000, mult: 2.0, x: -7 },
            { nome: 'Lapidador de Facetas (2x)', preco: 240000, mult: 2.0, x: -1 },
            { nome: 'Banho de Mana (2.5x)', preco: 340000, mult: 2.5, x: 5 },
            { nome: 'Coroa de Ouro (3x)', preco: 480000, mult: 3.0, x: 11 }
        ],
        precoParedes: 260000,

        criarDropper3D() {
            const grupo = new THREE.Group();
            const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.6 }));
            base.position.y = 0.6;
            base.castShadow = true;
            grupo.add(base);
            const cristal = new THREE.Mesh(
                new THREE.OctahedronGeometry(1.4),
                new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x7c3aed, emissiveIntensity: 0.8, roughness: 0.1 })
            );
            cristal.position.y = 3.4;
            grupo.add(cristal);
            grupo.userData.animar = (t) => { cristal.rotation.y = t * 2; cristal.position.y = 3.4 + Math.sin(t * 3) * 0.2; };
            return grupo;
        },

        criarItem3D() {
            const mesh = new THREE.Mesh(
                GEO.cristal,
                new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x7c3aed, emissiveIntensity: 0.5, roughness: 0.2 })
            );
            mesh.userData.ownMaterial = true;
            mesh.castShadow = true;
            return mesh;
        },

        evoluirItem3D(mesh, estagio) {
            if (estagio === 1) {
                mesh.scale.setScalar(1.3);
            } else if (estagio === 2) {
                mesh.material.color.setHex(0x67e8f9);
                mesh.material.emissiveIntensity = 1.1;
            } else if (estagio === 3) {
                const anel = new THREE.Mesh(GEO.anel, MAT.ouroBasic);
                anel.rotation.x = Math.PI / 2;
                mesh.add(anel);
            } else if (estagio === 4) {
                const orb = new THREE.Mesh(GEO.orb, MAT.ouroBasic);
                orb.position.set(0.8, 0.8, 0);
                mesh.add(orb);
            }
        }
    }
];