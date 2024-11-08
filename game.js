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
        this.energy = 5;
        this.maxEnergy = 5;
        this.combo = 0;
        this.goals = {};
        this.boosters = {
            hammer: 2,
            swap: 2,
            rainbow: 1
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

        this.initTelegramUser();
        this.loadLevel(this.level);
        this.init();
    }

    async initTelegramUser() {
        if (window.Telegram?.WebApp) {
            this.tg = window.Telegram.WebApp;
            this.user = this.tg.initDataUnsafe?.user;
            await this.loadUserProgress();
        }
    }

    async loadUserProgress() {
        try {
            const response = await fetch(`/api/progress?userId=${this.user.id}`);
            const progress = await response.json();
            this.level = progress.level || 1;
            this.energy = progress.energy || 5;
            this.boosters = progress.boosters || this.boosters;
        } catch (error) {
            console.error('Ошибка загрузки прогресса:', error);
        }
    }

    loadLevel(levelNumber) {
        const levelConfig = {
            1: {
                moves: 30,
                goals: { red: 10, blue: 10 },
                gridSize: 7
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
        this.goals = config.goals;
        this.gridSize = config.gridSize;
    }

    createSpecialGem(type) {
        const gem = document.createElement('div');
        gem.className = 'gem special';
        gem.dataset.type = type;

        switch (type) {
            case 'striped_h':
                gem.classList.add('striped-horizontal');
                break;
            case 'striped_v':
                gem.classList.add('striped-vertical');
                break;
            case 'bomb':
                gem.classList.add('bomb');
                break;
            case 'rainbow':
                gem.classList.add('rainbow');
                break;
        }

        return gem;
    }

    init() {
        this.createGrid();
        this.setupEventListeners();
        this.updateUI();
        
        // Инициализация Telegram Mini App
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
    }

    createGrid() {
        const gridElement = document.getElementById('grid');
        gridElement.innerHTML = '';

        // Создаем начальную сетку
        for (let y = 0; y < this.gridSize; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;

                const gem = document.createElement('div');
                gem.className = 'gem';
                
                // Убедимся, что не создаем совпадения при инициализации
                let color;
                do {
                    color = this.colors[Math.floor(Math.random() * this.colors.length)];
                } while (this.wouldCreateMatch(x, y, color));
                
                gem.style.backgroundColor = color;
                this.grid[y][x] = color;
                
                cell.appendChild(gem);
                gridElement.appendChild(cell);
            }
        }
    }

    wouldCreateMatch(x, y, color) {
        // Проверка горизонтальных совпадений
        if (x >= 2) {
            if (this.grid[y][x-1] === color && this.grid[y][x-2] === color) {
                return true;
            }
        }
        
        // Проверка вертикальных совпадений
        if (y >= 2) {
            if (this.grid[y-1][x] === color && this.grid[y-2][x] === color) {
                return true;
            }
        }
        
        return false;
    }

    setupEventListeners() {
        const gridElement = document.getElementById('grid');
        
        gridElement.addEventListener('click', (e) => {
            if (this.isSwapping) return;
            
            const cell = e.target.closest('.cell');
            if (!cell) return;
            
            const x = parseInt(cell.dataset.x);
            const y = parseInt(cell.dataset.y);
            
            if (this.selectedCell) {
                // Проверяем, являются ли ячейки соседними
                const prevX = parseInt(this.selectedCell.dataset.x);
                const prevY = parseInt(this.selectedCell.dataset.y);
                
                if (this.areAdjacent(x, y, prevX, prevY)) {
                    this.swapGems(x, y, prevX, prevY);
                }
                
                this.selectedCell.classList.remove('selected');
                this.selectedCell = null;
            } else {
                this.selectedCell = cell;
                cell.classList.add('selected');
            }
        });
    }

    areAdjacent(x1, y1, x2, y2) {
        return (Math.abs(x1 - x2) === 1 && y1 === y2) || 
               (Math.abs(y1 - y2) === 1 && x1 === x2);
    }

    async swapGems(x1, y1, x2, y2) {
        this.isSwapping = true;
        this.moves--;
        
        // Меняем цвета местами
        const temp = this.grid[y1][x1];
        this.grid[y1][x1] = this.grid[y2][x2];
        this.grid[y2][x2] = temp;
        
        // Обновляем UI
        const cells = document.querySelectorAll('.cell');
        const gem1 = cells[y1 * this.gridSize + x1].querySelector('.gem');
        const gem2 = cells[y2 * this.gridSize + x2].querySelector('.gem');
        
        gem1.style.backgroundColor = this.grid[y1][x1];
        gem2.style.backgroundColor = this.grid[y2][x2];
        
        // Проверяем, образовалось ли совпадение
        const matches = this.findMatches();
        
        if (matches.length > 0) {
            await this.handleMatches(matches);
        } else {
            // Если совпадений нет, меняем обратно
            this.grid[y1][x1] = this.grid[y2][x2];
            this.grid[y2][x2] = temp;
            
            gem1.style.backgroundColor = this.grid[y1][x1];
            gem2.style.backgroundColor = this.grid[y2][x2];
            
            this.moves++; // Возвращаем ход
        }
        
        this.updateUI();
        this.isSwapping = false;
        
        // Проверяем условие окончания игры
        if (this.moves === 0) {
            this.gameOver();
        }
    }

    findMatches() {
        const matches = [];
        
        // Проверяем горизонтальные совпадения
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize - 2; x++) {
                if (this.grid[y][x] === this.grid[y][x+1] && 
                    this.grid[y][x] === this.grid[y][x+2]) {
                    matches.push({x, y, direction: 'horizontal', length: 3});
                }
            }
        }
        
        // Проверяем вертикальные совпадения
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize - 2; y++) {
                if (this.grid[y][x] === this.grid[y+1][x] && 
                    this.grid[y][x] === this.grid[y+2][x]) {
                    matches.push({x, y, direction: 'vertical', length: 3});
                }
            }
        }
        
        return matches;
    }

    async handleMatches(matches) {
        this.combo++;
        const comboMultiplier = 1 + (this.combo * 0.1);
        
        matches.forEach(match => {
            // Создаем специальные фишки при больших совпадениях
            if (match.length >= 4) {
                const specialType = this.getSpecialGemType(match);
                const position = this.getSpecialGemPosition(match);
                this.createSpecialGemAt(position.x, position.y, specialType);
            }
            
            const basePoints = match.length * 100;
            this.score += Math.floor(basePoints * comboMultiplier);
        });

        await this.animateMatches(matches);
        this.fillEmptySpaces();
        
        // Проверяем достижение целей уровня
        this.checkGoals();
    }

    getSpecialGemType(match) {
        if (match.length >= 5) return 'rainbow';
        if (match.length === 4) {
            return match.direction === 'horizontal' ? 'striped_h' : 'striped_v';
        }
        return null;
    }

    checkGoals() {
        let allGoalsCompleted = true;
        for (const [color, count] of Object.entries(this.goals)) {
            if (this.collectedGems[color] < count) {
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

    async saveProgress() {
        if (!this.user) return;

        try {
            await fetch('/api/progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.user.id,
                    level: this.level,
                    score: this.score,
                    energy: this.energy,
                    boosters: this.boosters
                })
            });
        } catch (error) {
            console.error('Ошибка сохранения прогресса:', error);
        }
    }

    async animateMatches(matches) {
        const cells = document.querySelectorAll('.cell');
        const animations = [];
        
        matches.forEach(match => {
            if (match.direction === 'horizontal') {
                for (let i = 0; i < match.length; i++) {
                    const gem = cells[match.y * this.gridSize + (match.x + i)].querySelector('.gem');
                    animations.push(this.animateGemDestruction(gem));
                }
            } else {
                for (let i = 0; i < match.length; i++) {
                    const gem = cells[(match.y + i) * this.gridSize + match.x].querySelector('.gem');
                    animations.push(this.animateGemDestruction(gem));
                }
            }
        });
        
        await Promise.all(animations);
    }

    animateGemDestruction(gem) {
        return new Promise(resolve => {
            gem.style.transform = 'scale(0)';
            gem.style.opacity = '0';
            
            setTimeout(() => {
                gem.style.transform = '';
                gem.style.opacity = '';
                resolve();
            }, 300);
        });
    }

    fillEmptySpaces() {
        // Заполняем пустые места новыми гемами
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = this.gridSize - 1; y >= 0; y--) {
                if (this.grid[y][x] === null) {
                    // Ищем ближайший непустой гем сверху
                    for (let above = y - 1; above >= 0; above--) {
                        if (this.grid[above][x] !== null) {
                            this.grid[y][x] = this.grid[above][x];
                            this.grid[above][x] = null;
                            break;
                        }
                    }
                    
                    // Если не нашли, создаем новый
                    if (this.grid[y][x] === null) {
                        this.grid[y][x] = this.colors[Math.floor(Math.random() * this.colors.length)];
                    }
                }
            }
        }
        
        // Обновляем UI
        const cells = document.querySelectorAll('.cell');
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const gem = cells[y * this.gridSize + x].querySelector('.gem');
                gem.style.backgroundColor = this.grid[y][x];
            }
        }
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('moves').textContent = this.moves;
    }

    gameOver() {
        alert(`Игра окончена! Ваш счет: ${this.score}`);
        // Здесь можно добавить логику отправки результата в Telegram
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.sendData(JSON.stringify({
                score: this.score
            }));
        }
    }
}

// Запускаем игру
window.onload = () => {
    new Match3Game();
}; 