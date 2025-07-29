//
// 全新遊戲邏輯腳本
//
// 本腳本實作了一個簡化的即時戰略模擬器，允許玩家於台灣海峽
// 地圖上控制多個單位。提供滑鼠框選、右鍵移動、基礎生產單位
// 與資源管理功能。此版本以 Canvas 2D 為核心，不使用外部
// 圖形引擎，確保可在 GitHub Pages 上流暢運行。

(() => {
  'use strict';

  // DOM 元素
  const startScreen = document.getElementById('start-screen');
  const startBtn = document.getElementById('start-btn');
  const gameContainer = document.getElementById('game-container');
  const statusResources = document.getElementById('status-resources');
  const statusTime = document.getElementById('status-time');
  const currentFactionEl = document.getElementById('current-faction');
  const unitListEl = document.getElementById('unit-list');
  const infoDisplay = document.getElementById('info-display');
  const buildInfantryBtn = document.getElementById('build-infantry');
  const buildTankBtn = document.getElementById('build-tank');
  const buildJetBtn = document.getElementById('build-jet');
  const cmdButtons = {
    move: document.getElementById('cmd-move'),
    stop: document.getElementById('cmd-stop'),
    hold: document.getElementById('cmd-hold'),
    pause: document.getElementById('cmd-pause'),
  };

  // Canvas setup
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // 遊戲狀態
  let gameStarted = false;
  let selectedFaction = 'china';
  let resources = 1000;
  let gameTime = 0;
  let timerInterval = null;
  let paused = false;
  let currentCommand = 'move';

  // 地圖圖像
  //
  // 注意：GitHub Pages 部署時，若圖片路徑帶有資料夾，Jekyll 可能無法正確處理。
  // 因此本版本直接將地圖檔案放置在存放庫根目錄下，並於此處載入該檔案。
  // 若將來要改為其他載入方式，可將下列路徑調整為對應位置或改用 base64 資料 URI。
  const mapImage = new Image();
  mapImage.src = 'Taiwan_Strait.png';
  let mapLoaded = false;
  mapImage.onload = () => {
    mapLoaded = true;
    // 適應 Canvas 大小以容納地圖；如果地圖太大可縮放或裁切
    canvas.width = mapImage.width;
    canvas.height = mapImage.height;
    draw();
  };

  // 單位設定
  const unitTypes = {
    infantry: { radius: 6, speed: 0.8, hp: 60, cost: 100 },
    tank: { radius: 10, speed: 0.5, hp: 120, cost: 200 },
    jet: { radius: 8, speed: 1.2, hp: 80, cost: 300 },
  };

  // 單位中文名稱對照
  // 用於顯示於部隊列表與資訊面板，使介面完全繁體中文
  const unitNameZH = {
    infantry: '步兵',
    tank: '戰車',
    jet: '戰機',
  };

  // 單位顏色依陣營設定
  const factionColors = {
    china: '#d9413a',
    taiwan: '#2aa567',
    usa: '#2c5faf',
  };

  // 單位陣列與建築
  let units = [];
  let selectedUnits = [];
  let hq = null; // 簡易總部

  // 框選矩形相關狀態
  let isSelecting = false;
  let selectStart = { x: 0, y: 0 };
  let selectCurrent = { x: 0, y: 0 };

  function initGame() {
    // 初始化資源與時間
    resources = 1000;
    gameTime = 0;
    paused = false;
    currentCommand = 'move';
    units = [];
    selectedUnits = [];
    hq = null;
    updateCmdButtons();

    // 建立玩家總部 (HQ)
    const basePos = getFactionBasePosition(selectedFaction);
    hq = {
      x: basePos.x,
      y: basePos.y,
      width: 30,
      height: 30,
      faction: selectedFaction,
      hp: 500,
    };

    // 初始單位配置 (每陣營三種單位各 2 個)
    const initialPositions = getInitialUnitPositions(selectedFaction);
    initialPositions.forEach((pos) => {
      spawnUnit(pos.type, pos.x, pos.y);
    });

    // 啟動時間計時器
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!paused) {
        gameTime++;
        updateStatusBar();
      }
    }, 1000);

    // 啟動動畫循環
    requestAnimationFrame(update);
  }

  // 根據陣營回傳總部位置
  function getFactionBasePosition(faction) {
    // 使用 mapImage 的座標大致對應主要地區
    if (faction === 'china') return { x: 150, y: 200 };
    if (faction === 'taiwan') return { x: canvas.width - 200, y: canvas.height - 200 };
    if (faction === 'usa') return { x: canvas.width - 200, y: 200 };
    return { x: canvas.width / 2, y: canvas.height / 2 };
  }

  // 初始單位位置依陣營
  function getInitialUnitPositions(faction) {
    const positions = [];
    if (faction === 'china') {
      positions.push({ type: 'infantry', x: 180, y: 250 });
      positions.push({ type: 'infantry', x: 210, y: 230 });
      positions.push({ type: 'tank', x: 200, y: 280 });
      positions.push({ type: 'tank', x: 230, y: 260 });
      positions.push({ type: 'jet', x: 150, y: 180 });
      positions.push({ type: 'jet', x: 190, y: 170 });
    } else if (faction === 'taiwan') {
      const bx = canvas.width - 220;
      const by = canvas.height - 260;
      positions.push({ type: 'infantry', x: bx, y: by });
      positions.push({ type: 'infantry', x: bx + 30, y: by + 20 });
      positions.push({ type: 'tank', x: bx - 20, y: by + 40 });
      positions.push({ type: 'tank', x: bx + 40, y: by + 50 });
      positions.push({ type: 'jet', x: bx, y: by - 40 });
      positions.push({ type: 'jet', x: bx + 30, y: by - 60 });
    } else if (faction === 'usa') {
      const bx = canvas.width - 250;
      const by = 220;
      positions.push({ type: 'infantry', x: bx, y: by });
      positions.push({ type: 'infantry', x: bx + 30, y: by - 20 });
      positions.push({ type: 'tank', x: bx - 30, y: by + 30 });
      positions.push({ type: 'tank', x: bx + 40, y: by + 30 });
      positions.push({ type: 'jet', x: bx + 10, y: by - 60 });
      positions.push({ type: 'jet', x: bx + 50, y: by - 40 });
    }
    return positions;
  }

  // 產生單位函式，若未指定 x/y，則在 HQ 附近生成
  function spawnUnit(type, x = null, y = null) {
    const def = unitTypes[type];
    if (!def) return;
    if (x === null || y === null) {
      // 隨機在 HQ 周圍生成
      const offset = 40 + Math.random() * 30;
      const angle = Math.random() * Math.PI * 2;
      x = hq.x + hq.width / 2 + Math.cos(angle) * offset;
      y = hq.y + hq.height / 2 + Math.sin(angle) * offset;
    }
    const id = `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    units.push({
      id,
      type,
      faction: selectedFaction,
      x,
      y,
      destX: x,
      destY: y,
      hp: def.hp,
      selected: false,
    });
    updateUnitList();
  }

  // 更新頂部狀態列
  function updateStatusBar() {
    statusResources.textContent = `資源: ${resources}`;
    const m = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const s = (gameTime % 60).toString().padStart(2, '0');
    statusTime.textContent = `時間: ${m}:${s}`;
  }

  // 更新單位列表
  function updateUnitList() {
    unitListEl.innerHTML = '';
    units.forEach((u, index) => {
      const li = document.createElement('li');
      // 使用繁體中文顯示單位類型，並附加編號以區分重複單位
      const typeName = unitNameZH[u.type] || u.type;
      // 序號簡化為索引加一
      li.textContent = `${typeName} #${index + 1}`;
      if (u.selected) li.classList.add('selected');
      li.addEventListener('click', () => {
        clearSelections();
        u.selected = true;
        selectedUnits = [u];
        updateUnitList();
        updateInfoDisplay();
      });
      unitListEl.appendChild(li);
    });
  }

  // 更新資訊面板
  function updateInfoDisplay() {
    if (selectedUnits.length === 0) {
      infoDisplay.innerHTML = '<p>點擊或拖曳選取單位，可查看詳細資料。</p>';
    } else if (selectedUnits.length === 1) {
      const u = selectedUnits[0];
      const typeName = unitNameZH[u.type] || u.type;
      infoDisplay.innerHTML = `
        <p><strong>單位類型：</strong>${typeName}</p>
        <p><strong>生命值：</strong>${u.hp}</p>
        <p><strong>位置：</strong>(${u.x.toFixed(0)}, ${u.y.toFixed(0)})</p>
      `;
    } else {
      infoDisplay.innerHTML = `<p>已選取 ${selectedUnits.length} 個單位</p>`;
    }
  }

  // 清空所有選取
  function clearSelections() {
    units.forEach((u) => {
      u.selected = false;
    });
    selectedUnits = [];
  }

  // 更新下方指令按鈕狀態
  function updateCmdButtons() {
    Object.keys(cmdButtons).forEach((cmd) => {
      const btn = cmdButtons[cmd];
      if (cmd === currentCommand) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      // 暫停按鈕特殊文字
      if (cmd === 'pause') {
        btn.textContent = paused ? '繼續' : '暫停';
      }
    });
  }

  // 處理滑鼠事件
  function bindCanvasEvents() {
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (e.button === 0) {
        // 左鍵開始框選
        isSelecting = true;
        selectStart = { x, y };
        selectCurrent = { x, y };
      }
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!isSelecting) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      selectCurrent = { x, y };
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0 && isSelecting) {
        // 完成框選
        isSelecting = false;
        performSelection(selectStart, selectCurrent);
      }
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // 右鍵下命令
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (selectedUnits.length > 0) {
        selectedUnits.forEach((u) => {
          u.destX = x;
          u.destY = y;
        });
      }
    });
  }

  // 執行框選邏輯
  function performSelection(start, end) {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);
    clearSelections();
    units.forEach((u) => {
      if (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) {
        u.selected = true;
        selectedUnits.push(u);
      }
    });
    updateUnitList();
    updateInfoDisplay();
  }

  // 更新單位位置並繪製畫面
  function update() {
    if (!gameStarted) return;
    if (!paused) {
      // 更新位置
      units.forEach((u) => {
        const def = unitTypes[u.type];
        const dx = u.destX - u.x;
        const dy = u.destY - u.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          const vx = (dx / dist) * def.speed;
          const vy = (dy / dist) * def.speed;
          u.x += vx;
          u.y += vy;
        }
      });
    }
    draw();
    requestAnimationFrame(update);
  }

  // 主繪圖函式
  function draw() {
    if (!mapLoaded) return;
    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 繪製地圖
    ctx.drawImage(mapImage, 0, 0);
    // 繪製 HQ
    if (hq) {
      ctx.fillStyle = factionColors[selectedFaction];
      ctx.fillRect(hq.x, hq.y, hq.width, hq.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(hq.x, hq.y, hq.width, hq.height);
    }
    // 繪製單位
    units.forEach((u) => {
      ctx.beginPath();
      ctx.fillStyle = factionColors[u.faction];
      ctx.arc(u.x, u.y, unitTypes[u.type].radius, 0, Math.PI * 2);
      ctx.fill();
      if (u.selected) {
        ctx.strokeStyle = '#fffa74';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, unitTypes[u.type].radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    // 繪製框選矩形
    if (isSelecting) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      const x = selectStart.x;
      const y = selectStart.y;
      const w = selectCurrent.x - selectStart.x;
      const h = selectCurrent.y - selectStart.y;
      ctx.strokeRect(x, y, w, h);
    }
  }

  // 綁定 UI 事件
  function bindUIEvents() {
    // 兵種建造按鈕
    buildInfantryBtn.addEventListener('click', () => {
      attemptBuildUnit('infantry');
    });
    buildTankBtn.addEventListener('click', () => {
      attemptBuildUnit('tank');
    });
    buildJetBtn.addEventListener('click', () => {
      attemptBuildUnit('jet');
    });
    // 指令按鈕
    Object.keys(cmdButtons).forEach((cmd) => {
      cmdButtons[cmd].addEventListener('click', () => {
        if (cmd === 'pause') {
          paused = !paused;
          updateCmdButtons();
          return;
        }
        currentCommand = cmd;
        updateCmdButtons();
      });
    });
  }

  // 嘗試建造單位：檢查資源是否足夠
  function attemptBuildUnit(type) {
    const cost = unitTypes[type].cost;
    if (resources >= cost) {
      resources -= cost;
      updateStatusBar();
      spawnUnit(type);
    }
  }

  // 初始化事件
  function initEvents() {
    // 開始遊戲按鈕
    startBtn.addEventListener('click', () => {
      const selectedRadio = document.querySelector('input[name="faction"]:checked');
      selectedFaction = selectedRadio ? selectedRadio.value : 'china';
      currentFactionEl.textContent = `陣營: ${selectedFaction === 'china' ? '中國' : selectedFaction === 'taiwan' ? '台灣' : '美國'}`;
      startScreen.style.display = 'none';
      gameContainer.classList.remove('hidden');
      gameStarted = true;
      initGame();
      updateStatusBar();
      updateUnitList();
      updateInfoDisplay();
    });
    // Canvas 事件
    bindCanvasEvents();
    // UI 事件
    bindUIEvents();
  }

  // 當頁面載入完成後綁定事件
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
  });
})();