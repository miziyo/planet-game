const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const planetListContainer = document.getElementById('planet-list-container');
const addPlanetFormContainer = document.getElementById('add-planet-form-container');

// 캔버스 크기를 CSS에 의해 결정된 실제 크기로 설정하고, 창 크기 변경에 대응합니다.
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    // 리사이즈 시 초기 행성 위치가 깨지지 않도록 재배치 로직이 필요할 수 있으나,
    // 우선은 캔버스 크기만 조절합니다.
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // 초기 사이즈 설정

// 시뮬레이션에 맞게 조절된 중력 상수입니다.
const G = 6.67;

// 행성 클래스를 정의합니다.
class Planet {
    constructor(x, y, vx, vy, mass, radius, color) {
        this.x = x; // x 좌표
        this.y = y; // y 좌표
        this.vx = vx; // x축 속도
        this.vy = vy; // y축 속도
        this.mass = mass;
        this.radius = radius;
        this.color = color;
        this.trail = []; // 궤적을 저장할 배열
    }

    // 캔버스에 행성과 궤적을 그리는 메소드입니다.
    draw() {
        // 궤적 그리기
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.6; // 궤적을 약간 투명하게
            ctx.stroke();
            ctx.globalAlpha = 1.0; // 다시 불투명하게
        }

        // 행성 본체 그리기
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// 행성들을 담을 배열입니다.
const planets = [];

// 중앙에 위치한 무거운 "태양"
const sun = new Planet(canvas.width / 2, canvas.height / 2, 0, 0, 2000, 20, 'yellow');
planets.push(sun);

// "지구"
const earth = new Planet(canvas.width / 2 - 250, canvas.height / 2, 0, 2.5, 10, 8, '#3498db');
planets.push(earth);

// "화성"
const mars = new Planet(canvas.width / 2 + 350, canvas.height / 2, 0, -2, 8, 7, '#e74c3c');
planets.push(mars);

// "목성" - 더 무겁게 설정
const jupiter = new Planet(canvas.width / 2, canvas.height / 2 - 450, 1.8, 0, 100, 15, '#f39c12');
planets.push(jupiter);

// 현재 화면의 중심에 올 행성입니다. 처음에는 태양으로 설정합니다.
let focusedPlanet = sun;
let timeScale = 1.0;


// 행성의 위치를 업데이트하는 함수입니다.
function update() {
    if (timeScale === 0) return; // 시간이 멈췄으면 업데이트하지 않습니다.

    // 각 행성에 작용하는 총 힘을 계산합니다.
    for (let i = 0; i < planets.length; i++) {
        let totalForceX = 0;
        let totalForceY = 0;

        // 다른 모든 행성으로부터 받는 힘을 계산합니다.
        for (let j = 0; j < planets.length; j++) {
            if (i === j) continue;

            const planetA = planets[i];
            const planetB = planets[j];

            const dx = planetB.x - planetA.x;
            const dy = planetB.y - planetA.y;
            const distanceSq = dx * dx + dy * dy;
            const distance = Math.sqrt(distanceSq);

            // 행성들이 너무 가까워지면 불안정해지므로, 충돌 시 계산을 건너뜁니다.
            if (distance < planetA.radius + planetB.radius) {
                continue;
            }

            // 만유인력 법칙: F = G * (m1 * m2) / r^2
            const force = (G * planetA.mass * planetB.mass) / distanceSq;

            // 힘의 x, y 성분을 계산합니다.
            const forceX = force * (dx / distance);
            const forceY = force * (dy / distance);

            totalForceX += forceX;
            totalForceY += forceY;
        }

        // 힘을 이용해 가속도를 계산하고(a = F/m), 시간 배속을 적용하여 속도를 업데이트합니다.
        planets[i].vx += (totalForceX / planets[i].mass) * timeScale;
        planets[i].vy += (totalForceY / planets[i].mass) * timeScale;
    }

    // 업데이트된 속도를 이용해 위치를 변경하고 궤적을 기록합니다.
    for (const planet of planets) {
        planet.x += planet.vx * timeScale;
        planet.y += planet.vy * timeScale;

        // 궤적 배열에 현재 위치를 추가합니다.
        // 시간이 빨리 흐를 때는 궤적 점을 덜 추가하여 부드럽게 보이도록 합니다.
        if (Math.random() < 1 / Math.sqrt(timeScale + 1)) {
             planet.trail.unshift({ x: planet.x, y: planet.y });
        }

        // 궤적의 최대 길이를 300으로 제한합니다.
        const MAX_TRAIL_LENGTH = 300;
        if (planet.trail.length > MAX_TRAIL_LENGTH) {
            planet.trail.pop();
        }
    }
}

// 애니메이션 루프입니다.
function animate() {
    // 캔버스를 완전히 검은색으로 지웁니다.
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 좌표계를 저장합니다.
    ctx.save();

    // focusedPlanet이 화면 중앙에 오도록 좌표계를 이동합니다.
    if (focusedPlanet) {
        ctx.translate(canvas.width / 2 - focusedPlanet.x, canvas.height / 2 - focusedPlanet.y);
    }

    // 행성 위치를 업데이트하고 그립니다.
    update();
    for (const planet of planets) {
        planet.draw();
    }

    // 좌표계를 복원합니다.
    ctx.restore();

    // UI 정보를 업데이트합니다.
    updatePlanetInfo();

    requestAnimationFrame(animate);
}

// --- UI 컨트롤 로직 ---

function updatePlanetInfo() {
    planets.forEach((planet, index) => {
        const posElement = document.getElementById(`planet-${index}-pos`);
        const velElement = document.getElementById(`planet-${index}-vel`);

        if (posElement && velElement) {
            // 태양을 기준으로 한 상대 좌표를 계산합니다. (태양 자신은 0,0)
            const relX = planet.x - sun.x;
            const relY = planet.y - sun.y;
            posElement.textContent = `Pos: (${relX.toFixed(0)}, ${relY.toFixed(0)})`;
            velElement.textContent = `Vel: (${planet.vx.toFixed(2)}, ${planet.vy.toFixed(2)})`;
        }
    });
}

function updatePlanetList() {
    planetListContainer.innerHTML = ''; // 목록을 비웁니다.

    planets.forEach((planet, index) => {
        const planetElement = document.createElement('div');
        planetElement.className = 'planet-item';
        planetElement.dataset.index = index; // 항목 자체에 인덱스를 부여합니다.
        planetElement.style.cursor = 'pointer'; // 클릭 가능함을 나타냅니다.

        if (planet === focusedPlanet) {
            planetElement.classList.add('focused');
        }

        // 태양과 일반 행성을 구분하여 이름을 부여합니다.
        const planetName = planet.mass > 1000 ? 'Sun' : `Planet #${index}`;

        // 상세 정보를 표시할 구조를 추가합니다.
        planetElement.innerHTML = `
            <div class="planet-main-info">
                <div class="planet-color-swatch" style="background-color: ${planet.color};"></div>
                <span>${planetName} (Mass: ${planet.mass})</span>
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

// 이벤트 위임을 사용하여 행성 목록의 클릭을 처리합니다.
planetListContainer.addEventListener('click', (event) => {
    const target = event.target;

    // 클릭된 대상의 가장 가까운 .planet-item 조상을 찾습니다.
    const planetItem = target.closest('.planet-item');
    if (!planetItem) return; // 행성 아이템이 아니면 무시

    const planetIndex = parseInt(planetItem.dataset.index, 10);
    const planet = planets[planetIndex];

    // 삭제 버튼이 클릭된 경우
    if (target.classList.contains('remove-btn')) {
        if (focusedPlanet === planet) {
            focusedPlanet = sun; // 삭제된 행성이 포커스된 경우, 포커스를 태양으로 리셋
        }
        planets.splice(planetIndex, 1);
        updatePlanetList();
        return; // 포커스 로직을 실행하지 않고 종료
    }

    // 그 외의 경우, 아이템 클릭으로 간주하고 포커스합니다.
    focusedPlanet = planet;
    updatePlanetList();
});

// 캔버스 클릭 이벤트를 처리하여 화면 전환 기능을 구현합니다.
canvas.addEventListener('click', (event) => {
    // 캔버스 내의 클릭 좌표를 얻습니다.
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // 현재 카메라(좌표계)의 이동량을 계산합니다.
    const translateX = focusedPlanet ? canvas.width / 2 - focusedPlanet.x : 0;
    const translateY = focusedPlanet ? canvas.height / 2 - focusedPlanet.y : 0;

    // 클릭된 화면 좌표를 시뮬레이션 내의 실제 좌표(월드 좌표)로 변환합니다.
    const worldX = clickX - translateX;
    const worldY = clickY - translateY;

    let clickedOnPlanet = null;
    // 모든 행성을 확인하며 클릭된 행성이 있는지 찾습니다.
    for (const planet of planets) {
        const dx = worldX - planet.x;
        const dy = worldY - planet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < planet.radius) {
            clickedOnPlanet = planet;
            break; // 첫 번째로 찾은 행성으로 결정
        }
    }

    if (clickedOnPlanet) {
        focusedPlanet = clickedOnPlanet;
    } else {
        focusedPlanet = sun;
    }
    updatePlanetList(); // 포커스가 변경되었으므로 목록 UI를 업데이트합니다.
});


function renderAddPlanetForm() {
    addPlanetFormContainer.innerHTML = `
        <form id="add-planet-form">
            <div class="form-row">
                <label>Position (x, y) - relative to center</label>
                <input type="number" id="planet-x" value="${Math.floor(Math.random() * 400) - 200}" required>
                <input type="number" id="planet-y" value="${Math.floor(Math.random() * 400) - 200}" required>
            </div>
            <div class="form-row">
                <label>Velocity (vx, vy)</label>
                <input type="number" id="planet-vx" value="${(Math.random() * 4 - 2).toFixed(1)}" step="0.1" required>
                <input type="number" id="planet-vy" value="${(Math.random() * 4 - 2).toFixed(1)}" step="0.1" required>
            </div>
            <div class="form-row">
                <label>Mass</label>
                <input type="number" id="planet-mass" value="${Math.floor(Math.random() * 20) + 5}" min="1" required>
                <label>Radius</label>
                <input type="number" id="planet-radius" value="${Math.floor(Math.random() * 5) + 3}" min="1" required>
            </div>
            <div class="form-row">
                <label>Color</label>
                <input type="color" id="planet-color" value="#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}" required>
            </div>
            <button type="submit">Add Planet</button>
        </form>
    `;
}

addPlanetFormContainer.addEventListener('submit', (event) => {
    event.preventDefault();

    // 입력값을 가져와 숫자로 변환합니다.
    const x = parseFloat(document.getElementById('planet-x').value) + (canvas.width / 2);
    const y = parseFloat(document.getElementById('planet-y').value) + (canvas.height / 2);
    const vx = parseFloat(document.getElementById('planet-vx').value);
    const vy = parseFloat(document.getElementById('planet-vy').value);
    const mass = parseFloat(document.getElementById('planet-mass').value);
    const radius = parseFloat(document.getElementById('planet-radius').value);
    const color = document.getElementById('planet-color').value;

    // 유효성 검사
    if ([x, y, vx, vy, mass, radius].some(isNaN)) {
        alert('Please enter valid numbers for all fields.');
        return;
    }

    const newPlanet = new Planet(x, y, vx, vy, mass, radius, color);
    planets.push(newPlanet);
    updatePlanetList(); // 새 행성이 추가되었으니 목록을 새로고침합니다.

    // 다음 입력을 위해 폼의 일부 값을 랜덤화합니다.
    renderAddPlanetForm();
});


// --- 시간 제어 로직 ---
const timeScaleDisplay = document.getElementById('time-scale-display');
const slowerBtn = document.getElementById('time-slower-btn');
const pauseBtn = document.getElementById('time-pause-btn');
const playBtn = document.getElementById('time-play-btn');
const fasterBtn = document.getElementById('time-faster-btn');

function updateTimeScaleDisplay() {
    timeScaleDisplay.textContent = `x${timeScale.toFixed(2)}`;
}

slowerBtn.addEventListener('click', () => {
    timeScale /= 2;
    updateTimeScaleDisplay();
});

pauseBtn.addEventListener('click', () => {
    timeScale = 0;
    updateTimeScaleDisplay();
});

playBtn.addEventListener('click', () => {
    timeScale = 1.0;
    updateTimeScaleDisplay();
});

fasterBtn.addEventListener('click', () => {
    timeScale *= 2;
    updateTimeScaleDisplay();
});


// --- 드래그 리사이즈 로직 ---
const resizer = document.getElementById('resizer');
const controlsPanel = document.querySelector('.controls-panel');

resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();

    // 마우스 이동과 떼기 이벤트를 최상위 window에 추가합니다.
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    function handleMouseMove(e) {
        // 현재 창의 너비와 높이를 가져옵니다.
        const container = resizer.parentElement;
        const containerRect = container.getBoundingClientRect();

        // 현재 레이아웃이 세로인지 가로인지 확인합니다.
        const isVertical = getComputedStyle(container).flexDirection === 'column';

        if (isVertical) {
            // 세로 모드일 때 (높이 조절)
            const newCanvasHeight = e.clientY - containerRect.top;
            const newControlsHeight = containerRect.height - newCanvasHeight;

            // 최소/최대 크기 제한
            if (newCanvasHeight > 100 && newControlsHeight > 100) {
                canvas.style.height = `${newCanvasHeight}px`;
                controlsPanel.style.height = `${newControlsHeight}px`;
            }
        } else {
            // 가로 모드일 때 (너비 조절)
            const newCanvasWidth = e.clientX - containerRect.left;
            const newControlsWidth = containerRect.width - newCanvasWidth;

            // 최소/최대 크기 제한
            if (newCanvasWidth > 200 && newControlsWidth > 200) {
                canvas.style.width = `${newCanvasWidth}px`;
                controlsPanel.style.width = `${newControlsWidth}px`;
            }
        }
        // 캔버스의 내부 해상도를 DOM 크기에 맞게 업데이트합니다.
        resizeCanvas();
    }

    function handleMouseUp() {
        // 마우스 버튼을 떼면 이벤트 리스너를 제거합니다.
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }
});


// --- 초기화 ---
updatePlanetList(); // 시뮬레이션 시작 시 행성 목록을 처음으로 생성합니다.
renderAddPlanetForm(); // 행성 추가 폼을 렌더링합니다.
animate();
