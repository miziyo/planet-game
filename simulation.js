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

// --- Physics Engine (2D) ---
function updatePhysics() {
    if (timeScale === 0) return;

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

            if (dist < planetA.radius + planetB.radius) continue;

            const force = (G * planetA.mass * planetB.mass) / distSq;
            totalForceX += force * (dx / dist);
            totalForceY += force * (dy / dist);
        }

        const ax = totalForceX / planetA.mass;
        const ay = totalForceY / planetA.mass;

        planetA.vx += ax * timeScale;
        planetA.vy += ay * timeScale;
    }

    for (const planet of planets) {
        planet.x += planet.vx * timeScale;
        planet.y += planet.vy * timeScale;
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
function updatePlanetInfo() { /* To be re-implemented if needed */ }
function updatePlanetList() {
    planetListContainer.innerHTML = '';
    planets.forEach((planet, index) => {
        const planetElement = document.createElement('div');
        planetElement.className = 'planet-item';
        planetElement.dataset.index = index;
        if (planet === focusedPlanet) planetElement.classList.add('focused');

        planetElement.innerHTML = `
            <div class="planet-main-info">
                <div class="planet-color-swatch" style="background-color: ${planet.color};"></div>
                <span>${planet.name} (Mass: ${planet.mass})</span>
            </div>
        `;
        planetListContainer.appendChild(planetElement);
    });
}
planetListContainer.addEventListener('click', (event) => {
    const planetItem = event.target.closest('.planet-item');
    if (!planetItem) return;
    const planetIndex = parseInt(planetItem.dataset.index, 10);
    focusedPlanet = planets[planetIndex];
    updatePlanetList();
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

// --- Initialization ---
function init() {
    svg.innerHTML = ''; // Clear SVG
    svgGroup = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(svgGroup);

    loadScenario('default');
    animate();
}

init();
