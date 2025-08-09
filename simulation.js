const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

// 캔버스 크기를 창에 맞게 설정합니다.
canvas.width = window.innerWidth * 0.95;
canvas.height = window.innerHeight * 0.95;

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
    }

    // 캔버스에 행성을 그리는 메소드입니다.
    draw() {
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


// 행성의 위치를 업데이트하는 함수입니다.
function update() {
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

        // 힘을 이용해 가속도를 계산하고(a = F/m), 속도를 업데이트합니다.
        planets[i].vx += totalForceX / planets[i].mass;
        planets[i].vy += totalForceY / planets[i].mass;
    }

    // 업데이트된 속도를 이용해 위치를 변경합니다.
    for (const planet of planets) {
        planet.x += planet.vx;
        planet.y += planet.vy;
    }
}

// 애니메이션 루프입니다.
function animate() {
    // 캔버스를 약간 투명한 검은색으로 덮어 잔상 효과를 만듭니다.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 캔버스 중앙으로 좌표계를 이동시켜 태양이 중앙에 오도록 합니다.
    // ctx.save();
    // ctx.translate(-sun.x + canvas.width / 2, -sun.y + canvas.height / 2);

    // 행성 위치를 업데이트하고 그립니다.
    update();
    for (const planet of planets) {
        planet.draw();
    }

    // ctx.restore();

    requestAnimationFrame(animate);
}

// 시뮬레이션을 시작합니다.
animate();
