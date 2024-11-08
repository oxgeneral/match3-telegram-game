class Match3Game {
    constructor() {
        this.grid = [];
        this.gridSize = 8;
        this.score = 0;
        this.moves = 30;
        this.selectedCell = null;
        this.isSwapping = false;
        this.colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
        
        this.level = 1;
        this.maxLives = 5;
        this.lives = this.maxLives;
        this.lastLifeLostTime = null;
        this.lifeRegenTime = 1800000; // 30 минут в миллисекундах

        this.levelGoals = {};

        this.boosters = {
            hammer: 2,
            swap: 2,
            bomb: 1
        };

        this.gemTypes = {
            red: { color: '#FF0000', points: 100 },
            green: { color: '#00FF00', points: 100 },
            blue: { color: '#0000FF', points: 100 },
            yellow: { color: '#FFFF00', points: 100 },
            purple: { color: '#FF00FF', points: 100 },
            special: {
                striped_h: { points: 200 },
                striped_v: { points: 200 },
                bomb: { points: 300 },
                rainbow: { points: 500 }
            }
        };

        this.collectedGems = {};
        Object.keys(this.gemTypes).forEach(type => {
            if (type !== 'special') {
                this.collectedGems[type] = 0;
            }
        });

        this.initTelegramUser();
        this.loadLevel(this.level);
        this.init();

        this.isAnimating = false;
    }

    // Метод инициализации игры
    init() {
        this.createGrid();
        this.setupEventListeners();
        this.updateUI();
        this.startLifeRegenTimer();
    }

    async initTelegramUser() {
        if (window.Telegram?.WebApp) {
            this.tg = window.Telegram.WebApp;
            this.user = this.tg.initDataUnsafe?.user || null;
            console.log('initDataUnsafe:', this.tg.initDataUnsafe);
            console.log('User data:', this.user);

            if (this.user && this.user.id) {
                await this.loadUserProgress();
            } else {
                console.warn('Пользовательские данные недоступны.');
                // Для локального тестирования можно установить тестового пользователя
                // this.user = { id: 'test-user' };
                // await this.loadUserProgress();
            }
        } else {
            console.warn('Telegram WebApp не доступен.');
            // Для локального тестирования можно установить тестового пользователя
            // this.user = { id: 'test-user' };
            // this.loadUserProgress();
        }
    }

    async loadUserProgress() {
        if (!this.user || !this.user.id) {
            console.warn('Пользовательские данные отсутствуют. Пропуск загрузки прогресса.');
            return;
        }
        try {
            const response = await fetch(`/api/progress?userId=${this.user.id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! статус: ${response.status}`);
            }
            const progress = await response.json();
            this.level = progress.level || 1;
            this.lives = progress.energy || this.maxLives;
            this.boosters = progress.boosters || this.boosters;
            console.log('Загруженный прогресс:', progress);
        } catch (error) {
            console.error('Ошибка загрузки прогресса:', error);
        }
    }

    loadLevel(levelNumber) {
        const levelConfig = {
            1: {
                moves: 30,
                goals: { red: 10, blue: 10 },
                gridSize: 8
            },
            2: {
                moves: 25,
                goals: { green: 15, yellow: 15 },
                gridSize: 8
            }
            // Добавьте больше уровней здесь
        };

        const config = levelConfig[levelNumber] || levelConfig[1];
        this.moves = config.moves;
        this.levelGoals = config.goals;
        this.gridSize = config.gridSize;
        this.updateLevelUI();
    }

    updateLevelUI() {
        const goalsContainer = document.getElementById('level-goals');
        goalsContainer.innerHTML = '';

        Object.entries(this.levelGoals).forEach(([type, count]) => {
            const goalElement = document.createElement('div');
            goalElement.className = 'goal-item';
            
            const gemElement = document.createElement('div');
            gemElement.className = 'goal-gem';
            if (this.gemTypes[type]) {
                gemElement.style.backgroundColor = this.gemTypes[type].color;
            } else {
                gemElement.classList.add(type);
            }

            const countElement = document.createElement('span');
            countElement.textContent = `${this.collectedGems[type] || 0}/${count}`;

            goalElement.appendChild(gemElement);
            goalElement.appendChild(countElement);
            goalsContainer.appendChild(goalElement);
        });
    }

    startLifeRegenTimer() {
        setInterval(() => {
            if (this.lives < this.maxLives && this.lastLifeLostTime) {
                const timePassed = Date.now() - this.lastLifeLostTime;
                const livesToRegen = Math.floor(timePassed / this.lifeRegenTime);
                
                if (livesToRegen > 0) {
                    this.lives = Math.min(this.maxLives, this.lives + livesToRegen);
                    this.lastLifeLostTime = Date.now();
                    this.updateUI();
                }
            }
        }, 1000);
    }

    loseLife() {
        if (this.lives > 0) {
            this.lives--;
            this.lastLifeLostTime = Date.now();
            this.updateUI();
            this.saveProgress();
        }
    }

    useBooster(type) {
        if (this.boosters[type] > 0) {
            this.boosters[type]--;
            this.updateUI();
            this.saveProgress();
            // Реализуйте логику применения бустера
            switch(type) {
                case 'hammer':
                    this.activateHammerBooster();
                    break;
                case 'swap':
                    this.activateSwapBooster();
                    break;
                case 'bomb':
                    this.activateBombBooster();
                    break;
            }
        } else {
            console.warn(`Бустер ${type} закончился.`);
        }
    }

    activateHammerBooster() {
        // Логика разбития выбранной фишки
        if (this.selectedCell) {
            const x = parseInt(this.selectedCell.dataset.x);
            const y = parseInt(this.selectedCell.dataset.y);
            const gem = this.selectedCell.querySelector('.gem');
            if (gem) {
                this.grid[y][x] = null;
                this.selectedCell.classList.remove('selected');
                this.selectedCell = null;
                this.updateUI();
                this.animateGemDestruction(gem);
                this.fillEmptySpaces();
                this.combo = 0;
            }
        } else {
            alert('Выберите фишку для разбития.');
        }
    }

    activateSwapBooster() {
        // Логика замены выбранной фишки на другую
        const coords = prompt('Введите координаты фишки для замены (например, 3,4):');
        if (coords) {
            const [cx, cy] = coords.split(',').map(Number);
            if (isNaN(cx) || isNaN(cy)) {
                alert('Некорректные координаты.');
                return;
            }
            const cell = document.querySelector(`.cell[data-x="${cx}"][data-y="${cy}"]`);
            if (cell) {
                const gem = cell.querySelector('.gem');
                if (gem) {
                    const newColor = this.getRandomColor();
                    gem.style.backgroundColor = newColor;
                    this.grid[cy][cx] = newColor;
                    this.updateUI();
                }
            } else {
                alert('Фишка с такими координатами не найдена.');
            }
        }
    }

    activateBombBooster() {
        // Логика уничтожения области вокруг выбранной фишки
        if (this.selectedCell) {
            const x = parseInt(this.selectedCell.dataset.x);
            const y = parseInt(this.selectedCell.dataset.y);
            this.clearArea(x, y, 2);
            this.selectedCell.classList.remove('selected');
            this.selectedCell = null;
            this.updateUI();
            this.combo = 0;
        } else {
            alert('Выберите фишку для взрыва.');
        }
    }

    setupEventListeners() {
        const gridElement = document.getElementById('grid');
        
        gridElement.addEventListener('click', (e) => {
            if (this.isSwapping || this.isAnimating) return;
            
            const cell = e.target.closest('.cell');
            if (!cell) return;
            
            const x = parseInt(cell.dataset.x);
            const y = parseInt(cell.dataset.y);
            
            if (this.selectedCell) {
                if (this.areAdjacent(x, y, parseInt(this.selectedCell.dataset.x), parseInt(this.selectedCell.dataset.y))) {
                    this.swapGems(x, y, parseInt(this.selectedCell.dataset.x), parseInt(this.selectedCell.dataset.y));
                }
                
                this.selectedCell.classList.remove('selected');
                this.selectedCell = null;
            } else {
                this.selectedCell = cell;
                cell.classList.add('selected');
            }
        });

        document.getElementById('hammer-booster').addEventListener('click', () => {
            this.useBooster('hammer');
        });

        document.getElementById('swap-booster').addEventListener('click', () => {
            this.useBooster('swap');
        });

        document.getElementById('bomb-booster').addEventListener('click', () => {
            this.useBooster('bomb');
        });
    }

    areAdjacent(x1, y1, x2, y2) {
        return (Math.abs(x1 - x2) === 1 && y1 === y2) || 
               (Math.abs(y1 - y2) === 1 && x1 === x2);
    }

    async swapGems(x1, y1, x2, y2) {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.isSwapping = true;
        this.moves--;

        const cells = document.querySelectorAll('.cell');
        const gem1 = cells[y1 * this.gridSize + x1].querySelector('.gem');
        const gem2 = cells[y2 * this.gridSize + x2].querySelector('.gem');

        // Анимируем перемещение
        gem1.style.transform = `translate(${x2 - x1}00%, ${y2 - y1}00%)`;
        gem2.style.transform = `translate(${x1 - x2}00%, ${y1 - y2}00%)`;

        // Ждем завершения анимации
        await new Promise(resolve => setTimeout(resolve, 300));

        // Меняем цвета в сетке
        const tempColor = this.grid[y1][x1];
        this.grid[y1][x1] = this.grid[y2][x2];
        this.grid[y2][x2] = tempColor;

        // Обновляем цвета в DOM
        gem1.style.backgroundColor = this.grid[y1][x1];
        gem2.style.backgroundColor = this.grid[y2][x2];

        // Возвращаем фишки на место
        gem1.style.transform = '';
        gem2.style.transform = '';

        // Проверяем совпадения
        const matches = this.findMatches();

        if (matches.length > 0) {
            await this.handleMatches(matches);
        } else {
            // Если совпадений нет, отменяем обмен
            this.grid[y1][x1] = this.grid[y2][x2];
            this.grid[y2][x2] = tempColor;

            // Анимируем возврат фишек
            gem1.style.transform = `translate(${x2 - x1}00%, ${y2 - y1}00%)`;
            gem2.style.transform = `translate(${x1 - x2}00%, ${y1 - y2}00%)`;

            await new Promise(resolve => setTimeout(resolve, 300));

            gem1.style.backgroundColor = this.grid[y1][x1];
            gem2.style.backgroundColor = this.grid[y2][x2];

            gem1.style.transform = '';
            gem2.style.transform = '';

            this.moves++;
        }

        this.updateUI();
        this.isSwapping = false;
        this.isAnimating = false;

        if (this.moves === 0) {
            this.gameOver();
        }
    }

    findMatches() {
        const matches = [];

        for (let y = 0; y < this.gridSize; y++) {
            let matchLength = 1;
            for (let x = 1; x < this.gridSize; x++) {
                if (this.grid[y][x] === this.grid[y][x - 1] && this.grid[y][x] !== null) {
                    matchLength++;
                } else {
                    if (matchLength >= 3) {
                        matches.push({ x: x - matchLength, y, length: matchLength, direction: 'horizontal' });
                    }
                    matchLength = 1;
                }
            }
            if (matchLength >= 3) {
                matches.push({ x: this.gridSize - matchLength, y, length: matchLength, direction: 'horizontal' });
            }
        }

        for (let x = 0; x < this.gridSize; x++) {
            let matchLength = 1;
            for (let y = 1; y < this.gridSize; y++) {
                if (this.grid[y][x] === this.grid[y - 1][x] && this.grid[y][x] !== null) {
                    matchLength++;
                } else {
                    if (matchLength >= 3) {
                        matches.push({ x, y: y - matchLength, length: matchLength, direction: 'vertical' });
                    }
                    matchLength = 1;
                }
            }
            if (matchLength >= 3) {
                matches.push({ x, y: this.gridSize - matchLength, length: matchLength, direction: 'vertical' });
            }
        }

        return matches;
    }

    async handleMatches(matches) {
        if (matches.length === 0) return;

        this.combo++;
        const comboMultiplier = 1 + (this.combo * 0.1);

        matches.forEach(match => {
            for (let i = 0; i < match.length; i++) {
                const x = match.direction === 'horizontal' ? match.x + i : match.x;
                const y = match.direction === 'vertical' ? match.y + i : match.y;

                if (this.levelGoals[this.grid[y][x]]) {
                    this.collectedGems[this.grid[y][x]] = (this.collectedGems[this.grid[y][x]] || 0) + 1;
                }

                this.grid[y][x] = null;
                this.score += this.gemTypes[this.grid[y][x]]?.points * comboMultiplier || 100 * comboMultiplier;
            }
        });

        this.updateLevelUI();
        this.updateUI();

        await this.animateMatches(matches);

        await this.fillEmptySpaces();

        const newMatches = this.findMatches();
        if (newMatches.length > 0) {
            await this.handleMatches(newMatches);
        } else {
            this.combo = 0;
        }

        this.checkLevelComplete();
    }

    async animateMatches(matches) {
        const cells = document.querySelectorAll('.cell');

        const animations = matches.map(match => {
            const promises = [];
            for (let i = 0; i < match.length; i++) {
                const x = match.direction === 'horizontal' ? match.x + i : match.x;
                const y = match.direction === 'vertical' ? match.y + i : match.y;
                const gem = cells[y * this.gridSize + x].querySelector('.gem');
                if (gem) {
                    gem.classList.add('gem-destroy');
                    promises.push(new Promise(resolve => {
                        gem.addEventListener('animationend', () => {
                            resolve();
                        }, { once: true });
                    }));
                }
            }
            return Promise.all(promises);
        });

        await Promise.all(animations);
    }

    async fillEmptySpaces() {
        const cells = document.querySelectorAll('.cell');

        for (let x = 0; x < this.gridSize; x++) {
            let emptySlots = 0;
            for (let y = this.gridSize - 1; y >= 0; y--) {
                if (this.grid[y][x] === null) {
                    emptySlots++;
                } else if (emptySlots > 0) {
                    this.grid[y + emptySlots][x] = this.grid[y][x];
                    this.grid[y][x] = null;

                    const gem = cells[y * this.gridSize + x].querySelector('.gem');
                    const targetCell = cells[(y + emptySlots) * this.gridSize + x];
                    const targetGem = targetCell.querySelector('.gem');

                    if (gem) {
                        gem.style.transition = `transform ${0.5 + emptySlots * 0.1}s ease-in`;
                        gem.style.transform = `translateY(${emptySlots * 100}%)`;

                        await new Promise(resolve => {
                            gem.addEventListener('transitionend', () => {
                                gem.style.transform = '';
                                targetCell.appendChild(gem);
                                resolve();
                            }, { once: true });
                        });
                    }
                }
            }

            // Добавление новых фишек сверху
            for (let i = 0; i < emptySlots; i++) {
                const gem = this.createGem(this.getRandomColor());
                const newY = i;
                this.grid[newY][x] = gem.dataset.color;

                const cell = cells[newY * this.gridSize + x];
                cell.appendChild(gem);

                await new Promise(resolve => {
                    setTimeout(() => {
                        gem.classList.add('gem-fall');
                        gem.addEventListener('animationend', () => {
                            gem.classList.remove('gem-fall');
                            resolve();
                        }, { once: true });
                    }, i * 100);
                });
            }
        }
    }

    createGem(color) {
        const gem = document.createElement('div');
        gem.className = 'gem gem-pop';
        gem.style.backgroundColor = color;
        gem.dataset.color = color;
        return gem;
    }

    checkLevelComplete() {
        let allGoalsCompleted = true;
        for (const [color, count] of Object.entries(this.levelGoals)) {
            if ((this.collectedGems[color] || 0) < count) {
                allGoalsCompleted = false;
                break;
            }
        }

        if (allGoalsCompleted) {
            this.levelComplete();
        }
    }

    async levelComplete() {
        const bonus = this.moves * 50;
        this.score += bonus;
        
        await this.saveProgress();
        
        this.showLevelCompleteDialog({
            score: this.score,
            bonus: bonus,
            stars: this.calculateStars()
        });

        // Переход на следующий уровень
        this.level++;
        this.loadLevel(this.level);
        this.createGrid();
    }

    calculateStars() {
        const scoreThresholds = {
            1: 1000,
            2: 2000,
            3: 3000
        };

        if (this.score >= scoreThresholds[3]) return 3;
        if (this.score >= scoreThresholds[2]) return 2;
        if (this.score >= scoreThresholds[1]) return 1;
        return 0;
    }

    showLevelCompleteDialog({ score, bonus, stars }) {
        const message = `
            Уровень пройден!
            Очки: ${score}
            Бонус за оставшиеся ходы: ${bonus}
            Звезды: ${'⭐'.repeat(stars)}
        `;
        
        alert(message);
    }

    gameOver() {
        alert(`Игра окончена! Ваш счет: ${this.score}`);
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.sendData(JSON.stringify({
                score: this.score,
                level: this.level
            }));
        }
        
        this.loseLife();
        if (this.lives > 0) {
            this.loadLevel(this.level);
            this.createGrid();
            this.updateUI();
        } else {
            // Логика окончания игры без жизней
            alert('У вас больше нет жизней. Ждите восстановления или приобретите их.');
        }
    }
}

window.onload = () => {
    new Match3Game();
}; 