import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- DOM References ---
const canvas = document.getElementById('simulationCanvas');
const planetListContainer = document.getElementById('planet-list-container');
const addPlanetFormContainer = document.getElementById('add-planet-form-container');
const timeScaleDisplay = document.getElementById('time-scale-display');
const scenarioSelect = document.getElementById('scenario-select');
const loadScenarioBtn = document.getElementById('load-scenario-btn');
const showVelocityCheckbox = document.getElementById('show-velocity-vectors');
const showAccelerationCheckbox = document.getElementById('show-acceleration-vectors');
const showWireframeCheckbox = document.getElementById('show-wireframe');

// --- 3D Scene Setup ---
let scene, camera, renderer, controls;

// --- Simulation State ---
const G = 6.67;
let planets = []; // Single source of truth for all planet objects
let focusedPlanet = null;
let timeScale = 1.0;
let showVelocityVectors = false;
let showAccelerationVectors = false;
let showWireframe = false;

// --- Core Planet Class (Redesigned) ---
class Planet {
    constructor(data) {
        // Physics Properties
        this.name = data.name;
        this.position = new THREE.Vector3(data.x, data.y, data.z);
        this.velocity = new THREE.Vector3(data.vx, data.vy, data.vz);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.mass = data.mass;
        this.radius = data.radius;
        this.color = new THREE.Color(data.color);

        // 3D Object Properties
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        this.solidMat = data.name === 'Sun'
            ? new THREE.MeshBasicMaterial({ color: this.color })
            : new THREE.MeshStandardMaterial({ color: this.color });
        this.wireframeMat = new THREE.MeshBasicMaterial({ color: this.color, wireframe: true });

        this.mesh = new THREE.Mesh(geometry, this.solidMat);
        this.mesh.position.copy(this.position);

        // Associate this physics object with the 3D mesh for raycasting
        this.mesh.userData.planet = this;

        // Visualization Helpers
        this.velArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), this.position, 100, 0x00ff00);
        this.accArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), this.position, 100, 0xff00ff);
    }

    // Add all 3D objects for this planet to the scene
    addToScene(scene) {
        scene.add(this.mesh);
        scene.add(this.velArrow);
        scene.add(this.accArrow);
    }

    // Remove all 3D objects for this planet from the scene and dispose of them
    removeFromScene(scene) {
        scene.remove(this.mesh);
        scene.remove(this.velArrow);
        scene.remove(this.accArrow);
        this.mesh.geometry.dispose();
        this.solidMat.dispose();
        this.wireframeMat.dispose();
    }

    // Update the visual state of the 3D objects
    updateVisuals() {
        // Update position
        this.mesh.position.copy(this.position);

        // Update materials
        this.mesh.material = showWireframe ? this.wireframeMat : this.solidMat;

        // Update velocity vector
        this.velArrow.position.copy(this.position);
        this.velArrow.setDirection(this.velocity.clone().normalize());
        this.velArrow.setLength(this.velocity.length() * 20, 20, 10);
        this.velArrow.visible = showVelocityVectors;

        // Update acceleration vector
        this.accArrow.position.copy(this.position);
        if (this.acceleration.lengthSq() > 0) {
            this.accArrow.setDirection(this.acceleration.clone().normalize());
            this.accArrow.setLength(this.acceleration.length() * 5000, 20, 10);
        }
        this.accArrow.visible = showAccelerationVectors;
    }
}

// --- Physics Engine ---
function updatePhysics() {
    if (timeScale === 0) return;

    const forces = new Map();

    for (const planetA of planets) {
        let totalForce = new THREE.Vector3();
        for (const planetB of planets) {
            if (planetA === planetB) continue;
            const distanceSq = planetA.position.distanceToSquared(planetB.position);
            if (distanceSq < (planetA.radius + planetB.radius)**2) continue;

            const forceMagnitude = (G * planetA.mass * planetB.mass) / distanceSq;
            const forceDirection = new THREE.Vector3().subVectors(planetB.position, planetA.position).normalize();
            totalForce.add(forceDirection.multiplyScalar(forceMagnitude));
        }
        forces.set(planetA, totalForce);
    }

    for (const planet of planets) {
        const force = forces.get(planet) || new THREE.Vector3(0, 0, 0);
        planet.acceleration = force.clone().divideScalar(planet.mass);
        planet.velocity.add(planet.acceleration.clone().multiplyScalar(timeScale));
        planet.position.add(planet.velocity.clone().multiplyScalar(timeScale));
    }
}

// --- Scenario Management ---
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
        { name: 'Planet', x: 0, y: 0, z: 4000, vx: 2.5, vy: 0, vz: 0, mass: 15, radius: 25, color: 0x90ee90 }
    ]
};

function loadScenario(scenarioId = 'default') {
    // Clear previous objects
    for (const planet of planets) {
        planet.removeFromScene(scene);
    }
    planets = [];

    const planetData = SCENARIOS[scenarioId];
    if (!planetData) {
        console.error(`Scenario with id "${scenarioId}" not found.`);
        return;
    }

    planetData.forEach(data => {
        const newPlanet = new Planet(data);
        planets.push(newPlanet);
        newPlanet.addToScene(scene);
    });

    focusedPlanet = planets.length > 0 ? planets[0] : null;
    updatePlanetList();
}

// --- 3D Scene Initialization ---
function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 50000);
    camera.position.set(0, 800, 2000);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 3, 0, 0);
    scene.add(pointLight);

    resizeCanvas();
}

// --- Main Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    updatePhysics();

    for (const planet of planets) {
        planet.updateVisuals();
    }

    if (focusedPlanet) {
        controls.target.copy(focusedPlanet.position);
    }
    controls.update();
    updatePlanetInfo();
    renderer.render(scene, camera);
}

// --- UI and Event Listeners ---
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

function updatePlanetInfo() {
    planets.forEach((planet, index) => {
        const posElement = document.getElementById(`planet-${index}-pos`);
        const velElement = document.getElementById(`planet-${index}-vel`);
        if (posElement && velElement) {
            const sun = planets.find(p => p.name === 'Sun' || p.name === 'Star A') || { position: new THREE.Vector3() };
            const relPos = new THREE.Vector3().subVectors(planet.position, sun.position);
            posElement.textContent = `Pos: (${relPos.x.toFixed(0)}, ${relPos.y.toFixed(0)}, ${relPos.z.toFixed(0)})`;
            velElement.textContent = `Vel: (${planet.velocity.x.toFixed(2)}, ${planet.velocity.y.toFixed(2)}, ${planet.velocity.z.toFixed(2)})`;
        }
    });
}

function updatePlanetList() {
    planetListContainer.innerHTML = '';
    planets.forEach((planet, index) => {
        const planetElement = document.createElement('div');
        planetElement.className = 'planet-item';
        planetElement.dataset.index = index;
        if (planet === focusedPlanet) planetElement.classList.add('focused');

        planetElement.innerHTML = `
            <div class="planet-main-info">
                <div class="planet-color-swatch" style="background-color: #${planet.color.getHexString()};"></div>
                <span>${planet.name} (Mass: ${planet.mass})</span>
            </div>
            <div class="planet-details">
                <span id="planet-${index}-pos">Pos: ...</span>
                <span id="planet-${index}-vel">Vel: ...</span>
            </div>
            <div class="planet-actions">
                ${planet.name !== 'Sun' && planet.name !== 'Star A' && planet.name !== 'Star B' ? `<button class="remove-btn">Remove</button>` : ''}
            </div>
        `;
        planetListContainer.appendChild(planetElement);
    });
}

planetListContainer.addEventListener('click', (event) => {
    const planetItem = event.target.closest('.planet-item');
    if (!planetItem) return;

    const planetIndex = parseInt(planetItem.dataset.index, 10);
    const planet = planets[planetIndex];

    if (event.target.classList.contains('remove-btn')) {
        if (focusedPlanet === planet) focusedPlanet = planets[0];
        planet.removeFromScene(scene);
        planets.splice(planetIndex, 1);
    } else {
        focusedPlanet = planet;
    }
    updatePlanetList();
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(planets.map(p => p.mesh));
    if (intersects.length > 0) {
        focusedPlanet = intersects[0].object.userData.planet;
    } else {
        focusedPlanet = planets[0];
    }
    updatePlanetList();
});

loadScenarioBtn.addEventListener('click', () => {
    loadScenario(scenarioSelect.value);
});

showVelocityCheckbox.addEventListener('change', (e) => { showVelocityVectors = e.target.checked; });
showAccelerationCheckbox.addEventListener('change', (e) => { showAccelerationVectors = e.target.checked; });
showWireframeCheckbox.addEventListener('change', (e) => { showWireframe = e.target.checked; });

document.getElementById('time-slower-btn').addEventListener('click', () => { timeScale /= 2; updateTimeScaleDisplay(); });
document.getElementById('time-pause-btn').addEventListener('click', () => { timeScale = 0; updateTimeScaleDisplay(); });
document.getElementById('time-play-btn').addEventListener('click', () => { timeScale = 1.0; updateTimeScaleDisplay(); });
document.getElementById('time-faster-btn').addEventListener('click', () => { timeScale *= 2; updateTimeScaleDisplay(); });
function updateTimeScaleDisplay() {
    timeScaleDisplay.textContent = `x${timeScale.toFixed(2)}`;
}

function renderAddPlanetForm() {
    addPlanetFormContainer.innerHTML = `
        <form id="add-planet-form">
            <p style="font-size:0.8em; opacity:0.7;">Z축을 포함한 3D 좌표 및 속도를 입력하세요.</p>
            <div class="form-row">
                <label>Position (x, y, z)</label>
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

    const form = document.getElementById('add-planet-form');
    form.addEventListener('submit', (event) => {
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
        if (Object.values(data).slice(1).some(isNaN)) {
            alert('Please enter valid numbers for all fields.');
            return;
        }
        const newPlanet = new Planet(data);
        planets.push(newPlanet);
        newPlanet.addToScene(scene);
        updatePlanetList();
        renderAddPlanetForm(); // Re-render for new random values
    });
}

// --- Start Simulation ---
init3D();
loadScenario('default');
animate();
renderAddPlanetForm(); // Render the add form initially
