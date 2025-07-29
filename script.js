//
// script.js
//
// 此檔案實現遊戲的主要邏輯。包括地圖加載、單位管理、
// 事件處理以及簡單的即時戰略控制。該原型旨在展示如何利用
// HTML5 Canvas 構建互動兵棋推演，日後可依需求擴充更多功能。

(() => {
  'use strict';

  // 語言字典
  const messages = {
    zh: {
      resources: '資源',
      time: '時間',
      unitList: '部隊列表',
      unitInfo: '單位資訊',
      selectUnit: '選擇單位查看詳細資訊',
      move: '移動',
      attack: '攻擊',
      stop: '停止',
      pause: '暫停',
      resume: '繼續',
    },
    en: {
      resources: 'Resources',
      time: 'Time',
      unitList: 'Units',
      unitInfo: 'Unit Info',
      selectUnit: 'Select a unit to view details',
      move: 'Move',
      attack: 'Attack',
      stop: 'Stop',
      pause: 'Pause',
      resume: 'Resume',
    },
  };

  let currentLang = 'zh';

  // DOM elements
  const startScreen = document.getElementById('start-screen');
  const startBtn = document.getElementById('start-btn');
  const gameContainer = document.getElementById('game-container');
  const topBar = document.getElementById('top-bar');
  const resourceDisplay = document.getElementById('resource-display');
  const timeDisplay = document.getElementById('time-display');
  const langToggle = document.getElementById('lang-toggle');
  const unitListEl = document.getElementById('unit-list');
  const infoPanel = document.getElementById('info-panel');
  const infoContent = document.getElementById('info-content');
  const moveBtn = document.getElementById('move-btn');
  const attackBtn = document.getElementById('attack-btn');
  const stopBtn = document.getElementById('stop-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const canvas = document.getElementById('game-canvas');
  const miniMapCanvas = document.getElementById('mini-map');
  const ctx = canvas.getContext('2d');
  const miniCtx = miniMapCanvas.getContext('2d');

  // Game state
  let gameStarted = false;
  let selectedFaction = 'china';
  let resources = 1000;
  let gameTime = 0; // in seconds
  let timerInterval = null;
  let paused = false;
  let currentCommand = 'move'; // move, attack, stop

  // Map image
  const mapImage = new Image();
  mapImage.src = 'images/Taiwan_Strait.png';
  let mapLoaded = false;
  mapImage.onload = () => {
    mapLoaded = true;
    // Adjust canvas size to map
    canvas.width = mapImage.width;
    canvas.height = mapImage.height;
    // Mini map aspect ratio
    draw();
  };

  // Unit definitions
  const unitTypes = {
    infantry: { radius: 5, speed: 0.5, color: { china: '#cc4b37', taiwan: '#20a668', usa: '#265aa7' } },
    tank: { radius: 8, speed: 0.3, color: { china: '#e05038', taiwan: '#2cb073', usa: '#2f6fb5' } },
    jet: { radius: 6, speed: 1.0, color: { china: '#db5140', taiwan: '#1da764', usa: '#2b5fa0' } },
  };

  // Units array
  let units = [];
  let selectedUnits = [];

  // Initialize game with some units
  function initGame() {
    units = [];
    selectedUnits = [];
    resources = 1000;
    gameTime = 0;
    paused = false;
    currentCommand = 'move';
    updateToolButtons();

    // create units for each faction with predefined positions
    // positions roughly correspond to major cities/regions on the map
    const startingPositions = {
      china: [
        { type: 'infantry', x: 200, y: 200 },
        { type: 'tank', x: 220, y: 230 },
        { type: 'jet', x: 250, y: 180 },
      ],
      taiwan: [
        { type: 'infantry', x: 500, y: 550 },
        { type: 'tank', x: 520, y: 580 },
        { type: 'jet', x: 480, y: 520 },
      ],
      usa: [
        { type: 'infantry', x: 600, y: 100 },
        { type: 'tank', x: 630, y: 130 },
        { type: 'jet', x: 570, y: 90 },
      ],
    };

    Object.keys(startingPositions).forEach((faction) => {
      startingPositions[faction].forEach((pos, idx) => {
        units.push({
          id: `${faction}-${pos.type}-${idx}`,
          faction,
          type: pos.type,
          x: pos.x,
          y: pos.y,
          targetX: pos.x,
          targetY: pos.y,
          hp: 100,
          selected: false,
        });
      });
    });

    updateUnitList();
    updateInfoPanel();

    // start timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!paused) {
        gameTime++;
        updateTopBar();
      }
    }, 1000);

    // start animation loop
    requestAnimationFrame(update);
  }

  function updateTopBar() {
    const m = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const s = (gameTime % 60).toString().padStart(2, '0');
    resourceDisplay.textContent = `${messages[currentLang].resources}: ${resources}`;
    timeDisplay.textContent = `${messages[currentLang].time}: ${m}:${s}`;
  }

  function updateUnitList() {
    unitListEl.innerHTML = '';
    units.forEach((unit) => {
      const li = document.createElement('li');
      li.textContent = `${unit.faction.charAt(0).toUpperCase() + unit.faction.slice(1)} ${unit.type}`;
      li.dataset.id = unit.id;
      if (unit.selected) li.classList.add('selected');
      li.addEventListener('click', () => {
        clearSelections();
        unit.selected = true;
        selectedUnits = [unit];
        updateUnitList();
        updateInfoPanel();
      });
      unitListEl.appendChild(li);
    });
  }

  function updateInfoPanel() {
    const titleEl = infoPanel.querySelector('h2');
    titleEl.textContent = messages[currentLang].unitInfo;
    if (selectedUnits.length === 0) {
      infoContent.textContent = messages[currentLang].selectUnit;
    } else if (selectedUnits.length === 1) {
      const unit = selectedUnits[0];
      infoContent.innerHTML = `
        <p><strong>ID:</strong> ${unit.id}</p>
        <p><strong>陣營:</strong> ${unit.faction}</p>
        <p><strong>類型:</strong> ${unit.type}</p>
        <p><strong>HP:</strong> ${unit.hp}</p>
        <p><strong>位置:</strong> (${Math.round(unit.x)}, ${Math.round(unit.y)})</p>
      `;
    } else {
      infoContent.textContent = `${selectedUnits.length} units selected`;
    }
  }

  function clearSelections() {
    units.forEach((u) => {
      u.selected = false;
    });
    selectedUnits = [];
  }

  function selectUnitAt(x, y, multi = false) {
    let hit = null;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const dx = x - u.x;
      const dy = y - u.y;
      if (Math.sqrt(dx * dx + dy * dy) <= unitTypes[u.type].radius + 2) {
        hit = u;
        break;
      }
    }
    if (hit) {
      if (!multi) clearSelections();
      hit.selected = true;
      if (!selectedUnits.includes(hit)) selectedUnits.push(hit);
      updateUnitList();
      updateInfoPanel();
    } else if (!multi) {
      // clicked empty space: clear selection
      clearSelections();
      updateUnitList();
      updateInfoPanel();
    }
  }

  function issueMoveCommand(targetX, targetY) {
    selectedUnits.forEach((unit) => {
      unit.targetX = targetX;
      unit.targetY = targetY;
    });
  }

  function update() {
    if (!gameStarted) return;
    if (!paused) {
      // update units positions towards target
      units.forEach((unit) => {
        const speed = unitTypes[unit.type].speed;
        const dx = unit.targetX - unit.x;
        const dy = unit.targetY - unit.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.5) {
          const vx = (dx / dist) * speed;
          const vy = (dy / dist) * speed;
          unit.x += vx;
          unit.y += vy;
        }
      });
    }
    draw();
    requestAnimationFrame(update);
  }

  function draw() {
    if (!mapLoaded) return;
    // draw map
    ctx.drawImage(mapImage, 0, 0);
    // draw units
    units.forEach((unit) => {
      const typeInfo = unitTypes[unit.type];
      ctx.beginPath();
      ctx.fillStyle = typeInfo.color[unit.faction];
      ctx.arc(unit.x, unit.y, typeInfo.radius, 0, Math.PI * 2);
      ctx.fill();
      // selection ring
      if (unit.selected) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, typeInfo.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    // draw mini map
    drawMiniMap();
  }

  function drawMiniMap() {
    const mw = miniMapCanvas.width;
    const mh = miniMapCanvas.height;
    // draw scaled-down map
    miniCtx.drawImage(mapImage, 0, 0, mw, mh);
    // draw units scaled
    units.forEach((unit) => {
      const sx = (unit.x / canvas.width) * mw;
      const sy = (unit.y / canvas.height) * mh;
      const r = Math.max(2, (unitTypes[unit.type].radius * mw) / canvas.width);
      miniCtx.beginPath();
      miniCtx.fillStyle = unitTypes[unit.type].color[unit.faction];
      miniCtx.arc(sx, sy, r, 0, Math.PI * 2);
      miniCtx.fill();
    });
  }

  // 更新工具列按鈕狀態
  function updateToolButtons() {
    const toolButtons = { move: moveBtn, attack: attackBtn, stop: stopBtn };
    Object.keys(toolButtons).forEach((cmd) => {
      if (cmd === currentCommand) {
        toolButtons[cmd].classList.add('active');
      } else {
        toolButtons[cmd].classList.remove('active');
      }
    });
    // 更新按鈕文字
    moveBtn.textContent = messages[currentLang].move;
    attackBtn.textContent = messages[currentLang].attack;
    stopBtn.textContent = messages[currentLang].stop;
    pauseBtn.textContent = paused ? messages[currentLang].resume : messages[currentLang].pause;
  }

  // 語言切換
  function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    langToggle.textContent = currentLang === 'zh' ? 'EN' : '中';
    updateTopBar();
    // 更新標題/面板
    document.querySelector('#unit-panel h2').textContent = messages[currentLang].unitList;
    updateInfoPanel();
    updateToolButtons();
  }

  // 事件綁定
  function bindEvents() {
    // canvas 點擊事件
    canvas.addEventListener('mousedown', (e) => {
      // 計算點擊位置
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // 左鍵選取
      if (e.button === 0) {
        const multi = e.shiftKey;
        selectUnitAt(x, y, multi);
      }
      // 右鍵移動
      if (e.button === 2) {
        if (currentCommand === 'move') {
          issueMoveCommand(x, y);
        }
      }
    });
    // 禁用右鍵菜單
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 工具列按鈕
    moveBtn.addEventListener('click', () => {
      currentCommand = 'move';
      updateToolButtons();
    });
    attackBtn.addEventListener('click', () => {
      currentCommand = 'attack';
      updateToolButtons();
      // 攻擊功能待日後實作
    });
    stopBtn.addEventListener('click', () => {
      currentCommand = 'stop';
      updateToolButtons();
      // 停止移動
      selectedUnits.forEach((unit) => {
        unit.targetX = unit.x;
        unit.targetY = unit.y;
      });
    });
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      updateToolButtons();
    });

    // 語言切換
    langToggle.addEventListener('click', toggleLanguage);

    // 開始遊戲按鈕
    startBtn.addEventListener('click', () => {
      const selectedRadio = document.querySelector('input[name="faction"]:checked');
      selectedFaction = selectedRadio ? selectedRadio.value : 'china';
      startScreen.style.display = 'none';
      gameContainer.style.visibility = 'visible';
      gameStarted = true;
      initGame();
      updateTopBar();
      updateToolButtons();
    });
  }

  // 初始執行
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    // 預設語言按鈕文字
    langToggle.textContent = 'EN';
  });
})();