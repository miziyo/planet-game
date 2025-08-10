// --- DOM References ---
const svg = document.getElementById('simulation-svg');
const planetListContainer = document.getElementById('planet-list-container');
const addPlanetFormContainer = document.getElementById('add-planet-form-container');
const timeScaleDisplay = document.getElementById('time-scale-display');
const scenarioSelect = document.getElementById('scenario-select');
const loadScenarioBtn = document.getElementById('load-scenario-btn');

// SVG Namespace for creating elements
const SVG_NS = 'http://www.w3.org/2000/svg';

// --- Simulation State ---
const G = 6.67;
let planets = [];
let focusedPlanet = null;
let timeScale = 1.0;
let editingIndex = -1; // -1 means no planet is being edited

// --- SVG Camera/View State ---
let view = {
    x: 0,
    y: 0,
    zoom: 0.25
};
let svgGroup; // The main group element for panning and zooming

// --- Core Planet Class (2D SVG version) ---
class Planet {
    constructor(data) {
        // Physics Properties
        this.name = data.name;
        this.x = data.x;
        this.y = data.y;
        this.vx = data.vx;
        this.vy = data.vy;
        this.mass = data.mass;
        this.radius = data.radius;
        this.color = data.color;

        // SVG Element
        this.el = document.createElementNS(SVG_NS, 'circle');
        this.el.setAttribute('r', this.radius);
        this.el.setAttribute('fill', this.color);
        this.el.setAttribute('stroke', 'rgba(255,255,255,0.5)');
        this.el.setAttribute('stroke-width', '2');
    }

    addTo(svgParent) {
        svgParent.appendChild(this.el);
    }

    removeFrom(svgParent) {
        svgParent.removeChild(this.el);
    }

    updateVisuals() {
        this.el.setAttribute('cx', this.x);
        this.el.setAttribute('cy', this.y);
    }
}

function createCollisionEffect(x, y, radius) {
    const effect = document.createElementNS(SVG_NS, 'circle');
    effect.setAttribute('cx', x);
    effect.setAttribute('cy', y);
    effect.setAttribute('r', radius);
    effect.setAttribute('fill', 'white');
    effect.setAttribute('fill-opacity', '0.7');
    effect.style.pointerEvents = 'none'; // Prevent effect from blocking clicks

    svgGroup.appendChild(effect);

    let startTime = null;
    const duration = 300; // 0.3 seconds

    function animateEffect(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = (timestamp - startTime) / duration;

        if (progress < 1) {
            const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
            effect.setAttribute('r', radius + easedProgress * radius * 1.5);
            effect.setAttribute('fill-opacity', 0.7 * (1 - easedProgress));
            requestAnimationFrame(animateEffect);
        } else {
            svgGroup.removeChild(effect);
        }
    }
    requestAnimationFrame(animateEffect);
}


// --- Physics Engine (2D) ---
function updatePhysics() {
    if (timeScale === 0) return;

    // 1. 중력 계산
    for (let i = 0; i < planets.length; i++) {
        const planetA = planets[i];
        let totalForceX = 0;
        let totalForceY = 0;

        for (let j = 0; j < planets.length; j++) {
            if (i === j) continue;
            const planetB = planets[j];

            const dx = planetB.x - planetA.x;
            const dy = planetB.y - planetA.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            // 행성이 겹치더라도 중력은 계산합니다. (충돌은 별도 처리)
            if (dist === 0) continue;

            const force = (G * planetA.mass * planetB.mass) / distSq;
            totalForceX += force * (dx / dist);
            totalForceY += force * (dy / dist);
        }

        const ax = totalForceX / planetA.mass;
        const ay = totalForceY / planetA.mass;

        planetA.vx += ax * timeScale;
        planetA.vy += ay * timeScale;
    }

    // 2. 위치 업데이트
    for (const planet of planets) {
        planet.x += planet.vx * timeScale;
        planet.y += planet.vy * timeScale;
    }

    // 3. 충돌 감지 (다음 단계에서 처리될 예정)
    const collisions = [];
    for (let i = 0; i < planets.length; i++) {
        for (let j = i + 1; j < planets.length; j++) {
            const planetA = planets[i];
            const planetB = planets[j];
            const dx = planetB.x - planetA.x;
            const dy = planetB.y - planetA.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < planetA.radius + planetB.radius) {
                collisions.push([planetA, planetB]);
            }
        }
    }

    // 4. 충돌 처리
    const consumedPlanets = new Set();
    collisions.forEach(([planetA, planetB]) => {
        // 이미 다른 충돌로 인해 소멸된 행성은 처리하지 않음
        if (consumedPlanets.has(planetA) || consumedPlanets.has(planetB)) {
            return;
        }

        // 질량이 더 큰 쪽이 살아남음
        const survivor = planetA.mass > planetB.mass ? planetA : planetB;
        const consumed = planetA.mass > planetB.mass ? planetB : planetA;

        // 충돌 지점 계산 (질량 중심)
        const collisionX = (survivor.x * survivor.mass + consumed.x * consumed.mass) / (survivor.mass + consumed.mass);
        const collisionY = (survivor.y * survivor.mass + consumed.y * consumed.mass) / (survivor.mass + consumed.mass);

        // 운동량 보존 법칙: m1*v1 + m2*v2 = (m1+m2)*v_new
        const totalMass = survivor.mass + consumed.mass;
        survivor.vx = (survivor.mass * survivor.vx + consumed.mass * consumed.vx) / totalMass;
        survivor.vy = (survivor.mass * survivor.vy + consumed.mass * consumed.vy) / totalMass;

        // 부피 보존에 따른 새로운 반지름 계산 (r^3 ~ mass)
        const newRadius = Math.cbrt(survivor.radius**3 + consumed.radius**3);
        survivor.mass = totalMass;
        survivor.radius = newRadius;
        // SVG 요소의 반지름 속성을 즉시 업데이트
        survivor.el.setAttribute('r', newRadius);

        // 시각 효과 생성
        createCollisionEffect(collisionX, collisionY, newRadius);

        // 소멸된 행성을 기록
        consumedPlanets.add(consumed);
    });

    // 5. 소멸된 행성들을 시뮬레이션에서 제거
    if (consumedPlanets.size > 0) {
        planets = planets.filter(p => !consumedPlanets.has(p));
        for (const consumed of consumedPlanets) {
            consumed.removeFrom(svgGroup);
            if (focusedPlanet === consumed) {
                focusedPlanet = planets[0] || null;
            }
        }
        // UI 목록을 즉시 업데이트
        updatePlanetList();
    }
}

// --- Scenario Management ---
const SCENARIOS = {
    'default': [
        { name: 'Sun', x: 0, y: 0, vx: 0, vy: 0, mass: 2000, radius: 20, color: 'yellow' },
        { name: 'Earth', x: -300, y: 0, vx: 0, vy: 2.5, mass: 10, radius: 5, color: '#3498db' },
        { name: 'Mars', x: 450, y: 0, vx: 0, vy: -2, mass: 8, radius: 4, color: '#e74c3c' },
        { name: 'Jupiter', x: 0, y: -600, vx: 1.8, vy: 0, mass: 100, radius: 10, color: '#f39c12' }
    ],
    'binary_star': [
        { name: 'Star A', x: -100, y: 0, vx: 0, vy: 1, mass: 1200, radius: 15, color: '#ffA500' },
        { name: 'Star B', x: 150, y: 0, vx: 0, vy: -1.5, mass: 800, radius: 12, color: '#add8e6' },
        { name: 'Planet', x: 0, y: 1000, vx: -2, vy: 0, mass: 15, radius: 5, color: '#90ee90' }
    ],
    'asteroid_collision': [
        { name: 'Target Planet', x: 0, y: 0, vx: 0, vy: 0, mass: 1000, radius: 30, color: '#2ecc71' },
        { name: 'Asteroid 1', x: -800, y: 200, vx: 2, vy: -0.5, mass: 1, radius: 3, color: '#bdc3c7' },
        { name: 'Asteroid 2', x: -700, y: -300, vx: 1.5, vy: 1, mass: 2, radius: 4, color: '#95a5a6' },
        { name: 'Asteroid 3', x: 900, y: 100, vx: -2.5, vy: 0, mass: 1.5, radius: 3, color: '#7f8c8d' }
    ],
    'black_hole': [
        { name: 'Black Hole', x: 0, y: 0, vx: 0, vy: 0, mass: 10000, radius: 15, color: '#222' },
        { name: 'Star 1', x: -1500, y: 0, vx: 0, vy: 3, mass: 500, radius: 20, color: '#f1c40f' },
        { name: 'Star 2', x: 2000, y: 500, vx: -1, vy: -2, mass: 800, radius: 25, color: '#e67e22' },
        { name: 'Planet', x: 0, y: -2500, vx: 3, vy: 0, mass: 20, radius: 8, color: '#3498db' }
    ]
};

function loadScenario(scenarioId = 'default') {
    for (const planet of planets) {
        planet.removeFrom(svgGroup);
    }
    planets = [];

    const planetData = SCENARIOS[scenarioId];
    planetData.forEach(data => {
        const newPlanet = new Planet(data);
        planets.push(newPlanet);
        newPlanet.addTo(svgGroup);
    });

    focusedPlanet = planets.length > 0 ? planets[0] : null;
    updatePlanetList();
}

// --- Main Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    updatePhysics();

    if (focusedPlanet) {
        view.x = -focusedPlanet.x;
        view.y = -focusedPlanet.y;
    }

    const svgRect = svg.getBoundingClientRect();
    const centerX = svgRect.width / 2;
    const centerY = svgRect.height / 2;

    svgGroup.setAttribute('transform', `translate(${centerX}, ${centerY}) scale(${view.zoom}) translate(${view.x}, ${view.y})`);

    for (const planet of planets) {
        planet.updateVisuals();
    }
    updatePlanetInfo();
}

// --- UI and Event Listeners ---
function updatePlanetInfo() {
    planets.forEach((planet, index) => {
        if (editingIndex === index) return; // Don't update while editing
        const posElement = document.getElementById(`planet-${index}-pos`);
        const velElement = document.getElementById(`planet-${index}-vel`);
        if (posElement && velElement) {
            posElement.textContent = `Pos: (${planet.x.toFixed(0)}, ${planet.y.toFixed(0)})`;
            velElement.textContent = `Vel: (${planet.vx.toFixed(2)}, ${planet.vy.toFixed(2)})`;
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

        if (editingIndex === index) {
            // Render editing form
            planetElement.innerHTML = `
                <div class="planet-edit-form">
                    <input class="edit-name" value="${planet.name}">
                    <input class="edit-mass" type="number" value="${planet.mass}">
                    <input class="edit-radius" type="number" value="${planet.radius}">
                    <input class="edit-vx" type="number" step="0.1" value="${planet.vx}">
                    <input class="edit-vy" type="number" step="0.1" value="${planet.vy}">
                    <input class="edit-color" type="color" value="${planet.color}">
                    <div class="planet-actions">
                        <button class="save-btn">Save</button>
                        <button class="cancel-btn">Cancel</button>
                    </div>
                </div>
            `;
        } else {
            // Render normal view
            planetElement.innerHTML = `
                <div class="planet-main-info">
                    <div class="planet-color-swatch" style="background-color: ${planet.color};"></div>
                    <span>${planet.name} (Mass: ${planet.mass})</span>
                </div>
                <div class="planet-details">
                    <span id="planet-${index}-pos">Pos: ...</span>
                    <span id="planet-${index}-vel">Vel: ...</span>
                </div>
                <div class="planet-actions">
                    <button class="edit-btn">Edit</button>
                    ${planet.name !== 'Sun' && planet.name !== 'Star A' && planet.name !== 'Star B' ? `<button class="remove-btn">Remove</button>` : ''}
                </div>
            `;
        }
        planetListContainer.appendChild(planetElement);
    });
}

planetListContainer.addEventListener('click', (event) => {
    const planetItem = event.target.closest('.planet-item');
    if (!planetItem) return;

    const planetIndex = parseInt(planetItem.dataset.index, 10);
    const planet = planets[planetIndex];

    if (event.target.classList.contains('edit-btn')) {
        editingIndex = planetIndex;
        updatePlanetList();
    } else if (event.target.classList.contains('cancel-btn')) {
        editingIndex = -1;
        updatePlanetList();
    } else if (event.target.classList.contains('save-btn')) {
        const form = planetItem.querySelector('.planet-edit-form');
        planet.name = form.querySelector('.edit-name').value;
        planet.mass = parseFloat(form.querySelector('.edit-mass').value);
        planet.radius = parseFloat(form.querySelector('.edit-radius').value);
        planet.vx = parseFloat(form.querySelector('.edit-vx').value);
        planet.vy = parseFloat(form.querySelector('.edit-vy').value);
        planet.color = form.querySelector('.edit-color').value;

        // Update SVG element
        planet.el.setAttribute('r', planet.radius);
        planet.el.setAttribute('fill', planet.color);

        editingIndex = -1;
        updatePlanetList();
    } else if (event.target.classList.contains('remove-btn')) {
        if (focusedPlanet === planet) {
            focusedPlanet = planets.length > 1 ? planets[0] : null;
        }
        planet.removeFrom(svgGroup);
        planets.splice(planetIndex, 1);
        editingIndex = -1; // Reset editing state
        updatePlanetList();
    } else {
        focusedPlanet = planet;
        updatePlanetList();
    }
});

// Simple SVG pan and zoom
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };
svg.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'circle') {
        // Find and focus planet
        const clickedPlanet = planets.find(p => p.el === e.target);
        if (clickedPlanet) focusedPlanet = clickedPlanet;
    } else {
        isPanning = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        focusedPlanet = null; // Unfocus when panning
    }
    updatePlanetList();
});
svg.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = (e.clientX - lastMousePos.x) / view.zoom;
    const dy = (e.clientY - lastMousePos.y) / view.zoom;
    view.x += dx;
    view.y += dy;
    lastMousePos = { x: e.clientX, y: e.clientY };
});
svg.addEventListener('mouseup', () => { isPanning = false; });
svg.addEventListener('mouseleave', () => { isPanning = false; });
svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY < 0) {
        view.zoom *= zoomFactor; // Zoom in
    } else {
        view.zoom /= zoomFactor; // Zoom out
    }
});


loadScenarioBtn.addEventListener('click', () => { loadScenario(scenarioSelect.value); });
document.getElementById('time-slower-btn').addEventListener('click', () => { timeScale /= 2; updateTimeScaleDisplay(); });
document.getElementById('time-pause-btn').addEventListener('click', () => { timeScale = 0; updateTimeScaleDisplay(); });
document.getElementById('time-play-btn').addEventListener('click', () => { timeScale = 1.0; updateTimeScaleDisplay(); });
document.getElementById('time-faster-btn').addEventListener('click', () => { timeScale *= 2; updateTimeScaleDisplay(); });
function updateTimeScaleDisplay() {
    timeScaleDisplay.textContent = `x${timeScale.toFixed(2)}`;
}

function renderAddPlanetForm() {
    addPlanetFormContainer.innerHTML = `
        <form id="add-planet-form" style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 8px;">
                <input type="number" id="planet-x" placeholder="x" value="${Math.floor(Math.random() * 500) - 250}" required style="width:50px">
                <input type="number" id="planet-y" placeholder="y" value="${Math.floor(Math.random() * 500) - 250}" required style="width:50px">
                <input type="number" id="planet-vx" placeholder="vx" value="${(Math.random() * 4 - 2).toFixed(1)}" required step="0.1" style="width:50px">
                <input type="number" id="planet-vy" placeholder="vy" value="${(Math.random() * 4 - 2).toFixed(1)}" required step="0.1" style="width:50px">
            </div>
            <div style="display: flex; gap: 8px;">
                <input type="number" id="planet-mass" placeholder="mass" value="10" required style="width:60px">
                <input type="number" id="planet-radius" placeholder="radius" value="5" required style="width:60px">
                <input type="color" id="planet-color" value="#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}" required style="width:60px">
                <button type="submit" style="flex-grow:1;">Add Planet</button>
            </div>
        </form>
    `;

    document.getElementById('add-planet-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            name: `Planet ${planets.length}`,
            x: parseFloat(document.getElementById('planet-x').value),
            y: parseFloat(document.getElementById('planet-y').value),
            vx: parseFloat(document.getElementById('planet-vx').value),
            vy: parseFloat(document.getElementById('planet-vy').value),
            mass: parseFloat(document.getElementById('planet-mass').value),
            radius: parseFloat(document.getElementById('planet-radius').value),
            color: document.getElementById('planet-color').value
        };
        if (Object.values(data).slice(1).some(v => isNaN(v) && typeof v !== 'string')) {
            alert('Please fill all fields correctly.');
            return;
        }
        const newPlanet = new Planet(data);
        planets.push(newPlanet);
        newPlanet.addTo(svgGroup);
        updatePlanetList();
        renderAddPlanetForm();
    });
}


// --- Initialization ---
function init() {
    svg.innerHTML = ''; // Clear SVG
    svgGroup = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(svgGroup);

    loadScenario('default');
    renderAddPlanetForm();
    animate();
}

init();
