import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- DOM References ---
const canvas = document.getElementById('simulationCanvas');
// UI 컨테이너들은 나중에 재연동합니다.
const planetListContainer = document.getElementById('planet-list-container');
const addPlanetFormContainer = document.getElementById('add-planet-form-container');
const timeScaleDisplay = document.getElementById('time-scale-display');


// --- 3D Scene Setup ---
let scene, camera, renderer, controls;

// --- Physics Engine State ---
const G = 6.67;
let planets = [];
let planet3DObjects = new Map();
let focusedPlanet = null;
let timeScale = 1.0;

// Visualization state
let velocityArrows = new Map();
let accelerationArrows = new Map();
let planetAccelerations = new Map(); // To store acceleration vectors for visualization
let showVelocityVectors = false;
let showAccelerationVectors = false;
let showWireframe = false;

class Planet {
    constructor(name, x, y, z, vx, vy, vz, mass, radius, color) {
        this.name = name;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(vx, vy, vz);
        this.mass = mass;
        this.radius = radius;
        this.color = color;
        this.trail = [];
    }
}

function updatePhysics() {
    if (timeScale === 0) return;

    const forces = new Map();

    // 1. 모든 행성에 대한 총 힘 계산
    for (const planetA of planets) {
        let totalForce = new THREE.Vector3();
        for (const planetB of planets) {
            if (planetA === planetB) continue;

            const distance = planetA.position.distanceTo(planetB.position);

            // 너무 가까우면 계산 스킵 (충돌 방지)
            if (distance < planetA.radius + planetB.radius) continue;

            const forceMagnitude = (G * planetA.mass * planetB.mass) / (distance * distance);
            const forceDirection = new THREE.Vector3().subVectors(planetB.position, planetA.position).normalize();

            totalForce.add(forceDirection.multiplyScalar(forceMagnitude));
        }
        forces.set(planetA, totalForce);
    }

    // 2. 계산된 힘을 바탕으로 속도와 위치 업데이트
    for (const planet of planets) {
        const force = forces.get(planet);
        if (!force) {
            planetAccelerations.set(planet, new THREE.Vector3(0, 0, 0));
            continue;
        };

        const acceleration = force.clone().divideScalar(planet.mass);
        planetAccelerations.set(planet, acceleration); // 시각화를 위해 가속도 저장

        planet.velocity.add(acceleration.clone().multiplyScalar(timeScale));
        planet.position.add(planet.velocity.clone().multiplyScalar(timeScale));
    }
}

const SCENARIOS = {
    'default': [
        { name: 'Sun', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mass: 2000, radius: 100, color: 0xffff00 },
        { name: 'Earth', x: -1200, y: 0, z: 0, vx: 0, vy: 2.5, vz: 0, mass: 10, radius: 20, color: 0x3498db },
        { name: 'Mars', x: 1800, y: 0, z: 0, vx: 0, vy: -2, vz: 0, mass: 8, radius: 18, color: 0xe74c3c },
        { name: 'Jupiter', x: 0, y: 0, z: -2500, vx: 1.8, vy: 0, vz: 0, mass: 100, radius: 50, color: 0xf39c12 }
    ],
    'binary_star': [
        { name: 'Star A', x: -400, y: 0, z: 0, vx: 0, vy: 2, vz: 0, mass: 1200, radius: 80, color: 0xffa500 },
        { name: 'Star B', x: 600, y: 0, z: 0, vx: 0, vy: -3, vz: 0, mass: 800, radius: 60, color: 0xadd8e6 },
        { name: 'Planet', x: 0, y: 0, z: 4000, vx: 2, vy: 0, vz: 0, mass: 15, radius: 25, color: 0x90ee90 }
    ]
};

function createInitialPlanets(scenarioId = 'default') {
    // Clear previous objects
    for (const planet of planets) {
        const planetObjects = planet3DObjects.get(planet);
        if (planetObjects) {
            scene.remove(planetObjects.mesh);
            planetObjects.mesh.geometry.dispose();
            planetObjects.solidMat.dispose();
            planetObjects.wireframeMat.dispose();
        }
        const velArrow = velocityArrows.get(planet);
        if(velArrow) scene.remove(velArrow);
        const accArrow = accelerationArrows.get(planet);
        if(accArrow) scene.remove(accArrow);
    }
    planets = [];
    planet3DObjects.clear();
    velocityArrows.clear();
    accelerationArrows.clear();
    planetAccelerations.clear();

    const planetData = SCENARIOS[scenarioId];
    if (!planetData) {
        console.error(`Scenario with id "${scenarioId}" not found.`);
        return;
    }

    planetData.forEach(data => {
        addPlanet(data);
    });

    focusedPlanet = planets.length > 0 ? planets[0] : null;
    updatePlanetList();
}


function init3D() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 50000);
    camera.position.set(0, 800, 2000);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    // 태양 역할을 할 점 광원
    const pointLight = new THREE.PointLight(0xffffff, 3, 0, 0);
    scene.add(pointLight);

    // Initial resize to set renderer size
    resizeCanvas();
}

// --- Main Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // 물리 업데이트
    updatePhysics();

    // 3D 객체 및 시각화 업데이트
    for (const planet of planets) {
        const mesh = planet3DObjects.get(planet);
        if (mesh) {
            mesh.position.copy(planet.position);
        }

        // 속도 벡터 업데이트
        const velArrow = velocityArrows.get(planet);
        if (velArrow) {
            velArrow.position.copy(planet.position);
            velArrow.setDirection(planet.velocity.clone().normalize());
            // 길이는 로그 스케일 등을 적용하면 더 보기 좋지만, 일단은 직접적인 길이로
            velArrow.setLength(planet.velocity.length() * 20, 20, 10);
            velArrow.visible = showVelocityVectors;
        }

        // 가속도 벡터 업데이트
        const accArrow = accelerationArrows.get(planet);
        const acceleration = planetAccelerations.get(planet);
        if (accArrow && acceleration) {
            accArrow.position.copy(planet.position);
            accArrow.setDirection(acceleration.clone().normalize());
            accArrow.setLength(acceleration.length() * 5000, 20, 10); // 가속도는 값이 작으므로 길이를 더 크게 증폭
            accArrow.visible = showAccelerationVectors;
        }
    }

    // 카메라 컨트롤 업데이트
    if (focusedPlanet && controls.target) {
        const focusedMesh = planet3DObjects.get(focusedPlanet);
        if (focusedMesh) {
            controls.target.copy(focusedMesh.position);
        }
    }
    controls.update();

    // UI 정보 업데이트
    updatePlanetInfo();

    // 3D 렌더링
    renderer.render(scene, camera);
}

// --- Event Listeners & UI ---
function resizeCanvas() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
}
window.addEventListener('resize', resizeCanvas);


// --- Initialization ---
console.log("Setting up 3D environment...");
init3D();
createInitialPlanets('default');
animate();

// --- 기존 UI 함수들의 재구현 ---
function updatePlanetInfo() {
    planets.forEach((planet, index) => {
        const posElement = document.getElementById(`planet-${index}-pos`);
        const velElement = document.getElementById(`planet-${index}-vel`);

        if (posElement && velElement) {
            const sun = planets[0]; // 태양을 기준으로
            const relX = planet.position.x - sun.position.x;
            const relY = planet.position.y - sun.position.y;
            const relZ = planet.position.z - sun.position.z;
            posElement.textContent = `Pos: (${relX.toFixed(0)}, ${relY.toFixed(0)}, ${relZ.toFixed(0)})`;
            velElement.textContent = `Vel: (${planet.velocity.x.toFixed(2)}, ${planet.velocity.y.toFixed(2)}, ${planet.velocity.z.toFixed(2)})`;
        }
    });
}

function updatePlanetList() {
    planetListContainer.innerHTML = ''; // 목록을 비웁니다.

    planets.forEach((planet, index) => {
        const planetElement = document.createElement('div');
        planetElement.className = 'planet-item';
        planetElement.dataset.index = index;
        planetElement.style.cursor = 'pointer';

        if (planet === focusedPlanet) {
            planetElement.classList.add('focused');
        }

        planetElement.innerHTML = `
            <div class="planet-main-info">
                <div class="planet-color-swatch" style="background-color: #${new THREE.Color(planet.color).getHexString()};"></div>
                <span>${planet.name} (Mass: ${planet.mass})</span>
            </div>
            <div class="planet-details">
                <span id="planet-${index}-pos">Pos: ...</span>
                <span id="planet-${index}-vel">Vel: ...</span>
            </div>
            <div class="planet-actions">
                ${index > 0 ? `<button class="remove-btn">Remove</button>` : ''}
            </div>
        `;
        planetListContainer.appendChild(planetElement);
    });
}

function renderAddPlanetForm() {
    addPlanetFormContainer.innerHTML = `
        <form id="add-planet-form">
            <p style="font-size:0.8em; opacity:0.7;">Z축을 포함한 3D 좌표 및 속도를 입력하세요.</p>
            <div class="form-row">
                <label>Position (x, y, z) - relative to center</label>
                <input type="number" id="planet-x" value="${Math.floor(Math.random() * 2000) - 1000}" required>
                <input type="number" id="planet-y" value="${Math.floor(Math.random() * 400) - 200}" required>
                <input type="number" id="planet-z" value="${Math.floor(Math.random() * 2000) - 1000}" required>
            </div>
            <div class="form-row">
                <label>Velocity (vx, vy, vz)</label>
                <input type="number" id="planet-vx" value="${(Math.random() * 4 - 2).toFixed(1)}" step="0.1" required>
                <input type="number" id="planet-vy" value="${(Math.random() * 4 - 2).toFixed(1)}" step="0.1" required>
                <input type="number" id="planet-vz" value="${(Math.random() * 4 - 2).toFixed(1)}" step="0.1" required>
            </div>
            <div class="form-row">
                <label>Mass</label>
                <input type="number" id="planet-mass" value="${Math.floor(Math.random() * 20) + 5}" min="1" required>
                <label>Radius</label>
                <input type="number" id="planet-radius" value="${Math.floor(Math.random() * 15) + 5}" min="1" required>
            </div>
            <div class="form-row">
                <label>Color</label>
                <input type="color" id="planet-color" value="#${new THREE.Color(Math.random() * 0xffffff).getHexString()}" required>
            </div>
            <button type="submit">Add Planet</button>
        </form>
    `;
}

function addPlanet(data) {
    const planet = new Planet(data.name, data.x, data.y, data.z, data.vx, data.vy, data.vz, data.mass, data.radius, data.color);
    planets.push(planet);

    // 3D 구체 및 재질 생성
    const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
    const solidMat = data.name === 'Sun'
        ? new THREE.MeshBasicMaterial({ color: data.color })
        : new THREE.MeshStandardMaterial({ color: data.color });
    const wireframeMat = new THREE.MeshBasicMaterial({ color: data.color, wireframe: true });

    const initialMat = showWireframe ? wireframeMat : solidMat;
    const sphere = new THREE.Mesh(geometry, initialMat);
    sphere.position.copy(planet.position);
    scene.add(sphere);

    // 3D 객체와 재질들을 함께 저장
    planet3DObjects.set(planet, { mesh: sphere, solidMat, wireframeMat });

    // 속도 벡터 애로우 생성
    const velArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), planet.position, 100, 0x00ff00);
    velArrow.visible = showVelocityVectors;
    scene.add(velArrow);
    velocityArrows.set(planet, velArrow);

    // 가속도 벡터 애로우 생성
    const accArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), planet.position, 100, 0xff00ff);
    accArrow.visible = showAccelerationVectors;
    scene.add(accArrow);
    accelerationArrows.set(planet, accArrow);
}


addPlanetFormContainer.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = {
        name: `Planet #${planets.length}`,
        x: parseFloat(document.getElementById('planet-x').value),
        y: parseFloat(document.getElementById('planet-y').value),
        z: parseFloat(document.getElementById('planet-z').value),
        vx: parseFloat(document.getElementById('planet-vx').value),
        vy: parseFloat(document.getElementById('planet-vy').value),
        vz: parseFloat(document.getElementById('planet-vz').value),
        mass: parseFloat(document.getElementById('planet-mass').value),
        radius: parseFloat(document.getElementById('planet-radius').value),
        color: new THREE.Color(document.getElementById('planet-color').value).getHex()
    };

    if (Object.values(data).slice(1).some(isNaN)) { // name 빼고 모두 검사
        alert('Please enter valid numbers for all fields.');
        return;
    }

    addPlanet(data);
    updatePlanetList();
    renderAddPlanetForm();
});

// Remove planet logic in the list click handler
planetListContainer.addEventListener('click', (event) => {
    const target = event.target;
    const planetItem = target.closest('.planet-item');
    if (!planetItem) return;

    const planetIndex = parseInt(planetItem.dataset.index, 10);
    const planet = planets[planetIndex];

    if (target.classList.contains('remove-btn')) {
        if (focusedPlanet === planet) {
            focusedPlanet = planets[0]; // Reset focus to sun
        }

        // Remove all associated 3D objects from scene
        const planetObjects = planet3DObjects.get(planet);
        if (planetObjects) {
            scene.remove(planetObjects.mesh);
            planetObjects.mesh.geometry.dispose();
            planetObjects.solidMat.dispose();
            planetObjects.wireframeMat.dispose();
        }
        const velArrow = velocityArrows.get(planet);
        if (velArrow) scene.remove(velArrow);
        const accArrow = accelerationArrows.get(planet);
        if (accArrow) scene.remove(accArrow);

        // Delete from maps and array
        planet3DObjects.delete(planet);
        velocityArrows.delete(planet);
        accelerationArrows.delete(planet);
        planetAccelerations.delete(planet);
        planets.splice(planetIndex, 1);

        updatePlanetList();
        return;
    }

    focusedPlanet = planet;
    updatePlanetList();
});


// 3D 캔버스 클릭-포커스 로직 (Raycasting)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

canvas.addEventListener('click', (event) => {
    // 마우스 위치를 정규화된 장치 좌표로 변환 (-1 to +1)
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 카메라와 마우스 위치로 레이캐스터를 업데이트
    raycaster.setFromCamera(mouse, camera);

    // 씬에 있는 객체들과의 교차점을 계산
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // 클릭된 3D 객체에 해당하는 물리 객체를 찾습니다.
        for (const [planet, mesh] of planet3DObjects.entries()) {
            if (mesh === clickedObject) {
                focusedPlanet = planet;
                updatePlanetList();
                return;
            }
        }
    }

    // 배경을 클릭한 경우 포커스를 태양으로 리셋합니다.
    focusedPlanet = planets[0]; // sun
    updatePlanetList();
});


// --- 시나리오 UI 로직 ---
const scenarioSelect = document.getElementById('scenario-select');
const loadScenarioBtn = document.getElementById('load-scenario-btn');

loadScenarioBtn.addEventListener('click', () => {
    const selectedScenario = scenarioSelect.value;
    createInitialPlanets(selectedScenario);
});


// --- 시각화 UI 로직 ---
const showVelocityCheckbox = document.getElementById('show-velocity-vectors');
const showAccelerationCheckbox = document.getElementById('show-acceleration-vectors');
const showWireframeCheckbox = document.getElementById('show-wireframe');

showVelocityCheckbox.addEventListener('change', (e) => {
    showVelocityVectors = e.target.checked;
});

showAccelerationCheckbox.addEventListener('change', (e) => {
    showAccelerationVectors = e.target.checked;
});

showWireframeCheckbox.addEventListener('change', (e) => {
    showWireframe = e.target.checked;
    // 모든 행성의 재질을 즉시 업데이트
    for (const planet of planets) {
        const planetObjects = planet3DObjects.get(planet);
        if (planetObjects) {
            planetObjects.mesh.material = showWireframe ? planetObjects.wireframeMat : planetObjects.solidMat;
        }
    }
});


// 시간 제어 로직은 일부 유지 가능
document.getElementById('time-slower-btn').addEventListener('click', () => { timeScale /= 2; updateTimeScaleDisplay(); });
document.getElementById('time-pause-btn').addEventListener('click', () => { timeScale = 0; updateTimeScaleDisplay(); });
document.getElementById('time-play-btn').addEventListener('click', () => { timeScale = 1.0; updateTimeScaleDisplay(); });
document.getElementById('time-faster-btn').addEventListener('click', () => { timeScale *= 2; updateTimeScaleDisplay(); });
function updateTimeScaleDisplay() {
    timeScaleDisplay.textContent = `x${timeScale.toFixed(2)}`;
}
console.log("3D environment setup complete.");
